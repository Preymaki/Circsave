/**
 * cycleEngine.js — Fixed-Interval Cycle Date Engine
 * ===================================================
 * Pure helper functions for CircSave's rolling cycle logic.
 *
 * Design rules:
 *  - monthly  → 30-day fixed intervals (NOT calendar months)
 *  - weekly   → 7-day fixed intervals
 *  - daily    → single-user, deduction at user-chosen UTC time every 24 h
 *
 * All functions operate in UTC. No Firestore dependency.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE_LENGTHS = {
    monthly: 30,
    weekly:  7,
    daily:   1   // each "cycle" is 1 day for daily savings
};

/** Day within cycle on which the deduction is triggered (1-indexed). */
const DEDUCTION_OFFSETS = {
    monthly: 25,   // deduct on Day 25 → payout on Day 30
    weekly:   5,   // deduct on Day 5  → payout on Day 7
    daily:    0    // no offset: deduct at chosen time daily
};

/** Day within cycle on which payout is executed (== cycle end). */
const PAYOUT_OFFSETS = {
    monthly: 30,
    weekly:   7,
    daily:    1    // not used for real payout, just cycle length
};

// ─── Exported helpers ─────────────────────────────────────────────────────────

/**
 * Returns the fixed cycle length in days for a given frequency.
 * @param {string} frequency  "monthly" | "weekly" | "daily"
 * @returns {number}
 */
export function getCycleLength(frequency) {
    const len = CYCLE_LENGTHS[frequency];
    if (len === undefined) throw new Error(`Unknown frequency: ${frequency}`);
    return len;
}

/**
 * Returns the day-offset within the cycle when deduction happens (1-indexed).
 * e.g. monthly → 25 means deduct on Day 25 of the 30-day cycle.
 * @param {string} frequency
 * @returns {number}
 */
export function getDeductionOffset(frequency) {
    const offset = DEDUCTION_OFFSETS[frequency];
    if (offset === undefined) throw new Error(`Unknown frequency: ${frequency}`);
    return offset;
}

/**
 * Returns the day-offset within the cycle when payout happens (= cycle end).
 * @param {string} frequency
 * @returns {number}
 */
export function getPayoutOffset(frequency) {
    const offset = PAYOUT_OFFSETS[frequency];
    if (offset === undefined) throw new Error(`Unknown frequency: ${frequency}`);
    return offset;
}

/**
 * Calculate the cycle end date from a cycle start date.
 * cycle_end_date = cycle_start_date + cycleLength days (UTC midnight).
 *
 * @param {Date|string} cycleStartDate
 * @param {string} frequency
 * @returns {Date} — UTC midnight on the last day of the cycle
 */
export function calcCycleEndDate(cycleStartDate, frequency) {
    const start = toUTCMidnight(cycleStartDate);
    const cycleLen = getCycleLength(frequency);
    return addDaysUTC(start, cycleLen);
}

/**
 * Calculate the deduction trigger date within a cycle.
 * deduction_date = cycle_start_date + (deductionOffset - 1) days
 *
 * The offset is 1-indexed (Day 25 of 30), so we add (offset - 1) as to get
 * the calendar date when that "day" begins.
 *
 * For daily savings the offset is 0, meaning the deduction date IS the start date
 * (controlled instead by isDailyDeductionTime).
 *
 * @param {Date|string} cycleStartDate
 * @param {string} frequency
 * @returns {Date}
 */
export function calcDeductionDate(cycleStartDate, frequency) {
    const start = toUTCMidnight(cycleStartDate);
    const offset = getDeductionOffset(frequency);
    if (offset === 0) return start; // daily — not date-gated, time-gated instead
    return addDaysUTC(start, offset - 1);
}

/**
 * Determine whether today is the deduction day for a group.
 *
 * For non-daily groups:
 *   today (UTC date) === cycle_start_date + (deductionOffset - 1) days
 *
 * For daily groups:
 *   Always returns false — use isDailyDeductionTime() instead.
 *
 * @param {object} group  Firestore group document data (requires cycle_start_date, contributionFrequency)
 * @param {Date}   nowUTC Current UTC time
 * @returns {boolean}
 */
export function isDeductionDay(group, nowUTC = new Date()) {
    const freq = group.contributionFrequency || group.frequency;
    if (freq === 'daily') return false; // daily uses time-based check

    const startDate = toFirestoreDate(group.cycle_start_date);
    if (!startDate) return false;

    const deductionDate = calcDeductionDate(startDate, freq);
    return isSameUTCDate(deductionDate, nowUTC);
}

/**
 * Determine whether today is the payout day (= last day of cycle) for a group.
 *
 * Payout fires on any day >= cycle_end_date when it hasn't run yet.
 * (Catches up if scheduler was down.)
 *
 * For daily groups: always returns false — no payout logic.
 *
 * @param {object} group  Requires cycle_end_date, contributionFrequency
 * @param {Date}   nowUTC
 * @returns {boolean}
 */
export function isPayoutDay(group, nowUTC = new Date()) {
    const freq = group.contributionFrequency || group.frequency;
    if (freq === 'daily') return false;

    const endDate = toFirestoreDate(group.cycle_end_date);
    if (!endDate) return false;

    // Payout fires on or after cycle_end_date (catches missed runs)
    return toUTCMidnight(nowUTC) >= toUTCMidnight(endDate);
}

/**
 * Roll the cycle forward after a successful payout.
 * new cycle_start_date = previous cycle_end_date
 * new cycle_end_date   = new cycle_start_date + cycleLength days
 *
 * @param {object} group  Requires cycle_end_date, contributionFrequency
 * @returns {{ cycle_start_date: string, cycle_end_date: string, deduction_date: string }}
 */
export function rollForwardCycle(group) {
    const freq = group.contributionFrequency || group.frequency;
    const prevEnd = toFirestoreDate(group.cycle_end_date);
    if (!prevEnd) throw new Error('group.cycle_end_date is required to roll forward cycle');

    const newStart = toUTCMidnight(prevEnd);
    const newEnd   = calcCycleEndDate(newStart, freq);
    const newDeduction = calcDeductionDate(newStart, freq);

    return {
        cycle_start_date: newStart.toISOString(),
        cycle_end_date:   newEnd.toISOString(),
        deduction_date:   newDeduction.toISOString()
    };
}

/**
 * Determine whether it is time to run the daily deduction for a daily-cycle group.
 *
 * Matches when the current UTC hour equals the hour in daily_deduction_time (HH:MM).
 * The cron should call this every 5 minutes; we match on the correct hour+minute.
 *
 * @param {object} group  Requires daily_deduction_time (e.g. "14:00")
 * @param {Date}   nowUTC
 * @returns {boolean}
 */
export function isDailyDeductionTime(group, nowUTC = new Date()) {
    const timeStr = group.daily_deduction_time;
    if (!timeStr) return false;

    const [targetHour, targetMinute] = timeStr.split(':').map(Number);
    const utcHour   = nowUTC.getUTCHours();
    const utcMinute = nowUTC.getUTCMinutes();

    return utcHour === targetHour && utcMinute === targetMinute;
}

/**
 * Calculate the overall group end-date (all cycles completed).
 * groupStart + (totalCycles × cycleLength) days.
 *
 * Used in createGroup to set the top-level `endDate` field.
 *
 * @param {Date|string} groupStartDate
 * @param {string}      frequency
 * @param {number}      totalCycles
 * @returns {Date}
 */
export function calcGroupEndDate(groupStartDate, frequency, totalCycles) {
    const start    = toUTCMidnight(groupStartDate);
    const cycleLen = getCycleLength(frequency);
    return addDaysUTC(start, cycleLen * totalCycles);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Add N days to a Date, preserving UTC midnight.
 */
function addDaysUTC(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

/**
 * Strip the time component and return UTC midnight of the given date.
 */
function toUTCMidnight(date) {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Compare two dates by their UTC calendar date only (ignores time).
 */
function isSameUTCDate(a, b) {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    return (
        da.getUTCFullYear() === db.getUTCFullYear() &&
        da.getUTCMonth()    === db.getUTCMonth()    &&
        da.getUTCDate()     === db.getUTCDate()
    );
}

/**
 * Normalise a Firestore Timestamp or ISO string to a JS Date.
 */
function toFirestoreDate(value) {
    if (!value) return null;
    if (value && typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
}

export default {
    getCycleLength,
    getDeductionOffset,
    getPayoutOffset,
    calcCycleEndDate,
    calcDeductionDate,
    isDeductionDay,
    isPayoutDay,
    rollForwardCycle,
    isDailyDeductionTime,
    calcGroupEndDate
};
