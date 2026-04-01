import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp } from '../db/converters.js';
import * as walletService from './walletService.js';
import { formatKoboAsNaira } from '../utils/currency.js';
import {
    calcCycleEndDate,
    isPayoutDay,
    rollForwardCycle
} from '../utils/cycleEngine.js';

/**
 * Payout Scheduler Service (Firestore)
 * Handles automated payout processing for group savings cycles
 */

/**
 * Calculate payout date (= cycle end date) using fixed-day intervals.
 * monthly → +30 days, weekly → +7 days
 */
function calculatePayoutDate(cycleStartDate, frequency) {
    return calcCycleEndDate(cycleStartDate, frequency);
}

/**
 * Create payout schedules for a group
 * Called when group is created
 */
export const scheduleGroupPayouts = async (groupId) => {
    try {
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) throw new Error('Group not found');

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Skip payout scheduling for individual/daily savings (no rotation)
        if (group.savingsMode === 'individual' || group.contributionFrequency === 'daily') {
            console.log(`Skipping payout scheduling for individual savings group ${groupId}`);
            return { success: true, count: 0, reason: 'individual_savings' };
        }

        const startDate = new Date(group.startDate);
        const batch = db.batch();
        let count = 0;

        for (const member of group.members) {
            const cycle = member.payoutTurn;

            // Compute cycle start for this member's payout turn:
            // cycleStart = groupStart + (turn - 1) × cycleLength days
            const groupStart = new Date(group.startDate?.toDate ? group.startDate.toDate() : group.startDate);
            const cycleLen = group.contributionFrequency === 'weekly' ? 7 : 30;
            const memberCycleStart = new Date(groupStart);
            memberCycleStart.setUTCDate(memberCycleStart.getUTCDate() + cycleLen * (cycle - 1));
            const scheduledDate = calculatePayoutDate(memberCycleStart, group.contributionFrequency);

            // Check if payout already scheduled
            const existing = await db.collection(COLLECTIONS.PAYOUTS)
                .where('groupId', '==', groupId)
                .where('recipientId', '==', member.userId)
                .where('cycleNumber', '==', cycle)
                .limit(1)
                .get();

            if (existing.empty) {
                const ref = db.collection(COLLECTIONS.PAYOUTS).doc();
                batch.set(ref, prepareForFirestore({
                    groupId,
                    recipientId: member.userId,
                    cycleNumber: cycle,
                    amount: group.totalPayout || (group.contributionAmount * group.maxMembers),
                    scheduledDate: scheduledDate.toISOString(),
                    status: 'scheduled',
                    isAutomated: true,
                    paidAt: null,
                    processedAt: null,
                    walletTransactionId: null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }));
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`Created ${count} payout schedules for group ${groupId}`);
        }

        return { success: true, count };
    } catch (error) {
        console.error('Error scheduling payouts:', error);
        throw error;
    }
};

/**
 * Process scheduled payouts - auto-transfer if escrow has funds
 * Called by cron job
 */
export const processScheduledPayouts = async () => {
    try {
        const now = new Date();

        // Find all scheduled payouts that are due
        const snapshot = await db.collection(COLLECTIONS.PAYOUTS)
            .where('status', '==', 'scheduled')
            .get();

        // Pre-load group cache for isPayoutDay checks
        const groupCache = {};
        const getGroup = async (groupId) => {
            if (!groupCache[groupId]) {
                const gDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
                groupCache[groupId] = gDoc.exists ? { id: gDoc.id, ...gDoc.data() } : null;
            }
            return groupCache[groupId];
        };

        const duePayouts = [];
        for (const doc of snapshot.docs) {
            const p = { id: doc.id, ref: doc.ref, ...doc.data() };
            // Basic date guard
            if (new Date(p.scheduledDate) > now) continue;
            // Additional cycle-engine gate: is today the payout day for this group?
            const group = await getGroup(p.groupId);
            if (group && !isPayoutDay(group, now)) continue;
            duePayouts.push(p);
        }

        console.log(`Processing ${duePayouts.length} due payouts...`);

        let processed = 0, succeeded = 0, failed = 0;

        for (const payout of duePayouts) {
            try {
                const result = await autoProcessPayout(payout);
                processed++;
                if (result.success) succeeded++;
                else failed++;
            } catch (error) {
                console.error(`Error processing payout ${payout.id}:`, error);
                failed++;
            }
        }

        console.log(`Auto-payout complete: ${succeeded} succeeded, ${failed} failed out of ${processed} processed`);
        return { processed, succeeded, failed };
    } catch (error) {
        console.error('Error in processScheduledPayouts:', error);
        throw error;
    }
};

/**
 * Verify that all members of a group have paid for the specified cycle.
 * Returns { allPaid: true } or { allPaid: false, blockedUsers: [...] }.
 *
 * NOTE: A missing schedule entry (member added after schedules were created) is
 * treated as NOT blocking — only explicit 'failed' or 'overdue' records block payout.
 */
export const verifyAllMembersPaid = async (groupId, cycleNumber) => {
    const snapshot = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
        .where('groupId', '==', groupId)
        .where('cycleNumber', '==', cycleNumber)
        .get();

    const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Any 'failed' or 'overdue' schedule blocks payout
    const blocked = schedules.filter(s => s.status === 'failed' || s.status === 'overdue');

    return {
        allPaid: blocked.length === 0,
        schedules,
        blockedUsers: blocked.map(s => ({
            userId: s.userId,
            status: s.status,
            graceDeadline: s.graceDeadline
        }))
    };
};

/**
 * Attempt to auto-process a payout.
 *
 * ⚠️  CRITICAL GATE: Payout only executes when:
 *   1. group.cycleStatus !== 'delayed'
 *   2. ALL contribution_schedules for this cycle have status !== 'failed' and !== 'overdue'
 *
 * If either condition fails, the payout record is set to 'blocked_incomplete_contributions'
 * and the function returns { success: false }.
 */
export const autoProcessPayout = async (payout) => {
    try {
        // ── PRE-FLIGHT: Contribution Completeness Gate ──────────────────────────
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(payout.groupId).get();
        if (!groupDoc.exists) throw new Error('Group not found');
        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Block if the group cycle is already marked delayed
        if (group.cycleStatus === 'delayed') {
            await payout.ref.update(prepareForFirestore({
                status: 'blocked_incomplete_contributions',
                blockReason: 'Group cycle is marked as delayed due to overdue contributions.',
                updatedAt: serverTimestamp()
            }));
            console.log(`⛔ Payout ${payout.id} blocked — group cycle is delayed`);
            return { success: false, reason: 'cycle_delayed' };
        }

        // Check that every member has paid for this cycle
        const { allPaid, blockedUsers } = await verifyAllMembersPaid(payout.groupId, payout.cycleNumber);
        if (!allPaid) {
            await payout.ref.update(prepareForFirestore({
                status: 'blocked_incomplete_contributions',
                blockReason: `${blockedUsers.length} member(s) have not completed their contribution.`,
                blockedUsers,
                updatedAt: serverTimestamp()
            }));
            console.log(`⛔ Payout ${payout.id} blocked — ${blockedUsers.length} member(s) with status: ${blockedUsers.map(u => u.status).join(', ')}`);
            return { success: false, reason: 'cycle_incomplete', blockedUsers };
        }
        // ── END GATE ────────────────────────────────────────────────────────────

        // Mark as processing
        await payout.ref.update(prepareForFirestore({ status: 'processing', updatedAt: serverTimestamp() }));

        // Check if group has sufficient escrow balance
        if ((group.currentEscrowBalance || 0) < payout.amount) {
            await payout.ref.update(prepareForFirestore({ status: 'insufficient_funds', updatedAt: serverTimestamp() }));
            console.log(`✗ Insufficient escrow for payout to ${payout.recipientId} - Required: ${formatKoboAsNaira(payout.amount)}, Available: ${formatKoboAsNaira(group.currentEscrowBalance || 0)}`);
            return { success: false, reason: 'insufficient_escrow' };
        }

        // Transfer from group escrow to recipient wallet
        const payoutResult = await walletService.processPayout(
            payout.recipientId,
            payout.groupId,
            payout.amount
        );

        // Update payout record with commission breakdown
        await payout.ref.update(prepareForFirestore({
            status: 'completed',
            paidAt: serverTimestamp(),
            processedAt: serverTimestamp(),
            walletTransactionId: payoutResult.transaction?.id || null,
            // Commission breakdown for transparency
            grossAmount: payout.amount,
            commission: payoutResult.commission?.commission || 0,
            netPayout: payoutResult.commission?.netPayout || payout.amount,
            commissionRate: payoutResult.commission?.commissionRate || 0,
            updatedAt: serverTimestamp()
        }));

        // Update member payout status in group
        const updatedMembers = group.members.map(m => {
            if (m.userId === payout.recipientId) {
                return { ...m, hasReceivedPayout: true };
            }
            return m;
        });

        // Roll cycle forward (new cycle_start = old cycle_end, new cycle_end = +cycleLength days)
        let cycleRollUpdate = {};
        try {
            cycleRollUpdate = rollForwardCycle(group);
        } catch (rollErr) {
            // If group doesn't have cycle_end_date yet (legacy), skip the roll
            console.warn(`⚠️  Could not roll cycle forward for group ${payout.groupId}: ${rollErr.message}`);
        }

        await db.collection(COLLECTIONS.GROUPS).doc(payout.groupId).update(
            prepareForFirestore({
                members: updatedMembers,
                ...(cycleRollUpdate.cycle_start_date ? {
                    cycle_start_date: cycleRollUpdate.cycle_start_date,
                    cycle_end_date:   cycleRollUpdate.cycle_end_date,
                    deduction_date:   cycleRollUpdate.deduction_date
                } : {}),
                updatedAt: serverTimestamp()
            })
        );

        console.log(`✓ Paid ${formatKoboAsNaira(payout.amount)} to ${payout.recipientId} from group ${group.name}`);
        if (cycleRollUpdate.cycle_start_date) {
            console.log(`↺ Cycle rolled forward: new start=${cycleRollUpdate.cycle_start_date}, end=${cycleRollUpdate.cycle_end_date}`);
        }
        return { success: true };
    } catch (error) {
        console.error('Error in autoProcessPayout:', error);
        await payout.ref.update(prepareForFirestore({ status: 'failed', updatedAt: serverTimestamp() }));
        throw error;
    }
};

/**
 * Get upcoming payouts for a user
 */
export const getUserUpcomingPayouts = async (userId, limit = 10) => {
    try {
        const snapshot = await db.collection(COLLECTIONS.PAYOUTS)
            .where('recipientId', '==', userId)
            .where('status', 'in', ['scheduled', 'processing'])
            .orderBy('scheduledDate', 'asc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting user payouts:', error);
        throw error;
    }
};

export default {
    scheduleGroupPayouts,
    processScheduledPayouts,
    autoProcessPayout,
    verifyAllMembersPaid,
    getUserUpcomingPayouts
};
