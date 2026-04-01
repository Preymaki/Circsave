import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp } from '../db/converters.js';
import * as walletService from './walletService.js';
import { formatKoboAsNaira } from '../utils/currency.js';
import { getGracePeriodDays } from './platformConfigService.js';
import {
    sendGraceWarningNotification,
    sendPayoutDelayedNotification
} from './emailService.js';
import {
    calcDeductionDate,
    isDeductionDay,
    isDailyDeductionTime
} from '../utils/cycleEngine.js';

/**
 * Contribution Scheduler Service (Firestore)
 * Handles automated contribution debits and schedule management
 */

/**
 * Calculate due date based on cycle_start_date and frequency
 * Uses fixed-day offsets (via cycleEngine) — no calendar-month rounding.
 */
function calculateDueDate(cycleStartDate, frequency) {
    return calcDeductionDate(cycleStartDate, frequency);
}

/**
 * Helper: return true if lastAttemptDate was today (prevents double-retries per day).
 */
function attemptedToday(lastAttemptDate) {
    if (!lastAttemptDate) return false;
    const last = lastAttemptDate?.toDate ? lastAttemptDate.toDate() : new Date(lastAttemptDate);
    const now = new Date();
    return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()
    );
}

/**
 * Create contribution schedules for all members in a group
 * Called when a group is created or when a new member joins
 */
export const scheduleGroupContributions = async (groupId) => {
    try {
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) throw new Error('Group not found');

        const group = { id: groupDoc.id, ...groupDoc.data() };
        const startDate = new Date(group.startDate);

        // Use batched writes for efficiency
        const batch = db.batch();
        let count = 0;

        for (let cycle = 1; cycle <= group.totalCycles; cycle++) {
            // For each non-daily cycle: deduction date = cycle_start_date + (cycleLength * (cycle-1)) + (deductionOffset - 1) days
            // We anchor to groupStartDate then add whole-cycle offsets, then the per-cycle deduction offset.
            const cycleStartMs = new Date(group.startDate);
            if (typeof cycleStartMs.toDate === 'function') cycleStartMs.setTime(cycleStartMs.toDate().getTime());
            const cycleStart = new Date(cycleStartMs);
            if (group.contributionFrequency !== 'daily') {
                const cycleLen = group.contributionFrequency === 'weekly' ? 7 : 30;
                cycleStart.setUTCDate(cycleStart.getUTCDate() + cycleLen * (cycle - 1));
            }
            const dueDate = calculateDueDate(cycleStart, group.contributionFrequency);

            for (const member of group.members) {
                // Check if schedule already exists
                const existing = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
                    .where('groupId', '==', groupId)
                    .where('userId', '==', member.userId)
                    .where('cycleNumber', '==', cycle)
                    .limit(1)
                    .get();

                if (existing.empty) {
                    const ref = db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES).doc();
                    batch.set(ref, prepareForFirestore({
                        groupId,
                        userId: member.userId,
                        cycleNumber: cycle,
                        dueDate: dueDate.toISOString(),
                        amount: group.contributionAmount,
                        // Contribution status model
                        status: 'pending',
                        attemptCount: 0,
                        lastAttemptDate: null,
                        graceDeadline: null,
                        // Future extension fields (not activated)
                        latePenaltyApplied: false,
                        overdueCount: 0,
                        adminOverrideGranted: false,
                        // Legacy fields kept for backwards compat
                        autoDebitAttempted: false,
                        retryCount: 0,
                        failureReason: null,
                        contributionId: null,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }));
                    count++;
                }
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`Created ${count} contribution schedules for group ${groupId}`);
        }

        return { success: true, count };
    } catch (error) {
        console.error('Error scheduling contributions:', error);
        throw error;
    }
};

/**
 * Process scheduled contributions - auto-debit if funds available
 * Called by cron job (hourly)
 *
 * For monthly/weekly groups: only fires on the group's configured deduction day.
 * Daily groups are handled separately by processDailyDeductions().
 */
export const processScheduledContributions = async () => {
    try {
        const now = new Date();

        // Find all pending schedules that are due and not yet attempted
        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
            .where('status', '==', 'pending')
            .where('autoDebitAttempted', '==', false)
            .get();

        // Pre-load groups needed for isDeductionDay checks (cache by groupId)
        const groupCache = {};
        const getGroup = async (groupId) => {
            if (!groupCache[groupId]) {
                const gDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
                groupCache[groupId] = gDoc.exists ? { id: gDoc.id, ...gDoc.data() } : null;
            }
            return groupCache[groupId];
        };

        // Filter: schedule's due date <= now AND today is the deduction day for this group
        const dueSchedules = [];
        for (const doc of snapshot.docs) {
            const s = { id: doc.id, ref: doc.ref, ...doc.data() };
            const freq = s.contributionFrequency || '';
            // Skip daily groups — they are handled by processDailyDeductions
            if (freq === 'daily') continue;

            const dueDateOk = new Date(s.dueDate) <= now;
            if (!dueDateOk) continue;

            // Check whether today is the configured deduction day for the group
            const group = await getGroup(s.groupId);
            if (!group) continue;
            if (!isDeductionDay(group, now)) continue;

            dueSchedules.push(s);
        }

        console.log(`Processing ${dueSchedules.length} due contributions...`);

        let processed = 0, succeeded = 0, failed = 0;

        for (const schedule of dueSchedules) {
            try {
                const result = await autoDebitContribution(schedule);
                processed++;
                if (result.success) succeeded++;
                else failed++;
            } catch (error) {
                console.error(`Error processing schedule ${schedule.id}:`, error);
                failed++;
            }
        }

        console.log(`Auto-debit complete: ${succeeded} succeeded, ${failed} failed out of ${processed} processed`);
        return { processed, succeeded, failed };
    } catch (error) {
        console.error('Error in processScheduledContributions:', error);
        throw error;
    }
};

/**
 * Attempt to auto-debit a contribution.
 * On success  → status: 'paid'
 * On failure  → status: 'failed', graceDeadline set, grace warning email sent
 */
export const autoDebitContribution = async (schedule) => {
    try {
        // Mark as attempted
        await schedule.ref.update(prepareForFirestore({
            autoDebitAttempted: true,
            lastAttemptDate: serverTimestamp(),
            attemptCount: (schedule.attemptCount || 0) + 1,
            updatedAt: serverTimestamp()
        }));

        // ── Safety guard: skip if member already paid manually for this cycle ──
        const existingPaid = await db.collection(COLLECTIONS.CONTRIBUTIONS)
            .where('groupId', '==', schedule.groupId)
            .where('userId', '==', schedule.userId)
            .where('cycleNumber', '==', schedule.cycleNumber)
            .where('status', '==', 'paid')
            .limit(1)
            .get();

        if (!existingPaid.empty) {
            await schedule.ref.update(prepareForFirestore({
                status: 'completed',
                completedManually: true,
                contributionId: existingPaid.docs[0].id,
                updatedAt: serverTimestamp()
            }));
            console.log(`↩ Skipped auto-debit for user ${schedule.userId} – already paid manually for cycle ${schedule.cycleNumber}`);
            return { success: true, reason: 'already_paid_manually' };
        }

        // Check wallet balance
        const wallet = await walletService.getWalletBalance(schedule.userId);

        if (wallet.availableBalance >= schedule.amount) {
            // ── SUCCESS PATH ── Lock funds and record contribution
            await walletService.lockFunds(
                schedule.userId,
                schedule.amount,
                schedule.id,
                {
                    groupId: schedule.groupId,
                    cycleNumber: schedule.cycleNumber,
                    source: 'auto-debit',
                    scheduledDate: schedule.dueDate
                }
            );

            // Create contribution record
            const contributionRef = await db.collection(COLLECTIONS.CONTRIBUTIONS).add(prepareForFirestore({
                groupId: schedule.groupId,
                userId: schedule.userId,
                cycleNumber: schedule.cycleNumber,
                amount: schedule.amount,
                status: 'paid',
                isAutoDebited: true,
                autoDebitedAt: serverTimestamp(),
                paidAt: serverTimestamp(),
                dueDate: schedule.dueDate,
                penaltyAmount: 0,
                isLate: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }));

            // Update schedule to paid
            await schedule.ref.update(prepareForFirestore({
                status: 'paid',
                autoDebitedAt: serverTimestamp(),
                contributionId: contributionRef.id,
                graceDeadline: null,
                updatedAt: serverTimestamp()
            }));

            console.log(`✓ Auto-debited ${formatKoboAsNaira(schedule.amount)} from user ${schedule.userId} for group ${schedule.groupId}`);
            return { success: true };

        } else {
            // ── FAILURE PATH ── Insufficient balance — set grace period
            const gracePeriodDays = await getGracePeriodDays();
            const graceDeadline = new Date();
            graceDeadline.setDate(graceDeadline.getDate() + gracePeriodDays);

            await schedule.ref.update(prepareForFirestore({
                status: 'failed',
                failureReason: `Insufficient balance (Available: ${formatKoboAsNaira(wallet.availableBalance)}, Required: ${formatKoboAsNaira(schedule.amount)})`,
                graceDeadline: graceDeadline.toISOString(),
                retryCount: (schedule.retryCount || 0) + 1,
                updatedAt: serverTimestamp()
            }));

            console.log(`✗ Failed contribution for user ${schedule.userId} — grace deadline set to ${graceDeadline.toISOString()}`);

            // Send grace warning email to the member (best-effort, non-blocking)
            try {
                const userDoc = await db.collection(COLLECTIONS.USERS).doc(schedule.userId).get();
                const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(schedule.groupId).get();
                if (userDoc.exists && groupDoc.exists) {
                    const user = userDoc.data();
                    const group = groupDoc.data();
                    await sendGraceWarningNotification(
                        user.email,
                        user.fullName,
                        group,
                        graceDeadline,
                        schedule.amount
                    );
                }
            } catch (emailErr) {
                console.warn(`⚠️  Grace warning email failed for user ${schedule.userId}:`, emailErr.message);
            }

            return { success: false, reason: 'insufficient_balance', graceDeadline };
        }
    } catch (error) {
        console.error('Error in autoDebitContribution:', error);

        await schedule.ref.update(prepareForFirestore({
            status: 'pending',
            failureReason: error.message,
            retryCount: (schedule.retryCount || 0) + 1,
            updatedAt: serverTimestamp()
        }));

        throw error;
    }
};

/**
 * Retry all grace-period contributions (status: 'failed' & graceDeadline > now).
 * Runs once per day. Uses a Firestore transaction for the deduction.
 * Called by daily cron at 08:00.
 */
export const retryGraceContributions = async () => {
    try {
        const now = new Date();

        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
            .where('status', '==', 'failed')
            .get();

        const retryable = snapshot.docs
            .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
            .filter(s => {
                const deadline = s.graceDeadline?.toDate
                    ? s.graceDeadline.toDate()
                    : new Date(s.graceDeadline);
                // Only retry if still within grace period AND not already retried today
                return deadline > now && !attemptedToday(s.lastAttemptDate);
            });

        console.log(`🔄 [Grace Retry] Processing ${retryable.length} grace-period schedules...`);

        let succeeded = 0, stillFailed = 0;

        for (const schedule of retryable) {
            try {
                // Run deduction inside a Firestore transaction for atomicity
                const result = await db.runTransaction(async (transaction) => {
                    const walletRef = db.collection(COLLECTIONS.WALLETS)
                        .where('userId', '==', schedule.userId);
                    const walletSnap = await db.collection(COLLECTIONS.WALLETS)
                        .where('userId', '==', schedule.userId)
                        .limit(1)
                        .get();

                    if (walletSnap.empty) throw new Error('Wallet not found');

                    const walletDoc = walletSnap.docs[0];
                    const wallet = walletDoc.data();
                    const available = wallet.availableBalance || 0;

                    // Update lastAttemptDate and attemptCount regardless of outcome
                    transaction.update(schedule.ref, prepareForFirestore({
                        lastAttemptDate: serverTimestamp(),
                        attemptCount: (schedule.attemptCount || 0) + 1,
                        updatedAt: serverTimestamp()
                    }));

                    if (available < schedule.amount) {
                        return { success: false, available, required: schedule.amount };
                    }

                    // Sufficient funds — deduct atomically
                    const newBalance = available - schedule.amount;
                    transaction.update(walletDoc.ref, prepareForFirestore({
                        availableBalance: newBalance,
                        updatedAt: serverTimestamp()
                    }));

                    return { success: true, walletDocRef: walletDoc.ref };
                });

                if (result.success) {
                    // Create contribution record and mark schedule paid (outside transaction - idempotent)
                    const contributionRef = await db.collection(COLLECTIONS.CONTRIBUTIONS).add(prepareForFirestore({
                        groupId: schedule.groupId,
                        userId: schedule.userId,
                        cycleNumber: schedule.cycleNumber,
                        amount: schedule.amount,
                        status: 'paid',
                        isAutoDebited: true,
                        autoDebitedAt: serverTimestamp(),
                        paidAt: serverTimestamp(),
                        dueDate: schedule.dueDate,
                        penaltyAmount: 0,
                        isLate: true, // It was late — retried during grace
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }));

                    await schedule.ref.update(prepareForFirestore({
                        status: 'paid',
                        contributionId: contributionRef.id,
                        graceDeadline: null,
                        updatedAt: serverTimestamp()
                    }));

                    console.log(`✓ [Grace Retry] Paid ${formatKoboAsNaira(schedule.amount)} for user ${schedule.userId}`);
                    succeeded++;
                } else {
                    console.log(`✗ [Grace Retry] Still insufficient for user ${schedule.userId} (${formatKoboAsNaira(result.available)} / ${formatKoboAsNaira(result.required)})`);
                    stillFailed++;
                }
            } catch (err) {
                console.error(`[Grace Retry] Error for schedule ${schedule.id}:`, err.message);
                stillFailed++;
            }
        }

        console.log(`🔄 [Grace Retry] Done: ${succeeded} succeeded, ${stillFailed} still failing`);
        return { processed: retryable.length, succeeded, stillFailed };
    } catch (error) {
        console.error('Error in retryGraceContributions:', error);
        throw error;
    }
};

/**
 * Expire grace periods — mark overdue schedules, delay group cycle, notify all members.
 * Called by daily cron at 09:00.
 */
export const expireGraceContributions = async () => {
    try {
        const now = new Date();

        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
            .where('status', '==', 'failed')
            .get();

        const expired = snapshot.docs
            .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
            .filter(s => {
                const deadline = s.graceDeadline?.toDate
                    ? s.graceDeadline.toDate()
                    : new Date(s.graceDeadline);
                return deadline <= now;
            });

        console.log(`⌛ [Grace Expiry] Processing ${expired.length} expired grace schedules...`);

        for (const schedule of expired) {
            try {
                // 1. Mark schedule overdue
                await schedule.ref.update(prepareForFirestore({
                    status: 'overdue',
                    overdueCount: (schedule.overdueCount || 0) + 1,
                    updatedAt: serverTimestamp()
                }));

                // 2. Mark/create a matching contributions record as overdue
                const existingContrib = await db.collection(COLLECTIONS.CONTRIBUTIONS)
                    .where('groupId', '==', schedule.groupId)
                    .where('userId', '==', schedule.userId)
                    .where('cycleNumber', '==', schedule.cycleNumber)
                    .limit(1)
                    .get();

                if (existingContrib.empty) {
                    // Create a placeholder overdue contribution record
                    await db.collection(COLLECTIONS.CONTRIBUTIONS).add(prepareForFirestore({
                        groupId: schedule.groupId,
                        userId: schedule.userId,
                        cycleNumber: schedule.cycleNumber,
                        amount: schedule.amount,
                        status: 'overdue',
                        isAutoDebited: false,
                        paidAt: null,
                        dueDate: schedule.dueDate,
                        penaltyAmount: 0,
                        isLate: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }));
                } else {
                    await existingContrib.docs[0].ref.update(prepareForFirestore({
                        status: 'overdue',
                        updatedAt: serverTimestamp()
                    }));
                }

                // 3. Mark the group cycle as delayed
                const groupRef = db.collection(COLLECTIONS.GROUPS).doc(schedule.groupId);
                await groupRef.update(prepareForFirestore({
                    cycleStatus: 'delayed',
                    updatedAt: serverTimestamp()
                }));

                console.log(`⌛ [Grace Expiry] Group ${schedule.groupId} cycle marked as delayed (user ${schedule.userId} overdue)`);

                // 4. Notify all group members (best-effort)
                try {
                    const groupDoc = await groupRef.get();
                    if (groupDoc.exists) {
                        const group = groupDoc.data();
                        const memberEmails = await Promise.all(
                            (group.members || []).map(async (m) => {
                                const userDoc = await db.collection(COLLECTIONS.USERS).doc(m.userId).get();
                                return userDoc.exists
                                    ? { email: userDoc.data().email, fullName: userDoc.data().fullName }
                                    : null;
                            })
                        );
                        const validMembers = memberEmails.filter(Boolean);

                        // Get overdue user name for context
                        const overdueUserDoc = await db.collection(COLLECTIONS.USERS).doc(schedule.userId).get();
                        const overdueUserName = overdueUserDoc.exists ? overdueUserDoc.data().fullName : 'a member';

                        await sendPayoutDelayedNotification(validMembers, group, overdueUserName);
                    }
                } catch (emailErr) {
                    console.warn(`⚠️  Payout-delayed broadcast email failed for group ${schedule.groupId}:`, emailErr.message);
                }

            } catch (err) {
                console.error(`[Grace Expiry] Error for schedule ${schedule.id}:`, err.message);
            }
        }

        console.log(`⌛ [Grace Expiry] Done: ${expired.length} schedules expired`);
        return { expired: expired.length };
    } catch (error) {
        console.error('Error in expireGraceContributions:', error);
        throw error;
    }
};

/**
 * Get user's upcoming scheduled contributions
 */
export const getUserScheduledContributions = async (userId, limit = 10) => {
    try {
        const snapshot = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
            .where('userId', '==', userId)
            .where('status', 'in', ['pending', 'paid'])
            .orderBy('dueDate', 'asc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting user schedules:', error);
        throw error;
    }
};

/**
 * Process daily-cycle savings deductions.
 * Called every 5 minutes by cron. Deducts from the single member's wallet
 * when the current UTC time matches the group's daily_deduction_time.
 *
 * Rules:
 *  - group.contributionFrequency === 'daily'
 *  - group.status === 'active'
 *  - Only 1 member allowed (enforced at creation)
 *  - isDailyDeductionTime(group, now) must return true
 *  - Only one deduction per UTC calendar day (lastDailyDeductionDate guard)
 */
export const processDailyDeductions = async () => {
    try {
        const now = new Date();

        // Fetch all active daily groups
        const snapshot = await db.collection(COLLECTIONS.GROUPS)
            .where('contributionFrequency', '==', 'daily')
            .where('status', '==', 'active')
            .get();

        const dailyGroups = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
        console.log(`[Daily Deduction] Checking ${dailyGroups.length} daily group(s) at ${now.toISOString()}`);

        let processed = 0, succeeded = 0, failed = 0;

        for (const group of dailyGroups) {
            try {
                // Is it time to deduct?
                if (!isDailyDeductionTime(group, now)) continue;

                // Guard: only deduct once per UTC calendar day
                const todayStr = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
                if (group.lastDailyDeductionDate === todayStr) {
                    console.log(`[Daily Deduction] Already ran today for group ${group.id}`);
                    continue;
                }

                // Find the single member
                const member = (group.members || [])[0];
                if (!member) continue;

                const userId = member.userId;
                const amount = group.contributionAmount;

                // Check wallet balance
                const wallet = await walletService.getWalletBalance(userId);
                processed++;

                if (wallet.availableBalance >= amount) {
                    // Deduct atomically
                    await walletService.lockFunds(userId, amount, group.id, {
                        groupId: group.id,
                        source: 'daily-auto-debit',
                        deductedAt: now.toISOString()
                    });

                    // Record contribution
                    await db.collection(COLLECTIONS.CONTRIBUTIONS).add(prepareForFirestore({
                        groupId: group.id,
                        userId,
                        cycleNumber: group.currentCycle || 1,
                        amount,
                        status: 'paid',
                        isAutoDebited: true,
                        autoDebitedAt: serverTimestamp(),
                        paidAt: serverTimestamp(),
                        dueDate: now.toISOString(),
                        penaltyAmount: 0,
                        isLate: false,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }));

                    // Update group: bump totalContributed and mark day done
                    await group.ref.update(prepareForFirestore({
                        totalContributed: (group.totalContributed || 0) + amount,
                        lastDailyDeductionDate: todayStr,
                        currentCycle: (group.currentCycle || 1) + 1,
                        updatedAt: serverTimestamp()
                    }));

                    console.log(`✓ [Daily Deduction] Deducted ${formatKoboAsNaira(amount)} from user ${userId} (group ${group.id})`);
                    succeeded++;
                } else {
                    console.log(`✗ [Daily Deduction] Insufficient balance for user ${userId} (group ${group.id})`);

                    // Send grace warning (best-effort)
                    try {
                        const gracePeriodDays = await getGracePeriodDays();
                        const graceDeadline = new Date();
                        graceDeadline.setDate(graceDeadline.getDate() + gracePeriodDays);

                        const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
                        if (userDoc.exists) {
                            await sendGraceWarningNotification(
                                userDoc.data().email,
                                userDoc.data().fullName,
                                group,
                                graceDeadline,
                                amount
                            );
                        }
                    } catch (emailErr) {
                        console.warn(`⚠️  Daily grace email failed for user ${userId}:`, emailErr.message);
                    }

                    // Mark the day as attempted so we don't retry endlessly today
                    await group.ref.update(prepareForFirestore({
                        lastDailyDeductionDate: todayStr,
                        updatedAt: serverTimestamp()
                    }));

                    failed++;
                }
            } catch (groupErr) {
                console.error(`[Daily Deduction] Error for group ${group.id}:`, groupErr.message);
                failed++;
            }
        }

        console.log(`[Daily Deduction] Done: ${succeeded} succeeded, ${failed} failed out of ${processed} processed`);
        return { processed, succeeded, failed };
    } catch (error) {
        console.error('Error in processDailyDeductions:', error);
        throw error;
    }
};

export default {
    scheduleGroupContributions,
    processScheduledContributions,
    autoDebitContribution,
    retryGraceContributions,
    expireGraceContributions,
    getUserScheduledContributions,
    processDailyDeductions
};
