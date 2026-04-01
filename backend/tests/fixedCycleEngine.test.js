/**
 * Fixed Cycle Engine — Unit Test Script
 * ======================================
 * Tests all pure functions in backend/utils/cycleEngine.js.
 * No Firestore connection required.
 *
 * Usage:
 *   cd backend
 *   node tests/fixedCycleEngine.test.js
 */

import {
    getCycleLength,
    getDeductionOffset,
    getPayoutOffset,
    calcCycleEndDate,
    calcDeductionDate,
    calcGroupEndDate,
    isDeductionDay,
    isPayoutDay,
    rollForwardCycle,
    isDailyDeductionTime
} from '../utils/cycleEngine.js';

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;

function pass(msg) { console.log(`${GREEN}  ✓ ${msg}${RESET}`); passed++; }
function fail(msg, got, exp) {
    console.log(`${RED}  ✗ ${msg}${RESET}`);
    if (got !== undefined) console.log(`      got: ${got}  expected: ${exp}`);
    failed++;
}
function section(title) { console.log(`\n${YELLOW}━━━ ${title} ━━━${RESET}`); }

function assert(condition, label, got, expected) {
    if (condition) pass(label);
    else fail(label, got, expected);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function utcDate(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

section('1. getCycleLength');
assert(getCycleLength('monthly') === 30, 'monthly → 30', getCycleLength('monthly'), 30);
assert(getCycleLength('weekly')  ===  7, 'weekly  → 7',  getCycleLength('weekly'),  7);
assert(getCycleLength('daily')   ===  1, 'daily   → 1',  getCycleLength('daily'),   1);
try { getCycleLength('yearly'); fail('should throw for unknown frequency'); }
catch (e) { pass('throws for unknown frequency'); }

section('2. getDeductionOffset');
assert(getDeductionOffset('monthly') === 25, 'monthly → 25');
assert(getDeductionOffset('weekly')  ===  5, 'weekly  → 5');
assert(getDeductionOffset('daily')   ===  0, 'daily   → 0');

section('3. getPayoutOffset');
assert(getPayoutOffset('monthly') === 30, 'monthly → 30');
assert(getPayoutOffset('weekly')  ===  7, 'weekly  → 7');
assert(getPayoutOffset('daily')   ===  1, 'daily   → 1');

section('4. calcCycleEndDate');
// Monthly: Feb 26 + 30 days = Mar 28
{
    const start = utcDate(2025, 2, 26);
    const end   = calcCycleEndDate(start, 'monthly');
    const expected = isoDate(2025, 3, 28);
    assert(end.toISOString() === expected,
        'Monthly: Feb 26 + 30 days = Mar 28', end.toISOString(), expected);
}

// Monthly: Jan 31 + 30 days = Mar 2 (NOT Feb 28 — strictly 30 days, no calendar rounding)
{
    const start = utcDate(2025, 1, 31);
    const end   = calcCycleEndDate(start, 'monthly');
    const expected = isoDate(2025, 3, 2);
    assert(end.toISOString() === expected,
        'Monthly: Jan 31 + 30 days = Mar 2 (fixed, no calendar rounding)', end.toISOString(), expected);
}

// Weekly: Mar 1 + 7 days = Mar 8
{
    const start = utcDate(2025, 3, 1);
    const end   = calcCycleEndDate(start, 'weekly');
    const expected = isoDate(2025, 3, 8);
    assert(end.toISOString() === expected,
        'Weekly: Mar 1 + 7 days = Mar 8', end.toISOString(), expected);
}

// Daily: Apr 5 + 1 day = Apr 6
{
    const start = utcDate(2025, 4, 5);
    const end   = calcCycleEndDate(start, 'daily');
    const expected = isoDate(2025, 4, 6);
    assert(end.toISOString() === expected,
        'Daily: Apr 5 + 1 day = Apr 6', end.toISOString(), expected);
}

section('5. calcDeductionDate');
// Monthly: start Feb 26 → deduction = Feb 26 + 24 = Mar 22
{
    const start = utcDate(2025, 2, 26);
    const ded   = calcDeductionDate(start, 'monthly');
    const expected = isoDate(2025, 3, 22);   // Feb26 + 24 days
    assert(ded.toISOString() === expected,
        'Monthly deduction: Feb 26 → Day 25 of cycle = Mar 22', ded.toISOString(), expected);
}

// Weekly: start Mar 1 → deduction = Mar 1 + 4 = Mar 5
{
    const start = utcDate(2025, 3, 1);
    const ded   = calcDeductionDate(start, 'weekly');
    const expected = isoDate(2025, 3, 5);
    assert(ded.toISOString() === expected,
        'Weekly deduction: Mar 1 → Day 5 = Mar 5', ded.toISOString(), expected);
}

// Daily: deduction = start (no offset)
{
    const start = utcDate(2025, 6, 10);
    const ded   = calcDeductionDate(start, 'daily');
    assert(ded.toISOString() === start.toISOString(),
        'Daily deduction: equals start date', ded.toISOString(), start.toISOString());
}

section('6. calcGroupEndDate');
// Monthly, 3 cycles: Feb 26 + 90 days = May 27
{
    const start = utcDate(2025, 2, 26);
    const end   = calcGroupEndDate(start, 'monthly', 3);
    const expected = isoDate(2025, 5, 27);
    assert(end.toISOString() === expected,
        '3 monthly cycles: Feb 26 + 90 days = May 27', end.toISOString(), expected);
}

// Weekly, 4 cycles: Mar 1 + 28 days = Mar 29
{
    const start = utcDate(2025, 3, 1);
    const end   = calcGroupEndDate(start, 'weekly', 4);
    const expected = isoDate(2025, 3, 29);
    assert(end.toISOString() === expected,
        '4 weekly cycles: Mar 1 + 28 days = Mar 29', end.toISOString(), expected);
}

section('7. isDeductionDay');
{
    // Group started Feb 26. Deduction day = Feb 26 + 24 = Mar 22.
    const group = {
        contributionFrequency: 'monthly',
        cycle_start_date: isoDate(2025, 2, 26)
    };
    const onDeductionDay   = utcDate(2025, 3, 22);
    const offDeductionDay  = utcDate(2025, 3, 10);
    assert(isDeductionDay(group, onDeductionDay)  === true,  'isDeductionDay → true on correct day');
    assert(isDeductionDay(group, offDeductionDay) === false, 'isDeductionDay → false on other day');
    // Daily always false
    const dailyGroup = { contributionFrequency: 'daily', cycle_start_date: isoDate(2025, 3, 1) };
    assert(isDeductionDay(dailyGroup, utcDate(2025, 3, 1)) === false, 'isDeductionDay → always false for daily');
}

section('8. isPayoutDay');
{
    // cycle_end_date = Mar 28
    const group = {
        contributionFrequency: 'monthly',
        cycle_end_date: isoDate(2025, 3, 28)
    };
    assert(isPayoutDay(group, utcDate(2025, 3, 28)) === true,  'isPayoutDay → true on end date');
    assert(isPayoutDay(group, utcDate(2025, 3, 29)) === true,  'isPayoutDay → true after end date (catch-up)');
    assert(isPayoutDay(group, utcDate(2025, 3, 27)) === false, 'isPayoutDay → false before end date');
    const dailyGroup = { contributionFrequency: 'daily', cycle_end_date: isoDate(2025, 3, 28) };
    assert(isPayoutDay(dailyGroup, utcDate(2025, 3, 28)) === false, 'isPayoutDay → always false for daily');
}

section('9. rollForwardCycle');
{
    // Monthly: cycle_end = Mar 28 → new start = Mar 28, new end = Apr 27 (+30)
    const group = {
        contributionFrequency: 'monthly',
        cycle_end_date: isoDate(2025, 3, 28)
    };
    const rolled = rollForwardCycle(group);
    assert(rolled.cycle_start_date === isoDate(2025, 3, 28),
        'rollForward: new start = old end (Mar 28)', rolled.cycle_start_date, isoDate(2025, 3, 28));
    assert(rolled.cycle_end_date === isoDate(2025, 4, 27),
        'rollForward: new end = Mar 28 + 30 = Apr 27', rolled.cycle_end_date, isoDate(2025, 4, 27));
    // new deduction = Mar 28 + 24 = Apr 21
    assert(rolled.deduction_date === isoDate(2025, 4, 21),
        'rollForward: deduction = Mar 28 + 24 = Apr 21', rolled.deduction_date, isoDate(2025, 4, 21));
}

{
    // Weekly: cycle_end = Mar 8 → new start = Mar 8, new end = Mar 15 (+7)
    const group = {
        contributionFrequency: 'weekly',
        cycle_end_date: isoDate(2025, 3, 8)
    };
    const rolled = rollForwardCycle(group);
    assert(rolled.cycle_start_date === isoDate(2025, 3, 8),
        'rollForward weekly: new start = Mar 8', rolled.cycle_start_date, isoDate(2025, 3, 8));
    assert(rolled.cycle_end_date === isoDate(2025, 3, 15),
        'rollForward weekly: new end = Mar 8 + 7 = Mar 15', rolled.cycle_end_date, isoDate(2025, 3, 15));
}

{
    // Missing cycle_end_date should throw
    try {
        rollForwardCycle({ contributionFrequency: 'monthly', cycle_end_date: null });
        fail('should throw when cycle_end_date is null');
    } catch (e) { pass('rollForwardCycle throws when cycle_end_date is null'); }
}

section('10. isDailyDeductionTime');
{
    const group = { daily_deduction_time: '14:00' };
    // Mock a UTC time at exactly 14:00
    const atTime = new Date('2025-06-10T14:00:00.000Z');
    assert(isDailyDeductionTime(group, atTime) === true,  'isDailyDeductionTime → true at 14:00 UTC');

    const wrongTime = new Date('2025-06-10T13:59:00.000Z');
    assert(isDailyDeductionTime(group, wrongTime) === false, 'isDailyDeductionTime → false at 13:59 UTC');

    const noTimeGroup = { daily_deduction_time: null };
    assert(isDailyDeductionTime(noTimeGroup, atTime) === false, 'isDailyDeductionTime → false when no time set');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${failed === 0 ? GREEN : RED}═══════════════════════════════════════════`);
console.log(`Result: ${failed === 0 ? '✓ ALL TESTS PASSED' : `✗ ${failed} FAILURE(S)`} (${passed}/${total})`);
console.log(`═══════════════════════════════════════════${RESET}\n`);

if (failed > 0) process.exit(1);
