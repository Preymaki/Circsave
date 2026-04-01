import cron from 'node-cron';
import {
    processScheduledContributions,
    retryGraceContributions,
    expireGraceContributions,
    processDailyDeductions
} from '../services/contributionScheduler.js';
import { processScheduledPayouts } from '../services/payoutScheduler.js';

/**
 * Cron Jobs Configuration
 * Handles automated background tasks for CircSave
 */

// Run contribution auto-debit every hour (monthly/weekly groups — fires on deduction day)
cron.schedule('0 * * * *', async () => {
    console.log('🕐 [CRON] Running contribution auto-debit...');
    try {
        await processScheduledContributions();
    } catch (error) {
        console.error('❌ [CRON] Contribution auto-debit failed:', error);
    }
});

// Run payout processing every 6 hours (fires on cycle_end_date)
cron.schedule('0 */6 * * *', async () => {
    console.log('💰 [CRON] Running automated payouts...');
    try {
        await processScheduledPayouts();
    } catch (error) {
        console.error('❌ [CRON] Automated payout failed:', error);
    }
});

// Retry grace-period contributions once per day at 08:00
// Retries deductions for members in 'failed' status still within their grace window
cron.schedule('0 8 * * *', async () => {
    console.log('🔄 [CRON] Running grace-period contribution retry...');
    try {
        const result = await retryGraceContributions();
        console.log(`🔄 [CRON] Grace retry: ${result.succeeded} succeeded, ${result.stillFailed} still failing`);
    } catch (error) {
        console.error('❌ [CRON] Grace retry failed:', error);
    }
});

// Expire overdue grace periods once per day at 09:00
// Marks expired schedules as 'overdue', delays group cycle, notifies all members
cron.schedule('0 9 * * *', async () => {
    console.log('⌛ [CRON] Running grace-period expiry check...');
    try {
        const result = await expireGraceContributions();
        console.log(`⌛ [CRON] Grace expiry: ${result.expired} schedule(s) expired`);
    } catch (error) {
        console.error('❌ [CRON] Grace expiry failed:', error);
    }
});

// ── Daily Cycle Deductions ────────────────────────────────────────────────────
// Runs every 5 minutes. For each active daily-frequency group, checks whether
// the current UTC time matches the user-chosen daily_deduction_time (HH:MM).
// At most once per UTC calendar day per group (lastDailyDeductionDate guard).
cron.schedule('*/5 * * * *', async () => {
    try {
        await processDailyDeductions();
    } catch (error) {
        console.error('❌ [CRON] Daily deduction check failed:', error);
    }
});

console.log('✅ Cron jobs initialized successfully');
console.log('   - Contribution auto-debit:     Every hour    (monthly/weekly on deduction day)');
console.log('   - Automated payouts:           Every 6 hours (on cycle end date)');
console.log('   - Grace period retry:          Daily at 08:00 UTC');
console.log('   - Grace period expiry check:   Daily at 09:00 UTC');
console.log('   - Daily savings deductions:    Every 5 mins  (fires at user-chosen UTC time)');

export default {
    // Export functions for manual triggers (e.g. in tests or admin endpoints)
    triggerContributionAutoDebit: processScheduledContributions,
    triggerPayoutProcessing: processScheduledPayouts,
    triggerGraceRetry: retryGraceContributions,
    triggerGraceExpiry: expireGraceContributions,
    triggerDailyDeductions: processDailyDeductions
};
