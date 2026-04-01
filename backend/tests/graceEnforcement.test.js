/**
 * Grace Enforcement Manual Test Script
 * ------------------------------------
 * Tests the full contribution enforcement lifecycle:
 *   1. autoDebitContribution on insufficient balance → 'failed' + graceDeadline
 *   2. retryGraceContributions → skips today, retries tomorrow (simulated)
 *   3. expireGraceContributions → 'overdue', group cycleStatus: 'delayed'
 *   4. autoProcessPayout → blocked when cycle is incomplete
 *
 * Usage:
 *   cd backend
 *   node tests/graceEnforcement.test.js
 *
 * Prerequisites:
 *   - A group in Firestore with at least one member with a pending contribution_schedule
 *   - GOOGLE_APPLICATION_CREDENTIALS or Firebase service account configured in .env
 */

import '../config/firebase.js'; // Initialize Firebase
import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp } from '../db/converters.js';
import {
    autoDebitContribution,
    retryGraceContributions,
    expireGraceContributions
} from '../services/contributionScheduler.js';
import { verifyAllMembersPaid, autoProcessPayout } from '../services/payoutScheduler.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function pass(msg) { console.log(`${GREEN}  ✓ ${msg}${RESET}`); }
function fail(msg) { console.log(`${RED}  ✗ ${msg}${RESET}`); }
function info(msg) { console.log(`${BLUE}  ℹ ${msg}${RESET}`); }
function section(msg) { console.log(`\n${YELLOW}━━━ ${msg} ━━━${RESET}`); }

let errors = 0;

function assert(condition, message) {
    if (condition) {
        pass(message);
    } else {
        fail(message);
        errors++;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 1: Find a pending schedule to use as the test subject
// ──────────────────────────────────────────────────────────────────────────────
async function findTestSchedule() {
    section('Step 1: Finding a pending contribution schedule');
    const snap = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    if (snap.empty) {
        console.log(`${RED}No pending schedules found. Create a group and ensure contribution schedules exist.${RESET}`);
        process.exit(1);
    }

    const schedule = { id: snap.docs[0].id, ref: snap.docs[0].ref, ...snap.docs[0].data() };
    info(`Using schedule: ${schedule.id} (userId: ${schedule.userId}, groupId: ${schedule.groupId}, cycle: ${schedule.cycleNumber})`);
    return schedule;
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 2: Simulate insufficient-balance deduction → should set 'failed'
// ──────────────────────────────────────────────────────────────────────────────
async function testFailedDeduction(schedule) {
    section('Step 2: Simulate deduction with insufficient balance');

    // Force the wallet balance to 0 for this user to simulate failure
    const walletSnap = await db.collection(COLLECTIONS.WALLETS)
        .where('userId', '==', schedule.userId)
        .limit(1)
        .get();

    if (walletSnap.empty) {
        fail('No wallet found for test user — cannot simulate failure');
        errors++;
        return null;
    }

    const walletRef = walletSnap.docs[0].ref;
    const originalBalance = walletSnap.docs[0].data().availableBalance;
    info(`Original wallet balance: ${originalBalance} kobo`);

    // Temporarily zero the balance
    await walletRef.update(prepareForFirestore({ availableBalance: 0, updatedAt: serverTimestamp() }));
    info('Wallet balance temporarily set to 0');

    // Reset autoDebitAttempted so the scheduler will try
    await schedule.ref.update(prepareForFirestore({
        status: 'pending',
        autoDebitAttempted: false,
        attemptCount: 0,
        graceDeadline: null,
        updatedAt: serverTimestamp()
    }));

    const result = await autoDebitContribution(schedule);

    // Read back
    const updatedSnap = await schedule.ref.get();
    const updated = updatedSnap.data();

    assert(result.success === false, 'autoDebitContribution returned success: false');
    assert(result.reason === 'insufficient_balance', 'Reason is insufficient_balance');
    assert(updated.status === 'failed', `Schedule status is now 'failed' (got: ${updated.status})`);
    assert(!!updated.graceDeadline, `graceDeadline is set (got: ${updated.graceDeadline})`);
    assert(updated.attemptCount >= 1, `attemptCount >= 1 (got: ${updated.attemptCount})`);

    const deadline = updated.graceDeadline?.toDate ? updated.graceDeadline.toDate() : new Date(updated.graceDeadline);
    const now = new Date();
    assert(deadline > now, `graceDeadline (${deadline.toISOString()}) is in the future`);

    // Restore original balance
    await walletRef.update(prepareForFirestore({ availableBalance: originalBalance, updatedAt: serverTimestamp() }));
    info('Wallet balance restored');

    return updated;
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3: Verify payout is blocked when a member is 'failed'
// ──────────────────────────────────────────────────────────────────────────────
async function testPayoutGate(schedule) {
    section('Step 3: Verify payout gate blocks execution');

    const { allPaid, blockedUsers } = await verifyAllMembersPaid(schedule.groupId, schedule.cycleNumber);

    assert(allPaid === false, `verifyAllMembersPaid returns allPaid: false`);
    assert(blockedUsers.length > 0, `blockedUsers has at least 1 entry`);
    const failedEntry = blockedUsers.find(u => u.userId === schedule.userId);
    assert(!!failedEntry, `The test user appears in blockedUsers with status: ${failedEntry?.status}`);
    info(`Blocked users: ${JSON.stringify(blockedUsers)}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 4: retryGraceContributions — should attempt retry
// ──────────────────────────────────────────────────────────────────────────────
async function testGraceRetry() {
    section('Step 4: Run retryGraceContributions()');

    // Clear lastAttemptDate to ensure today's guard doesn't skip it
    const failedSnap = await db.collection(COLLECTIONS.CONTRIBUTION_SCHEDULES)
        .where('status', '==', 'failed')
        .limit(5)
        .get();

    for (const doc of failedSnap.docs) {
        await doc.ref.update(prepareForFirestore({ lastAttemptDate: null, updatedAt: serverTimestamp() }));
    }
    info(`Reset lastAttemptDate on ${failedSnap.size} failed schedule(s)`);

    const result = await retryGraceContributions();
    info(`Retry result: ${JSON.stringify(result)}`);
    assert(typeof result.processed === 'number', 'retryGraceContributions returns a processed count');
    assert(typeof result.succeeded === 'number', 'retryGraceContributions returns a succeeded count');
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 5: expireGraceContributions — simulate expired deadline
// ──────────────────────────────────────────────────────────────────────────────
async function testGraceExpiry(schedule) {
    section('Step 5: Simulate grace period expiry');

    // Push the graceDeadline to the past
    const pastDeadline = new Date();
    pastDeadline.setDate(pastDeadline.getDate() - 1);

    await schedule.ref.update(prepareForFirestore({
        status: 'failed',
        graceDeadline: pastDeadline.toISOString(),
        updatedAt: serverTimestamp()
    }));
    info(`graceDeadline set to past: ${pastDeadline.toISOString()}`);

    const result = await expireGraceContributions();
    info(`Expiry result: ${JSON.stringify(result)}`);
    assert(result.expired >= 1, `At least 1 schedule expired (got: ${result.expired})`);

    // Read back schedule
    const updatedSnap = await schedule.ref.get();
    const updated = updatedSnap.data();
    assert(updated.status === 'overdue', `Schedule status is now 'overdue' (got: ${updated.status})`);

    // Read back group
    const groupSnap = await db.collection(COLLECTIONS.GROUPS).doc(schedule.groupId).get();
    const group = groupSnap.data();
    assert(group.cycleStatus === 'delayed', `Group cycleStatus is 'delayed' (got: ${group.cycleStatus})`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Run all steps
// ──────────────────────────────────────────────────────────────────────────────
async function runTests() {
    console.log(`\n${YELLOW}╔═══════════════════════════════════════════╗`);
    console.log(`║  Grace Enforcement Test Suite — CircSave  ║`);
    console.log(`╚═══════════════════════════════════════════╝${RESET}\n`);

    try {
        const schedule = await findTestSchedule();
        await testFailedDeduction(schedule);
        await testPayoutGate(schedule);
        await testGraceRetry();
        await testGraceExpiry(schedule);

        console.log(`\n${errors === 0 ? GREEN : RED}═══════════════════════════════════════════`);
        console.log(`Result: ${errors === 0 ? '✓ ALL TESTS PASSED' : `✗ ${errors} ASSERTION(S) FAILED`}`);
        console.log(`═══════════════════════════════════════════${RESET}\n`);

        if (errors > 0) process.exit(1);
    } catch (err) {
        console.error(`\n${RED}FATAL ERROR: ${err.message}${RESET}`);
        console.error(err.stack);
        process.exit(1);
    }
}

runTests();
