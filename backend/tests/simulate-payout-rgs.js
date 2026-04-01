/**
 * ============================================================
 *  CircSave – RGS Group Payout Simulation Script
 * ============================================================
 *
 *  Purpose : Validate automatic payout rotation, commission
 *            deduction, atomic transactions, and group state
 *            progression for a 2-person group named "RGS".
 *
 *  How it works:
 *    1. Auto-discovers the "RGS" group from Firestore by name
 *    2. Logs in as both member users (loaded from Firestore)
 *    3. Funds each member wallet (₦10,000 each)
 *    4. Each member submits a ₦10,000 contribution → ₦20,000 escrow
 *    5. Trigger Cycle 1 payout  (member with payoutTurn = 1 receives ₦19,800)
 *    6. Fund wallets + contribute again (for Cycle 2)
 *    7. Trigger Cycle 2 payout  (member with payoutTurn = 2 receives ₦19,800)
 *    8. Verify: both paid, company wallet = ₦400, group closed
 *
 *  Run: node tests/simulate-payout-rgs.js
 *  Pre-req: backend server must be running on port 5000
 * ============================================================
 */

import axios from 'axios';

const API = 'http://localhost:5000/api';

// ── Kobo ↔ Naira helpers (display only) ──────────────────────────────────────
const toNaira = (kobo) => `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const fromNaira = (naira) => Math.round(naira * 100); // kobo integer

// ── Assertion helper ──────────────────────────────────────────────────────────
let passed = 0; let failed = 0;
function assert(label, actual, expected) {
    if (actual === expected) {
        console.log(`  ✅  ${label}: ${actual}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}: expected ${expected}, got ${actual}`);
        failed++;
    }
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function login(email, password) {
    const r = await axios.post(`${API}/auth/login`, { email, password });
    if (!r.data.success) throw new Error(`Login failed for ${email}: ${r.data.message}`);
    return r.data.data.token;
}

async function fundWallet(token, amount, description) {
    const r = await axios.post(`${API}/wallet/fund`, { amount, description }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.data.success) throw new Error(`Fund wallet failed: ${JSON.stringify(r.data)}`);
    return r.data;
}

async function getWallet(token) {
    const r = await axios.get(`${API}/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.data.success) throw new Error('Get wallet failed');
    return r.data.data.wallet;
}

async function submitContribution(token, groupId, cycleNumber, amountKobo) {
    // The contribution endpoint expects Naira amounts (converted at controller entry)
    const amountNaira = amountKobo / 100;
    const r = await axios.post(`${API}/contributions`, {
        groupId,
        cycleNumber,
        amount: amountNaira,
        notes: `[Simulation] Cycle ${cycleNumber} contribution`
    }, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.data.success) throw new Error(`Contribution failed: ${JSON.stringify(r.data)}`);
    return r.data.data;
}

async function simulatePayout(adminToken, groupId) {
    const r = await axios.post(`${API}/groups/${groupId}/simulate-payout`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!r.data.success) throw new Error(`Simulate payout failed: ${JSON.stringify(r.data)}`);
    return r.data.data;
}

async function getGroupDetails(token, groupId) {
    const r = await axios.get(`${API}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.data.success) throw new Error('Get group failed');
    return r.data.data.group;
}

async function getPlatformConfig(adminToken) {
    // Use the financial summary endpoint which returns escrow + cycle info
    // Company wallet is returned in simulate-payout response; we cache it
    return null;
}

// ── Main simulation ───────────────────────────────────────────────────────────
async function run() {
    console.log('\n' + '═'.repeat(68));
    console.log('  💰  CircSave – RGS Payout Rotation Simulation');
    console.log('═'.repeat(68));

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 0 – Auto-discover the RGS group via the API
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n📡 PHASE 0 – Auto-discovering RGS group...\n');

    // We need at least one valid token to query groups.
    // Strategy: Try known admin emails OR prompt.  We'll try the Firestore-side
    // discovery by scanning all groups the API exposes after authenticating as
    // the user stored in the RGS group's adminId.
    //
    // Since we cannot read Firestore directly from a standalone HTTP-only script
    // without a service account, we instead hit GET /api/groups after login and
    // filter by name.  The script asks for credentials only if the group isn't
    // found automatically.
    //
    // ── Try getting credentials from env vars first ───────────────────────────
    const ADMIN_EMAIL = process.env.RGS_ADMIN_EMAIL || null;
    const ADMIN_PASSWORD = process.env.RGS_ADMIN_PASSWORD || null;
    const MEMBER_EMAIL = process.env.RGS_MEMBER_EMAIL || null;
    const MEMBER_PASSWORD = process.env.RGS_MEMBER_PASSWORD || null;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !MEMBER_EMAIL || !MEMBER_PASSWORD) {
        console.error('❌  Missing credentials. Please set these environment variables before running:');
        console.error('');
        console.error('  RGS_ADMIN_EMAIL     = admin@example.com');
        console.error('  RGS_ADMIN_PASSWORD  = yourpassword');
        console.error('  RGS_MEMBER_EMAIL    = member@example.com');
        console.error('  RGS_MEMBER_PASSWORD = yourpassword');
        console.error('');
        console.error('  Example (PowerShell):');
        console.error('    $env:RGS_ADMIN_EMAIL="admin@example.com"; $env:RGS_ADMIN_PASSWORD="pw"; ...');
        console.error('    node tests/simulate-payout-rgs.js');
        process.exit(1);
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    console.log('🔐  Logging in as admin and member...');
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const memberToken = await login(MEMBER_EMAIL, MEMBER_PASSWORD);
    console.log('  ✅  Admin logged in');
    console.log('  ✅  Member logged in');

    // ── Discover RGS group ────────────────────────────────────────────────────
    console.log('\n🔍  Searching for group named "RGS"...');
    const groupsRes = await axios.get(`${API}/groups`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });

    const allGroups = [
        ...(groupsRes.data.data?.activeGroups || []),
        ...(groupsRes.data.data?.closedGroups || [])
    ];

    const rgsGroup = allGroups.find(g => g.name?.toLowerCase() === 'rgs');
    if (!rgsGroup) {
        console.error('\n❌  Group "RGS" not found among groups accessible by the admin account.');
        console.error('    Make sure the admin owns or is a member of a group named exactly "RGS".');
        process.exit(1);
    }

    const groupId = rgsGroup.id;
    console.log(`  ✅  Found group "RGS"  (id: ${groupId})`);
    console.log(`      Members: ${rgsGroup.members?.length ?? '?'}`);
    console.log(`      Contribution: ${toNaira(rgsGroup.contributionAmount)} per member`);
    console.log(`      Total pool:   ${toNaira(rgsGroup.totalPayout || 0)}\n`);

    // Sort members by payoutTurn so we know who goes first
    const sortedMembers = [...(rgsGroup.members || [])].sort((a, b) => a.payoutTurn - b.payoutTurn);
    if (sortedMembers.length !== 2) {
        console.error(`❌  Expected exactly 2 members in RGS, found ${sortedMembers.length}. Aborting.`);
        process.exit(1);
    }

    const CONTRIBUTION_NAIRA = rgsGroup.contributionAmount / 100; // stored in kobo, display in naira
    const GROSS_KOBO = rgsGroup.totalPayout || (rgsGroup.contributionAmount * 2);
    const COMMISSION_KOBO = Math.floor(GROSS_KOBO * 1 / 100);  // 1% commission
    const NET_KOBO = GROSS_KOBO - COMMISSION_KOBO;

    console.log('─'.repeat(68));
    console.log('  📋  Expected figures (per payout cycle):');
    console.log(`      Gross pool:  ${toNaira(GROSS_KOBO)}`);
    console.log(`      Commission:  ${toNaira(COMMISSION_KOBO)} (1%)`);
    console.log(`      Net payout:  ${toNaira(NET_KOBO)}`);
    console.log('─'.repeat(68));

    // ── Determine which token belongs to which member ─────────────────────────
    // We use /auth/me to resolve the logged-in user ID for each token
    const adminMe = (await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${adminToken}` } })).data.data.user;
    const memberMe = (await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${memberToken}` } })).data.data.user;

    // Build per-member token map { userId → token }
    const tokenMap = {
        [adminMe.id]: { token: adminToken, name: adminMe.fullName },
        [memberMe.id]: { token: memberToken, name: memberMe.fullName }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1 – Fund wallets + submit Cycle 1 contributions
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n💳 PHASE 1 – Fund wallets & submit Cycle 1 contributions\n');

    // Reset hasReceivedPayout guard: if both already paid, warn and stop
    const allAlreadyPaid = sortedMembers.every(m => m.hasReceivedPayout);
    if (allAlreadyPaid) {
        console.error('❌  Both members already received payouts in the current rotation.');
        console.error('    Reset the group in Firestore to re-run this simulation.');
        process.exit(1);
    }

    // Fund and contribute for all unpaid members (and their counterparts)
    for (const member of sortedMembers) {
        const info = tokenMap[member.userId];
        if (!info) {
            console.warn(`  ⚠️  No token available for member ${member.userId} — skipping fund/contribute`);
            continue;
        }

        const walletBefore = await getWallet(info.token);
        console.log(`  👤 ${info.name} (payoutTurn: ${member.payoutTurn})`);
        console.log(`     Wallet before fund: ${toNaira(walletBefore.availableBalance)}`);

        // Fund wallet with exactly the contribution amount
        await fundWallet(info.token, CONTRIBUTION_NAIRA, `[Simulation] Cycle 1 wallet top-up`);

        const walletAfterFund = await getWallet(info.token);
        console.log(`     Wallet after fund:  ${toNaira(walletAfterFund.availableBalance)}`);

        // Submit contribution (wallet-only: instantly debited)
        const cycleNumber = rgsGroup.currentCycle || 1;
        await submitContribution(info.token, groupId, cycleNumber, rgsGroup.contributionAmount);
        console.log(`     ✅  Contribution of ${toNaira(rgsGroup.contributionAmount)} submitted for Cycle ${cycleNumber}\n`);
    }

    // ── Verify escrow before Cycle 1 payout ──────────────────────────────────
    const groupAfterContribs1 = await getGroupDetails(adminToken, groupId);
    console.log(`  📦  Group escrow after Cycle 1 contributions: ${toNaira(groupAfterContribs1.currentEscrowBalance)}`);
    assert('Escrow ≥ gross payout amount', groupAfterContribs1.currentEscrowBalance >= GROSS_KOBO, true);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2 – Simulate Cycle 1 Payout
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n💰 PHASE 2 – Triggering Cycle 1 Payout\n');

    const payout1 = await simulatePayout(adminToken, groupId);

    console.log(`  📣  Payout Cycle ${payout1.cycleProcessed} complete:`);
    console.log(`      Recipient:   ${payout1.recipient.fullName} (payoutTurn: ${payout1.recipient.payoutTurn})`);
    console.log(`      Gross:       ${payout1.payoutBreakdown.grossPayoutNaira}`);
    console.log(`      Commission:  ${payout1.payoutBreakdown.commissionNaira} (${payout1.payoutBreakdown.commissionRate})`);
    console.log(`      Net paid:    ${payout1.payoutBreakdown.netPayoutNaira}`);
    console.log(`      Wallet now:  ${payout1.wallets.recipientNewBalanceNaira}`);
    console.log(`      Company:     ${payout1.wallets.companyWalletBalanceNaira} (running total)`);

    // Assertions for Cycle 1
    console.log('\n  🔍  Assertions – Cycle 1:');
    assert('Recipient is payoutTurn 1', payout1.recipient.payoutTurn, 1);
    assert('Gross payout (kobo)', payout1.payoutBreakdown.grossPayout, GROSS_KOBO);
    assert('Commission (kobo)', payout1.payoutBreakdown.commissionDeducted, COMMISSION_KOBO);
    assert('Net payout (kobo)', payout1.payoutBreakdown.netPayoutReceived, NET_KOBO);
    assert('All payouts complete after Cycle 1', payout1.groupState.allPayoutsComplete, false);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3 – Fund wallets + submit Cycle 2 contributions
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n💳 PHASE 3 – Fund wallets & submit Cycle 2 contributions\n');

    const groupAfterPayout1 = await getGroupDetails(adminToken, groupId);
    const cycle2Number = groupAfterPayout1.currentCycle || 2;

    for (const member of sortedMembers) {
        const info = tokenMap[member.userId];
        if (!info) {
            console.warn(`  ⚠️  No token for member ${member.userId} — skipping`);
            continue;
        }

        const walletBefore = await getWallet(info.token);
        console.log(`  👤 ${info.name} (payoutTurn: ${member.payoutTurn})`);
        console.log(`     Wallet before fund: ${toNaira(walletBefore.availableBalance)}`);

        await fundWallet(info.token, CONTRIBUTION_NAIRA, `[Simulation] Cycle 2 wallet top-up`);
        await submitContribution(info.token, groupId, cycle2Number, rgsGroup.contributionAmount);
        console.log(`     ✅  Contribution of ${toNaira(rgsGroup.contributionAmount)} submitted for Cycle ${cycle2Number}\n`);
    }

    const groupAfterContribs2 = await getGroupDetails(adminToken, groupId);
    console.log(`  📦  Group escrow after Cycle 2 contributions: ${toNaira(groupAfterContribs2.currentEscrowBalance)}`);
    assert('Escrow ≥ gross payout amount (Cycle 2)', groupAfterContribs2.currentEscrowBalance >= GROSS_KOBO, true);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4 – Simulate Cycle 2 Payout
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n💰 PHASE 4 – Triggering Cycle 2 Payout\n');

    const payout2 = await simulatePayout(adminToken, groupId);

    console.log(`  📣  Payout Cycle ${payout2.cycleProcessed} complete:`);
    console.log(`      Recipient:   ${payout2.recipient.fullName} (payoutTurn: ${payout2.recipient.payoutTurn})`);
    console.log(`      Gross:       ${payout2.payoutBreakdown.grossPayoutNaira}`);
    console.log(`      Commission:  ${payout2.payoutBreakdown.commissionNaira} (${payout2.payoutBreakdown.commissionRate})`);
    console.log(`      Net paid:    ${payout2.payoutBreakdown.netPayoutNaira}`);
    console.log(`      Wallet now:  ${payout2.wallets.recipientNewBalanceNaira}`);
    console.log(`      Company:     ${payout2.wallets.companyWalletBalanceNaira} (running total)`);

    // Assertions for Cycle 2
    console.log('\n  🔍  Assertions – Cycle 2:');
    assert('Recipient is payoutTurn 2', payout2.recipient.payoutTurn, 2);
    assert('Gross payout (kobo)', payout2.payoutBreakdown.grossPayout, GROSS_KOBO);
    assert('Commission (kobo)', payout2.payoutBreakdown.commissionDeducted, COMMISSION_KOBO);
    assert('Net payout (kobo)', payout2.payoutBreakdown.netPayoutReceived, NET_KOBO);
    assert('All payouts complete after Cycle 2', payout2.groupState.allPayoutsComplete, true);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 5 – Verify final group state
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n🔎 PHASE 5 – Verifying Rotation Completion\n');

    const finalGroup = await getGroupDetails(adminToken, groupId);
    const finalMembers = [...(finalGroup.members || [])].sort((a, b) => a.payoutTurn - b.payoutTurn);

    console.log('  Member payout status:');
    for (const m of finalMembers) {
        const name = tokenMap[m.userId]?.name || m.userId;
        console.log(`    payoutTurn ${m.payoutTurn} (${name}): hasReceivedPayout = ${m.hasReceivedPayout}`);
    }

    console.log('\n  🔍  Final assertions:');
    assert('Member 1 hasReceivedPayout', finalMembers[0]?.hasReceivedPayout, true);
    assert('Member 2 hasReceivedPayout', finalMembers[1]?.hasReceivedPayout, true);
    assert('Group status after full rotation', finalGroup.status, 'closed');

    // Company wallet should hold 2× commission
    const expectedCompanyTotal = COMMISSION_KOBO * 2;
    assert('Company wallet total (kobo)', payout2.wallets.companyWalletBalance >= expectedCompanyTotal, true);
    console.log(`    Company wallet balance: ${toNaira(payout2.wallets.companyWalletBalance)}`);
    console.log(`    Expected minimum:       ${toNaira(expectedCompanyTotal)} (2 commissions)`);

    // Verify a 3rd payout attempt is rejected (rotation done)
    console.log('\n  🔒  Verifying 3rd payout attempt is rejected...');
    try {
        await simulatePayout(adminToken, groupId);
        console.error('  ❌  3rd payout should have been rejected but was not!');
        failed++;
    } catch (err) {
        const msg = err.response?.data?.message || err.message;
        if (msg.includes('rotation is complete') || err.response?.status === 400) {
            console.log(`  ✅  3rd payout correctly rejected: "${msg}"`);
            passed++;
        } else {
            console.error(`  ❌  3rd payout rejected with unexpected error: ${msg}`);
            failed++;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(68));
    console.log('  📊  SIMULATION COMPLETE – FINAL REPORT');
    console.log('═'.repeat(68));
    console.log('');
    console.log('  Cycle 1 Payout');
    console.log(`    Recipient:   ${payout1.recipient.fullName} (payoutTurn 1)`);
    console.log(`    Gross:       ${payout1.payoutBreakdown.grossPayoutNaira}`);
    console.log(`    Commission:  ${payout1.payoutBreakdown.commissionNaira}`);
    console.log(`    Net:         ${payout1.payoutBreakdown.netPayoutNaira}`);
    console.log('');
    console.log('  Cycle 2 Payout');
    console.log(`    Recipient:   ${payout2.recipient.fullName} (payoutTurn 2)`);
    console.log(`    Gross:       ${payout2.payoutBreakdown.grossPayoutNaira}`);
    console.log(`    Commission:  ${payout2.payoutBreakdown.commissionNaira}`);
    console.log(`    Net:         ${payout2.payoutBreakdown.netPayoutNaira}`);
    console.log('');
    console.log('  Platform earnings');
    console.log(`    Total commission: ${toNaira(payout2.wallets.companyWalletBalance)}`);
    console.log('');
    console.log('  Rotation state');
    console.log('    Member 1 paid: ✅');
    console.log('    Member 2 paid: ✅');
    console.log(`    Group status:  ${finalGroup.status.toUpperCase()}`);
    console.log('');
    if (failed === 0) {
        console.log(`  🎉  ALL ${passed} ASSERTIONS PASSED`);
    } else {
        console.error(`  ⚠️  ${passed} passed, ${failed} FAILED`);
    }
    console.log('═'.repeat(68));
    console.log('');

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('\n💥  Unhandled simulation error:');
    console.error(err.response?.data || err.message);
    process.exit(1);
});
