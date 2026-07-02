import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp } from '../db/converters.js';
import { calculateDueDate, isContributionLate } from '../utils/helpers.js';
import * as walletService from '../services/walletService.js';
import { convertNairaToKobo } from '../utils/currency.js';

/**
 * @desc    Submit contribution with wallet payment (WALLET-ONLY SYSTEM)
 * @route   POST /api/contributions
 * @access  Private
 */
export const submitContribution = async (req, res) => {
    try {
        const { groupId, cycleNumber, amount, notes } = req.body;

        // Verify group exists and user is a member
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };
        const isMember = group.members && group.members.some(m => m.userId === req.user.id);

        if (!isMember) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        // Check if a SUCCESSFUL (paid/scheduled) contribution already exists for this cycle.
        // We intentionally exclude 'missed' and 'failed' records so the user can retry
        // after a failed payment attempt.
        const existingQuery = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', groupId)
            .where('userId', '==', req.user.id)
            .get();

        const alreadyContributed = existingQuery.docs.some(doc => {
            const data = doc.data();
            return (
                data.cycleNumber === Number(cycleNumber) &&
                !['missed', 'failed'].includes(data.status)
            );
        });

        if (alreadyContributed) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a contribution for this cycle'
            });
        }

        // Calculate due date and late status
        // group.startDate may be a Firestore Timestamp - convert it to a JS Date first
        const startDateJS = group.startDate?.toDate
            ? group.startDate.toDate()
            : new Date(group.startDate);
        const dueDate = calculateDueDate(startDateJS, cycleNumber, group.contributionFrequency);
        const late = isContributionLate(dueDate);

        // Convert user-supplied amount from Naira to kobo
        // Penalty is already in kobo (stored that way when group was created)
        const amountKobo = convertNairaToKobo(parseFloat(amount));
        const penaltyAmountKobo = late ? (group.latePaymentPenalty || 0) : 0;
        const totalAmount = amountKobo + penaltyAmountKobo;

        // WALLET-ONLY SYSTEM: Attempt immediate payment from wallet
        try {
            // Create contribution record first
            const contributionData = prepareForFirestore({
                groupId,
                userId: req.user.id,
                cycleNumber: Number(cycleNumber),
                amount: totalAmount,        // stored in kobo
                penaltyAmount: penaltyAmountKobo, // stored in kobo
                dueDate: dueDate.toISOString(),
                isLate: late,
                notes: notes || null,
                status: 'scheduled',
                paidAt: null,
                walletTransactionId: null,
                isAutoDebited: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const contributionRef = await db.collection(COLLECTIONS.CONTRIBUTIONS).add(contributionData);

            // Attempt wallet debit
            const walletResult = await walletService.debitForContribution(
                req.user.id,
                groupId,
                totalAmount,
                contributionRef.id,
                { cycleNumber, groupName: group.name }
            );

            // Payment successful - update contribution
            await contributionRef.update(prepareForFirestore({
                status: 'paid',
                paidAt: serverTimestamp(),
                walletTransactionId: walletResult.transaction?.id || null,
                updatedAt: serverTimestamp()
            }));

            // ── Mark the matching schedule entry as completed so the auto-debit
            //    cron does NOT attempt to charge this member again for this cycle ──
            const scheduleSnap = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
                .where('groupId', '==', groupId)
                .where('userId', '==', req.user.id)
                .where('cycleNumber', '==', Number(cycleNumber))
                .where('status', '==', 'pending')
                .limit(1)
                .get();

            if (!scheduleSnap.empty) {
                await scheduleSnap.docs[0].ref.update(prepareForFirestore({
                    status: 'completed',
                    completedManually: true,
                    contributionId: contributionRef.id,
                    updatedAt: serverTimestamp()
                }));
            }

            const updatedDoc = await contributionRef.get();

            return res.status(201).json({
                success: true,
                message: 'Contribution paid successfully from your wallet',
                data: {
                    contribution: { id: contributionRef.id, ...updatedDoc.data() },
                    walletBalance: walletResult.wallet.availableBalance
                }
            });

        } catch (walletError) {
            // Insufficient funds or wallet error - create missed contribution
            const contributionData = prepareForFirestore({
                groupId,
                userId: req.user.id,
                cycleNumber: Number(cycleNumber),
                amount: totalAmount,
                dueDate: dueDate.toISOString(),
                isLate: late,
                penaltyAmount: penaltyAmountKobo,
                notes: notes || null,
                status: 'missed',
                paidAt: null,
                walletTransactionId: null,
                isAutoDebited: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const contributionRef = await db.collection(COLLECTIONS.CONTRIBUTIONS).add(contributionData);
            const contributionDoc = await contributionRef.get();

            return res.status(400).json({
                success: false,
                message: walletError.message || 'Insufficient wallet balance',
                data: { contribution: { id: contributionRef.id, ...contributionDoc.data() } }
            });
        }
    } catch (error) {
        console.error('Submit contribution error:', error);
        res.status(500).json({ success: false, message: 'Error submitting contribution', error: error.message });
    }
};

/**
 * @desc    Get all contributions for a group
 * @route   GET /api/contributions/group/:groupId
 * @access  Private
 */
export const getGroupContributions = async (req, res) => {
    try {
        const { groupId } = req.params;

        // Verify group exists and user is a member
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };
        const isMember = group.members && group.members.some(m => m.userId === req.user.id);

        if (!isMember) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', groupId)
            .orderBy('createdAt', 'desc')
            .get();

        const contributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich with user names
        const userCache = {};
        const enriched = await Promise.all(contributions.map(async (c) => {
            if (!userCache[c.userId]) {
                const userDoc = await db.collection(COLLECTIONS.USERS).doc(c.userId).get();
                userCache[c.userId] = userDoc.exists ? { fullName: userDoc.data().fullName, email: userDoc.data().email } : null;
            }
            return { ...c, user: userCache[c.userId] };
        }));

        res.status(200).json({ success: true, data: { contributions: enriched } });
    } catch (error) {
        console.error('Get group contributions error:', error);
        res.status(500).json({ success: false, message: 'Error fetching contributions', error: error.message });
    }
};

/**
 * @desc    Get user's contributions across all groups
 * @route   GET /api/contributions/my
 * @access  Private
 */
export const getMyContributions = async (req, res) => {
    try {
        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('userId', '==', req.user.id)
            .orderBy('createdAt', 'desc')
            .get();

        const contributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich with group names
        const groupCache = {};
        const enriched = await Promise.all(contributions.map(async (c) => {
            if (!groupCache[c.groupId]) {
                const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(c.groupId).get();
                groupCache[c.groupId] = groupDoc.exists ? {
                    name: groupDoc.data().name,
                    contributionAmount: groupDoc.data().contributionAmount,
                    contributionFrequency: groupDoc.data().contributionFrequency
                } : null;
            }
            return { ...c, group: groupCache[c.groupId] };
        }));

        res.status(200).json({ success: true, data: { contributions: enriched } });
    } catch (error) {
        console.error('Get my contributions error:', error);
        res.status(500).json({ success: false, message: 'Error fetching contributions', error: error.message });
    }
};

/**
 * @desc    Get missed contributions for admin review
 * @route   GET /api/contributions/pending/:groupId
 * @access  Private (Admin only)
 */
export const getPendingContributions = async (req, res) => {
    try {
        const { groupId } = req.params;

        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', groupId)
            .where('status', '==', 'missed')
            .orderBy('createdAt', 'asc')
            .get();

        const contributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich with user info
        const enriched = await Promise.all(contributions.map(async (c) => {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(c.userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            return {
                ...c,
                user: userData ? { fullName: userData.fullName, email: userData.email, phoneNumber: userData.phoneNumber } : null
            };
        }));

        res.status(200).json({ success: true, data: { contributions: enriched } });
    } catch (error) {
        console.error('Get pending contributions error:', error);
        res.status(500).json({ success: false, message: 'Error fetching missed contributions', error: error.message });
    }
};

/**
 * @desc    Admin override contribution status
 * @route   PUT /api/contributions/:id/verify
 * @access  Private (Admin only)
 */
export const verifyContribution = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const contribDoc = await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(id).get();
        if (!contribDoc.exists) {
            return res.status(404).json({ success: false, message: 'Contribution not found' });
        }

        const contribution = contribDoc.data();

        // Verify admin is from the same group
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(contribution.groupId).get();
        if (!groupDoc.exists || groupDoc.data().adminId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Only group admin can update contributions' });
        }

        const updates = { updatedAt: serverTimestamp() };
        if (notes) updates.notes = notes;
        if (status && ['paid', 'missed', 'scheduled', 'failed', 'overdue'].includes(status)) updates.status = status;

        await contribDoc.ref.update(prepareForFirestore(updates));
        const updated = await contribDoc.ref.get();

        res.status(200).json({
            success: true,
            message: 'Contribution updated successfully',
            data: { contribution: { id: updated.id, ...updated.data() } }
        });
    } catch (error) {
        console.error('Verify contribution error:', error);
        res.status(500).json({ success: false, message: 'Error updating contribution', error: error.message });
    }
};

/**
 * @desc    Get contribution statistics for a group
 * @route   GET /api/contributions/stats/:groupId
 * @access  Private
 */
export const getContributionStats = async (req, res) => {
    try {
        const { groupId } = req.params;

        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };
        const isMember = group.members && group.members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', groupId)
            .get();

        const contributions = snapshot.docs.map(doc => doc.data());

        // Compute stats in-memory (no MongoDB aggregation needed)
        const statsByStatus = {};
        let lateCount = 0;

        contributions.forEach(c => {
            if (!statsByStatus[c.status]) statsByStatus[c.status] = { count: 0, totalAmount: 0 };
            statsByStatus[c.status].count++;
            statsByStatus[c.status].totalAmount += c.amount || 0;
            if (c.isLate) lateCount++;
        });

        const stats = Object.entries(statsByStatus).map(([status, data]) => ({ status, ...data }));

        res.status(200).json({
            success: true,
            data: {
                stats,
                totalContributions: contributions.length,
                lateContributions: lateCount
            }
        });
    } catch (error) {
        console.error('Get contribution stats error:', error);
        res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
    }
};

/**
 * @desc    Get contribution summary for a user in a group
 * @route   GET /api/contributions/summary/:groupId
 * @access  Private
 */
export const getContributionSummary = async (req, res) => {
    try {
        const { groupId } = req.params;

        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };
        const isMember = group.members && group.members.some(m => m.userId === req.user.id);
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'You are not a member of this group' });
        }

        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', groupId)
            .where('userId', '==', req.user.id)
            .orderBy('cycleNumber', 'asc')
            .get();

        const contributions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const paidContributions = contributions.filter(c => c.status === 'paid').length;
        const missedContributions = contributions.filter(c => c.status === 'missed').length;
        const overdueContributions = contributions.filter(c => c.status === 'overdue').length;
        const failedContributions = contributions.filter(c => c.status === 'failed').length;
        const lateContributions = contributions.filter(c => c.isLate).length;
        const totalAmount = contributions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
        const totalPenalties = contributions.reduce((sum, c) => sum + (c.penaltyAmount || 0), 0);
        const expectedContributions = group.currentCycle || 0;
        const completionRate = expectedContributions > 0 ? ((paidContributions / expectedContributions) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalContributions: contributions.length,
                    paidContributions,
                    missedContributions,
                    overdueContributions,
                    failedContributions,
                    lateContributions,
                    totalAmount,
                    totalPenalties,
                    completionRate: parseFloat(completionRate),
                    expectedContributions,
                    currentCycle: group.currentCycle
                },
                contributions
            }
        });
    } catch (error) {
        console.error('Get contribution summary error:', error);
        res.status(500).json({ success: false, message: 'Error fetching contribution summary', error: error.message });
    }
};
