import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp, querySnapshotToArray, docToObject, arrayUnion, arrayRemove } from '../db/converters.js';
import { generateJoinCode } from '../utils/helpers.js';
import * as contributionScheduler from '../services/contributionScheduler.js';
import * as payoutScheduler from '../services/payoutScheduler.js';
import * as walletService from '../services/walletService.js';
import { convertNairaToKobo, formatKoboAsNaira } from '../utils/currency.js';
import {
    calcCycleEndDate,
    calcGroupEndDate,
    getDeductionOffset,
    getPayoutOffset,
    rollForwardCycle
} from '../utils/cycleEngine.js';

/**
 * @desc    Create new group
 * @route   POST /api/groups
 * @access  Private
 */
export const createGroup = async (req, res) => {
    try {
        const {
            name,
            description,
            contributionAmount,
            contributionFrequency,
            contributionPeriodMonths,
            latePaymentPenalty,
            startDate,
            maxMembers,
            daily_deduction_time  // e.g. "14:00" — only used for daily frequency
        } = req.body;

        // Generate unique join code
        let joinCode;
        let isUnique = false;

        while (!isUnique) {
            joinCode = generateJoinCode();
            const existing = await db.collection(COLLECTIONS.GROUPS)
                .where('joinCode', '==', joinCode)
                .limit(1)
                .get();
            if (existing.empty) isUnique = true;
        }

        // Calculate totalCycles based on frequency
        let totalCycles;
        if (contributionFrequency === 'daily') {
            totalCycles = contributionPeriodMonths * 30;
        } else if (contributionFrequency === 'weekly') {
            totalCycles = contributionPeriodMonths * 4;
        } else {
            totalCycles = contributionPeriodMonths;
        }

        // Determine savings mode and member limits based on frequency
        let savingsMode = 'group';
        let actualMaxMembers = maxMembers || 6;
        let isInviteEnabled = true;

        if (contributionFrequency === 'daily') {
            savingsMode = 'individual';
            actualMaxMembers = 1;
            isInviteEnabled = false;
        } else if (contributionFrequency === 'weekly') {
            actualMaxMembers = Math.min(actualMaxMembers, 10);
        } else {
            actualMaxMembers = Math.min(actualMaxMembers, 6);
        }

        // Calculate end date using fixed-day intervals (NOT calendar months)
        const groupStartDate = startDate ? new Date(startDate) : new Date();
        // For daily/weekly/monthly: endDate = groupStart + (totalCycles × cycleLength) days
        const endDate = calcGroupEndDate(groupStartDate, contributionFrequency, totalCycles);

        // First cycle dates
        const firstCycleEndDate = calcCycleEndDate(groupStartDate, contributionFrequency);

        // Create admin as first member
        const adminMember = {
            userId: req.user.id,
            joinedAt: new Date(),
            payoutTurn: 1,
            hasReceivedPayout: false
        };

        // Convert user-supplied Naira amounts to kobo for storage
        const contributionAmountKobo = convertNairaToKobo(parseFloat(contributionAmount));
        const latePaymentPenaltyKobo = latePaymentPenalty ? convertNairaToKobo(parseFloat(latePaymentPenalty)) : 0;

        // Calculate totalPerCycle and totalPayout in kobo (admin is first & only member at creation)
        const totalPerCycle = contributionAmountKobo * 1;
        const totalPayout = contributionAmountKobo * 1;

        const groupData = prepareForFirestore({
            name,
            description: description || null,
            adminId: req.user.id,
            joinCode,
            contributionAmount: contributionAmountKobo,   // stored in kobo
            contributionFrequency,
            contributionPeriodMonths,
            totalCycles,
            currentCycle: 1,
            maxMembers: actualMaxMembers,
            totalPerCycle,                                 // stored in kobo
            totalPayout,                                   // stored in kobo
            currentEscrowBalance: 0,
            totalContributed: 0,
            savingsMode,
            isInviteEnabled,
            latePaymentPenalty: latePaymentPenaltyKobo,   // stored in kobo
            status: 'active',
            startDate: groupStartDate,
            endDate,                                       // fixed-day overall end date
            closedAt: null,
            members: [adminMember],
            // ── Fixed-Cycle Engine fields ───────────────────────────────────
            cycle_start_date: groupStartDate.toISOString(),
            cycle_end_date:   firstCycleEndDate.toISOString(),
            deduction_day_offset: getDeductionOffset(contributionFrequency),
            payout_day_offset:    getPayoutOffset(contributionFrequency),
            // daily_deduction_time: only for daily frequency (HH:MM UTC)
            daily_deduction_time: contributionFrequency === 'daily'
                ? (daily_deduction_time || '12:00')
                : null,
            // ────────────────────────────────────────────────────────────────
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        const groupRef = await db.collection(COLLECTIONS.GROUPS).add(groupData);
        const createdGroup = await groupRef.get();

        // Schedule contributions and payouts for the new group
        try {
            await contributionScheduler.scheduleGroupContributions(groupRef.id);
            await payoutScheduler.scheduleGroupPayouts(groupRef.id);
        } catch (scheduleError) {
            console.error('Error scheduling contributions/payouts:', scheduleError);
            // Don't fail group creation if scheduling fails
        }

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: {
                group: {
                    id: groupRef.id,
                    ...createdGroup.data()
                }
            }
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating group',
            error: error.message
        });
    }
};

/**
 * @desc    Get all groups for current user
 * @route   GET /api/groups
 * @access  Private
 */
export const getMyGroups = async (req, res) => {
    try {
        // Query groups where user is a member (in the members array)
        // Note: This requires checking if userId exists in the members array
        const groupsSnapshot = await db.collection(COLLECTIONS.GROUPS).get();

        const allGroups = groupsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(group =>
                group.members && group.members.some(m => m.userId === req.user.id)
            );

        // Separate active and closed groups
        const activeGroups = allGroups.filter(g => g.status === 'active');
        const closedGroups = allGroups.filter(g => g.status === 'closed');

        res.status(200).json({
            success: true,
            data: {
                activeGroups,
                closedGroups,
                total: allGroups.length
            }
        });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching groups',
            error: error.message
        });
    }
};

/**
 * @desc    Get single group details
 * @route   GET /api/groups/:id
 * @access  Private
 */
export const getGroup = async (req, res) => {
    try {
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(req.params.id).get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Check if user is a member
        const isMember = group.members && group.members.some(
            m => m.userId === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const isAdmin = group.adminId === req.user.id;

        // Populate member details
        const membersWithDetails = await Promise.all(
            group.members.map(async (member) => {
                const userDoc = await db.collection(COLLECTIONS.USERS).doc(member.userId).get();
                const userData = userDoc.exists ? userDoc.data() : null;

                return {
                    ...member,
                    userDetails: userData ? {
                        id: userDoc.id,
                        fullName: userData.fullName,
                        email: userData.email,
                        phoneNumber: isAdmin ? userData.phoneNumber : undefined
                    } : null
                };
            })
        );

        // ── Who has paid this cycle? ──────────────────────────────────────────
        // Use only single-field + equality queries to avoid composite index requirements.
        // Status filtering is done in-memory after fetching all docs for this cycle.
        const currentCycle = group.currentCycle || 1;
        const [contribSnap, scheduleSnap] = await Promise.all([
            db.collection(COLLECTIONS.CONTRIBUTIONS)
                .where('groupId', '==', group.id)
                .where('cycleNumber', '==', currentCycle)
                .get(),
            // Try to fetch schedules; if the collection doesn't exist yet, return empty safely
            db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
                .where('groupId', '==', group.id)
                .get()
        ]);

        // Filter paid in-memory — no composite index needed
        const paidUserIds = new Set(
            contribSnap.docs
                .filter(d => d.data().status === 'paid')
                .map(d => d.data().userId)
        );

        // Build { userId -> schedule data } — filter by cycleNumber in-memory
        const scheduleByUser = {};
        scheduleSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.userId && data.cycleNumber === currentCycle) {
                scheduleByUser[data.userId] = {
                    status: data.status,
                    graceDeadline: data.graceDeadline || null,
                    attemptCount: data.attemptCount || 0
                };
            }
        });

        const membersWithPaymentStatus = membersWithDetails.map(m => ({
            ...m,
            hasPaidCurrentCycle: paidUserIds.has(m.userId),
            // contributionStatus from schedule: 'paid' | 'failed' | 'overdue' | 'pending'
            contributionStatus: scheduleByUser[m.userId]?.status
                ?? (paidUserIds.has(m.userId) ? 'paid' : 'pending'),
            graceDeadline: scheduleByUser[m.userId]?.graceDeadline ?? null,
            attemptCount: scheduleByUser[m.userId]?.attemptCount ?? 0
        }));

        res.status(200).json({

            success: true,
            data: {
                group: {
                    ...group,
                    members: membersWithPaymentStatus
                },
                isAdmin
            }
        });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group',
            error: error.message
        });
    }
};

/**
 * @desc    Join group with code
 * @route   POST /api/groups/join
 * @access  Private
 */
export const joinGroup = async (req, res) => {
    try {
        const { joinCode } = req.body;

        const groupQuery = await db.collection(COLLECTIONS.GROUPS)
            .where('joinCode', '==', joinCode)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (groupQuery.empty) {
            return res.status(404).json({
                success: false,
                message: 'Invalid join code or group is closed'
            });
        }

        const groupDoc = groupQuery.docs[0];
        const group = groupDoc.data();

        // Check if already a member
        const isMember = group.members && group.members.some(
            m => m.userId === req.user.id
        );

        if (isMember) {
            return res.status(400).json({
                success: false,
                message: 'You are already a member of this group'
            });
        }

        // Block joins for daily/individual savings
        if (group.contributionFrequency === 'daily' || group.savingsMode === 'individual' || !group.isInviteEnabled) {
            return res.status(400).json({
                success: false,
                message: 'This is a personal savings goal and cannot accept new members'
            });
        }

        // Check if group has reached maximum capacity
        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({
                success: false,
                message: 'Group has reached maximum capacity'
            });
        }

        // Add user as member with next payout turn
        const nextPayoutTurn = group.members.length + 1;
        const newMember = {
            userId: req.user.id,
            joinedAt: new Date(),
            payoutTurn: nextPayoutTurn,
            hasReceivedPayout: false
        };

        const updatedMembers = [...group.members, newMember];
        const memberCount = updatedMembers.length;
        const newTotalPerCycle = group.contributionAmount * memberCount;
        const newTotalPayout = group.contributionAmount * memberCount;

        await db.collection(COLLECTIONS.GROUPS).doc(groupDoc.id).update({
            members: updatedMembers,
            totalPerCycle: newTotalPerCycle,
            totalPayout: newTotalPayout,
            updatedAt: serverTimestamp()
        });

        res.status(200).json({
            success: true,
            message: 'Successfully joined group',
            data: {
                groupId: groupDoc.id
            }
        });
    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error joining group',
            error: error.message
        });
    }
};

/**
 * @desc    Update group settings
 * @route   PUT /api/groups/:id
 * @access  Private (Admin only)
 */
export const updateGroup = async (req, res) => {
    try {
        const { name, description, latePaymentPenalty } = req.body;
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = groupDoc.data();

        // Check if user is admin
        if (group.adminId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only group admin can update group settings'
            });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (latePaymentPenalty !== undefined) updateData.latePaymentPenalty = latePaymentPenalty;
        updateData.updatedAt = serverTimestamp();

        await groupRef.update(prepareForFirestore(updateData));

        res.status(200).json({
            success: true,
            message: 'Group updated successfully'
        });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating group',
            error: error.message
        });
    }
};

/**
 * @desc    Close group
 * @route   POST /api/groups/:id/close
 * @access  Private (Admin only)
 */
export const closeGroup = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = groupDoc.data();

        if (group.adminId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only group admin can close the group'
            });
        }

        if (group.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Group is already closed'
            });
        }

        // ── Financial-activity guard ──────────────────────────────────────────
        // The group can only be closed if NO paid contribution has ever been made.
        const paidContributionsForClose = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', req.params.id)
            .where('status', '==', 'paid')
            .limit(1)
            .get();

        if (!paidContributionsForClose.empty) {
            return res.status(403).json({
                success: false,
                message: 'Action not allowed: Financial activity already started.'
            });
        }

        await groupRef.update({
            status: 'closed',
            closedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        res.status(200).json({
            success: true,
            message: 'Group closed successfully'
        });
    } catch (error) {
        console.error('Close group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error closing group',
            error: error.message
        });
    }
};

/**
 * @desc    Get group financial summary
 * @route   GET /api/groups/:id/financial-summary
 * @access  Private
 */
export const getFinancialSummary = async (req, res) => {
    try {
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(req.params.id).get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Check if user is a member
        const isMember = group.members && group.members.some(
            m => m.userId === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Count completed payouts from group members (hasReceivedPayout is updated by
        // both the manual simulate-payout endpoint AND the automated cron job, making
        // it the single reliable source of truth — the payouts collection may not be
        // updated by all payout paths).
        const completedPayouts = (group.members || []).filter(m => m.hasReceivedPayout).length;

        // Find next payout recipient (lowest payoutTurn not yet paid)
        const nextPayoutMember = [...(group.members || [])]
            .filter(m => !m.hasReceivedPayout)
            .sort((a, b) => Number(a.payoutTurn) - Number(b.payoutTurn))[0];

        let nextPayoutRecipient = null;
        if (nextPayoutMember) {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(nextPayoutMember.userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                nextPayoutRecipient = {
                    userId: userDoc.id,
                    fullName: userData.fullName,
                    payoutTurn: nextPayoutMember.payoutTurn
                };
            }
        }

        // Calculate completion percentage
        const completionPercentage = group.totalCycles > 0
            ? Math.round((completedPayouts / group.totalCycles) * 100)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                totalContributed: group.totalContributed || 0,
                currentEscrowBalance: group.currentEscrowBalance || 0,
                totalPayout: group.totalPayout || 0,
                contributionAmount: group.contributionAmount,
                currentCycle: group.currentCycle,
                totalCycles: group.totalCycles,
                completedCycles: completedPayouts,
                completionPercentage,
                nextPayoutRecipient,
                memberCount: group.members.length,
                maxMembers: group.maxMembers
            }
        });
    } catch (error) {
        console.error('Financial summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching financial summary',
            error: error.message
        });
    }
};

/**
 * @desc    Preview group info by join code (before committing to join)
 * @route   GET /api/groups/preview?code=XXXXXX
 * @access  Private
 */
export const previewGroup = async (req, res) => {
    try {
        const { code } = req.query;

        if (!code || code.trim().length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'A valid 6-character join code is required'
            });
        }

        const groupQuery = await db.collection(COLLECTIONS.GROUPS)
            .where('joinCode', '==', code.toUpperCase().trim())
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (groupQuery.empty) {
            return res.status(404).json({
                success: false,
                message: 'No active group found with that join code'
            });
        }

        const groupDoc = groupQuery.docs[0];
        const group = groupDoc.data();

        // Check if the requesting user is already a member
        const alreadyMember = group.members &&
            group.members.some(m => m.userId === req.user.id);

        // Block preview for individual (daily) savings — they're private
        if (group.savingsMode === 'individual' || !group.isInviteEnabled) {
            return res.status(403).json({
                success: false,
                message: 'This is a private personal savings goal'
            });
        }

        const isFull = group.members.length >= group.maxMembers;

        res.status(200).json({
            success: true,
            data: {
                preview: {
                    id: groupDoc.id,
                    name: group.name,
                    description: group.description || null,
                    contributionAmount: group.contributionAmount,
                    contributionFrequency: group.contributionFrequency,
                    contributionPeriodMonths: group.contributionPeriodMonths,
                    totalCycles: group.totalCycles,
                    memberCount: group.members.length,
                    maxMembers: group.maxMembers,
                    isFull,
                    alreadyMember,
                    startDate: group.startDate,
                    endDate: group.endDate,
                    latePaymentPenalty: group.latePaymentPenalty || 0
                }
            }
        });
    } catch (error) {
        console.error('Preview group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group preview',
            error: error.message
        });
    }
};

/**
 * Helper: Reassign sequential payout turns after a member is removed
 */
const reassignPayoutTurns = (members) => {
    // Sort by existing payoutTurn, preserving relative order
    const sorted = [...members].sort((a, b) => a.payoutTurn - b.payoutTurn);
    return sorted.map((member, index) => ({
        ...member,
        payoutTurn: index + 1
    }));
};

/**
 * @desc    Leave a group (member self-exit)
 * @route   DELETE /api/groups/:id/leave
 * @access  Private
 */
export const leaveGroup = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = groupDoc.data();

        // Check the group is still active
        if (group.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Cannot leave a closed group'
            });
        }

        // Verify the user is actually a member
        const memberIndex = group.members
            ? group.members.findIndex(m => m.userId === req.user.id)
            : -1;

        if (memberIndex === -1) {
            return res.status(400).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Admin cannot leave — they must close the group instead
        if (group.adminId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Group admins cannot leave. Please close the group instead.'
            });
        }

        // Block leaving once ANY contribution has been made for this group.
        // Members may only leave during the pre-contribution (setup) phase.
        const existingContributions = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', req.params.id)
            .limit(1)
            .get();

        if (!existingContributions.empty) {
            return res.status(403).json({
                success: false,
                message: 'You cannot leave this group once contributions have started. Contact the group admin if you need to be removed.'
            });
        }

        // Remove member and reassign payout turns
        const updatedMembers = reassignPayoutTurns(
            group.members.filter(m => m.userId !== req.user.id)
        );

        const memberCount = updatedMembers.length;
        const newTotalPerCycle = group.contributionAmount * memberCount;
        const newTotalPayout = group.contributionAmount * memberCount;

        await groupRef.update(prepareForFirestore({
            members: updatedMembers,
            totalPerCycle: newTotalPerCycle,
            totalPayout: newTotalPayout,
            updatedAt: serverTimestamp()
        }));

        res.status(200).json({
            success: true,
            message: 'You have successfully left the group'
        });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error leaving group',
            error: error.message
        });
    }
};

/**
 * @desc    Remove a member from a group (admin only)
 * @route   DELETE /api/groups/:id/members/:memberId
 * @access  Private (Admin only)
 */
export const removeMember = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = groupDoc.data();

        // Only admin can remove members
        if (group.adminId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only the group admin can remove members'
            });
        }

        const { memberId } = req.params;

        // Admin cannot remove themselves
        if (memberId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Admin cannot remove themselves. Please close the group instead.'
            });
        }

        // Verify the target is actually a member
        const targetMember = group.members
            ? group.members.find(m => m.userId === memberId)
            : null;

        if (!targetMember) {
            return res.status(404).json({
                success: false,
                message: 'Member not found in this group'
            });
        }

        // Cannot remove a member who has already received their payout
        if (targetMember.hasReceivedPayout) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove a member who has already received their payout'
            });
        }

        // ── Financial-activity guard ──────────────────────────────────────────
        // Removal is blocked once ANY paid contribution exists for this group.
        const paidContributionsForRemove = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', req.params.id)
            .where('status', '==', 'paid')
            .limit(1)
            .get();

        if (!paidContributionsForRemove.empty) {
            return res.status(403).json({
                success: false,
                message: 'Action not allowed: Financial activity already started.'
            });
        }

        if (group.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove members from a closed group'
            });
        }

        // Remove member and reassign payout turns
        const updatedMembers = reassignPayoutTurns(
            group.members.filter(m => m.userId !== memberId)
        );

        const memberCount = updatedMembers.length;
        const newTotalPerCycle = group.contributionAmount * memberCount;
        const newTotalPayout = group.contributionAmount * memberCount;

        await groupRef.update(prepareForFirestore({
            members: updatedMembers,
            totalPerCycle: newTotalPerCycle,
            totalPayout: newTotalPayout,
            updatedAt: serverTimestamp()
        }));

        res.status(200).json({
            success: true,
            message: 'Member removed successfully'
        });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing member',
            error: error.message
        });
    }
};

/**
 * @desc    Simulate / manually trigger the next automatic payout cycle for a group
 * @route   POST /api/groups/:id/simulate-payout
 * @access  Private (Admin only)
 *
 * Steps (in a single atomic Firestore transaction via walletService.processPayout):
 *  1. Find the next eligible member  → lowest payoutTurn where hasReceivedPayout === false
 *  2. Validate escrow ≥ totalPayout (gross)
 *  3. processPayout() — deducts escrow, credits net to wallet, credits commission to company wallet,
 *     and logs both transactions atomically
 *  4. Mark member hasReceivedPayout = true
 *  5. Increment currentCycle
 *  6. Detect if all members have been paid (rotation complete)
 */
export const simulatePayout = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Only allow group savings (not daily/individual)
        if (group.savingsMode === 'individual' || group.contributionFrequency === 'daily') {
            return res.status(400).json({
                success: false,
                message: 'Payout simulation is only available for group savings'
            });
        }

        // ── CONTRIBUTION COMPLETENESS GATE ────────────────────────────────────
        // Payout must only execute if ALL members have status = 'paid' for the
        // current cycle AND the group cycle status is 'active'.
        if (group.cycleStatus === 'delayed') {
            return res.status(400).json({
                success: false,
                message: 'Payout is blocked: group cycle is delayed due to overdue contributions. All members must complete their contributions before payout can proceed.'
            });
        }

        const currentCycleForGate = group.currentCycle || 1;
        const { allPaid: allMembersPaid, blockedUsers } = await payoutScheduler.verifyAllMembersPaid(group.id, currentCycleForGate);
        if (!allMembersPaid) {
            return res.status(400).json({
                success: false,
                message: `Payout blocked: ${blockedUsers.length} member(s) have not completed contributions for cycle ${currentCycleForGate}.`,
                data: {
                    blockedUsers,
                    hint: 'All members must have contribution status "paid" before a payout can execute.'
                }
            });
        }
        // ── END GATE ──────────────────────────────────────────────────────────

        // ── Find next eligible recipient ──────────────────────────────────────
        // Sort ascending by payoutTurn, pick the first member who hasn't received a payout yet
        const eligibleMembers = (group.members || [])
            .filter(m => !m.hasReceivedPayout)
            .sort((a, b) => a.payoutTurn - b.payoutTurn);

        if (eligibleMembers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'All members have already received their payout. Rotation is complete.'
            });
        }

        const nextRecipient = eligibleMembers[0];

        // ── Determine gross payout amount ─────────────────────────────────────
        // Use the pre-calculated totalPayout (member_count × contributionAmount, in kobo)
        const grossAmount = group.totalPayout || (group.contributionAmount * group.members.length);

        // ── Validate escrow has sufficient funds ──────────────────────────────
        const escrowBalance = group.currentEscrowBalance || 0;
        if (escrowBalance < grossAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient escrow balance. Required: ${formatKoboAsNaira(grossAmount)}, Available: ${formatKoboAsNaira(escrowBalance)}`,
                data: {
                    required: grossAmount,
                    available: escrowBalance,
                    shortfall: grossAmount - escrowBalance
                }
            });
        }

        // ── Process payout (atomic: escrow → wallet + commission → company) ───
        // This calls walletService.processPayout which handles everything in one Firestore transaction
        const payoutResult = await walletService.processPayout(
            nextRecipient.userId,
            group.id,
            grossAmount
        );

        const { grossPayout, commission, netPayout, commissionRate } = payoutResult.commission;

        // ── Mark member as paid & advance cycle ───────────────────────────────
        const updatedMembers = group.members.map(m => {
            if (m.userId === nextRecipient.userId) {
                return { ...m, hasReceivedPayout: true };
            }
            return m;
        });

        const allPaid = updatedMembers.every(m => m.hasReceivedPayout);
        const newCycle = (group.currentCycle || 1) + 1;

        // Roll the cycle engine forward so Firestore stays in sync with autoProcessPayout
        let cycleRollUpdate = {};
        try {
            cycleRollUpdate = rollForwardCycle(group);
        } catch (rollErr) {
            console.warn(`⚠️  simulatePayout: could not roll cycle for group ${group.id}: ${rollErr.message}`);
        }

        await groupRef.update(prepareForFirestore({
            members: updatedMembers,
            currentCycle: newCycle,
            ...(cycleRollUpdate.cycle_start_date ? {
                cycle_start_date: cycleRollUpdate.cycle_start_date,
                cycle_end_date:   cycleRollUpdate.cycle_end_date,
                deduction_date:   cycleRollUpdate.deduction_date
            } : {}),
            // If every member has received a payout the full rotation is done
            ...(allPaid ? { status: 'closed', closedAt: serverTimestamp() } : {}),
            updatedAt: serverTimestamp()
        }));

        if (cycleRollUpdate.cycle_start_date) {
            console.log(`↺ simulatePayout: cycle rolled forward → start=${cycleRollUpdate.cycle_start_date}, end=${cycleRollUpdate.cycle_end_date}`);
        }

        // ── Fetch updated company wallet balance for response ─────────────────
        const configDoc = await db.collection(COLLECTIONS.SETTINGS).doc('platform_config').get();
        const companyWalletBalance = configDoc.exists
            ? (configDoc.data().company_wallet_balance || 0)
            : 0;

        // ── Fetch recipient user details for display ──────────────────────────
        const recipientDoc = await db.collection(COLLECTIONS.USERS).doc(nextRecipient.userId).get();
        const recipientName = recipientDoc.exists ? recipientDoc.data().fullName : nextRecipient.userId;

        console.log(`✅ Simulation: Paid ${formatKoboAsNaira(netPayout)} to ${recipientName} (${formatKoboAsNaira(commission)} commission collected)`);

        return res.status(200).json({
            success: true,
            message: `Payout cycle ${group.currentCycle} processed successfully`,
            data: {
                cycleProcessed: group.currentCycle,
                recipient: {
                    userId: nextRecipient.userId,
                    fullName: recipientName,
                    payoutTurn: nextRecipient.payoutTurn
                },
                payoutBreakdown: {
                    grossPayout,
                    commissionRate: `${commissionRate}%`,
                    commissionDeducted: commission,
                    netPayoutReceived: netPayout,
                    // Human-readable Naira equivalents (for display only)
                    grossPayoutNaira: formatKoboAsNaira(grossPayout),
                    commissionNaira: formatKoboAsNaira(commission),
                    netPayoutNaira: formatKoboAsNaira(netPayout)
                },
                groupState: {
                    currentCycle: newCycle,
                    totalCycles: group.totalCycles,
                    allPayoutsComplete: allPaid,
                    groupStatus: allPaid ? 'closed' : 'active',
                    remainingRecipients: updatedMembers.filter(m => !m.hasReceivedPayout).length
                },
                wallets: {
                    recipientNewBalance: payoutResult.wallet?.availableBalance || 0,
                    recipientNewBalanceNaira: formatKoboAsNaira(payoutResult.wallet?.availableBalance || 0),
                    companyWalletBalance,
                    companyWalletBalanceNaira: formatKoboAsNaira(companyWalletBalance)
                }
            }
        });
    } catch (error) {
        console.error('Simulate payout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error simulating payout',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROTATION ORDER CHANGE — Democratic 3-step flow
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper: returns true if ANY payout has been processed for the group.
 * Uses members.hasReceivedPayout as the single source of truth.
 */
const hasPayoutStarted = (group) =>
    (group.members || []).some(m => m.hasReceivedPayout === true);

/**
 * @desc    Member requests a rotation (payout-position) swap
 * @route   POST /api/groups/:id/rotation-change
 * @access  Private (any group member)
 *
 * Body: { targetUserId: string }
 *
 * Rules:
 *  - No payout may have started yet.
 *  - Requester and target must both be members.
 *  - Only one pending request is allowed at a time.
 *  - Requester is auto-approved; all OTHER members must then approve.
 */
export const requestRotationChange = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Must be a member
        const isMember = (group.members || []).some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Block once payout cycle has begun
        if (hasPayoutStarted(group)) {
            return res.status(403).json({
                success: false,
                message: 'Action not allowed: Financial activity already started.'
            });
        }

        // Only one pending request at a time
        if (group.rotationChangeRequest && group.rotationChangeRequest.status === 'pending') {
            return res.status(409).json({
                success: false,
                message: 'A rotation change request is already pending. All members must approve or cancel it first.'
            });
        }

        const { targetUserId } = req.body;
        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'targetUserId is required' });
        }
        if (targetUserId === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot request a swap with yourself' });
        }

        const targetMember = (group.members || []).find(m => m.userId === targetUserId);
        if (!targetMember) {
            return res.status(404).json({ success: false, message: 'Target user is not a member of this group' });
        }

        // Build initial approvals map — requester is auto-approved
        const approvals = {};
        (group.members || []).forEach(m => {
            approvals[m.userId] = m.userId === req.user.id;
        });

        const requestId = `rcr_${Date.now()}`;
        const rotationChangeRequest = {
            id: requestId,
            requestedBy: req.user.id,
            targetUserId,
            status: 'pending',
            approvals,
            createdAt: new Date().toISOString()
        };

        await groupRef.update(prepareForFirestore({
            rotationChangeRequest,
            updatedAt: serverTimestamp()
        }));

        res.status(201).json({
            success: true,
            message: 'Rotation change request submitted. All members must approve before the admin can apply it.',
            data: { rotationChangeRequest }
        });
    } catch (error) {
        console.error('Request rotation change error:', error);
        res.status(500).json({ success: false, message: 'Error submitting rotation change request', error: error.message });
    }
};

/**
 * @desc    Group member records their approval for the pending rotation request
 * @route   POST /api/groups/:id/rotation-change/:requestId/approve
 * @access  Private (any group member)
 */
export const approveRotationChange = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Must be a member
        const isMember = (group.members || []).some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Block once payout cycle has begun
        if (hasPayoutStarted(group)) {
            return res.status(403).json({
                success: false,
                message: 'Action not allowed: Financial activity already started.'
            });
        }

        const { requestId } = req.params;
        const request = group.rotationChangeRequest;

        if (!request || request.id !== requestId) {
            return res.status(404).json({ success: false, message: 'Rotation change request not found' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Request is already "${request.status}" and cannot be approved`
            });
        }
        if (request.approvals[req.user.id] === true) {
            return res.status(400).json({ success: false, message: 'You have already approved this request' });
        }

        // Record approval
        const updatedApprovals = { ...request.approvals, [req.user.id]: true };
        const allApproved = Object.values(updatedApprovals).every(v => v === true);

        const updatedRequest = {
            ...request,
            approvals: updatedApprovals,
            ...(allApproved ? { status: 'approved' } : {})
        };

        await groupRef.update(prepareForFirestore({
            rotationChangeRequest: updatedRequest,
            updatedAt: serverTimestamp()
        }));

        res.status(200).json({
            success: true,
            message: allApproved
                ? 'All members have approved. The admin can now apply the rotation change.'
                : 'Your approval has been recorded.',
            data: { rotationChangeRequest: updatedRequest, allApproved }
        });
    } catch (error) {
        console.error('Approve rotation change error:', error);
        res.status(500).json({ success: false, message: 'Error approving rotation change', error: error.message });
    }
};

/**
 * @desc    Admin atomically applies an approved rotation-order swap
 * @route   POST /api/groups/:id/rotation-change/:requestId/apply
 * @access  Private (Admin only)
 *
 * Swaps the payoutTurn values of requestedBy ↔ targetUserId inside a single
 * Firestore transaction to guarantee atomicity.
 */
export const applyRotationChange = async (req, res) => {
    try {
        const groupRef = db.collection(COLLECTIONS.GROUPS).doc(req.params.id);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Admin check
        if (group.adminId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Only the group admin can apply a rotation change' });
        }

        // Block once payout cycle has begun
        if (hasPayoutStarted(group)) {
            return res.status(403).json({
                success: false,
                message: 'Action not allowed: Financial activity already started.'
            });
        }

        const { requestId } = req.params;
        const request = group.rotationChangeRequest;

        if (!request || request.id !== requestId) {
            return res.status(404).json({ success: false, message: 'Rotation change request not found' });
        }

        if (request.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: request.status === 'pending'
                    ? 'Not all members have approved this request yet.'
                    : `Request is already "${request.status}" and cannot be applied.`
            });
        }

        // Double-check all approvals server-side (race-condition guard)
        const allApproved = Object.values(request.approvals).every(v => v === true);
        if (!allApproved) {
            return res.status(403).json({
                success: false,
                message: 'Not all members have approved this request yet.'
            });
        }

        // ── Atomic swap inside a Firestore transaction ────────────────────────
        await db.runTransaction(async (transaction) => {
            const freshDoc = await transaction.get(groupRef);
            const freshMembers = freshDoc.data().members || [];

            const requesterMember = freshMembers.find(m => m.userId === request.requestedBy);
            const targetMemberFresh = freshMembers.find(m => m.userId === request.targetUserId);

            if (!requesterMember || !targetMemberFresh) {
                throw new Error('One or both members involved in the swap no longer exist in the group.');
            }

            const requesterTurn = Number(requesterMember.payoutTurn);
            const targetTurn = Number(targetMemberFresh.payoutTurn);

            const swappedMembers = freshMembers.map(m => {
                if (m.userId === request.requestedBy) return { ...m, payoutTurn: targetTurn };
                if (m.userId === request.targetUserId) return { ...m, payoutTurn: requesterTurn };
                return m;
            });

            transaction.update(groupRef, prepareForFirestore({
                members: swappedMembers,
                rotationChangeRequest: {
                    ...request,
                    status: 'applied',
                    appliedAt: new Date().toISOString(),
                    appliedBy: req.user.id
                },
                updatedAt: serverTimestamp()
            }));
        });

        // ── Compute the new next payout recipient ─────────────────────────────
        // Re-read the freshly-written group so the sort is based on swapped turns.
        const updatedDoc = await groupRef.get();
        const updatedGroup = { id: updatedDoc.id, ...updatedDoc.data() };

        const nextPayoutMember = [...(updatedGroup.members || [])]
            .filter(m => !m.hasReceivedPayout)
            .sort((a, b) => Number(a.payoutTurn) - Number(b.payoutTurn))[0];

        let nextPayoutRecipient = null;
        if (nextPayoutMember) {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(nextPayoutMember.userId).get();
            if (userDoc.exists) {
                nextPayoutRecipient = {
                    userId: userDoc.id,
                    fullName: userDoc.data().fullName,
                    payoutTurn: nextPayoutMember.payoutTurn
                };
            }
        }

        res.status(200).json({
            success: true,
            message: 'Rotation order updated successfully.',
            data: {
                updatedMembers: updatedGroup.members.map(m => ({
                    userId: m.userId,
                    payoutTurn: m.payoutTurn
                })),
                rotationChangeRequest: updatedGroup.rotationChangeRequest,
                nextPayoutRecipient   // ← new: lets the frontend update immediately
            }
        });
    } catch (error) {
        console.error('Apply rotation change error:', error);
        res.status(500).json({ success: false, message: 'Error applying rotation change', error: error.message });
    }
};
