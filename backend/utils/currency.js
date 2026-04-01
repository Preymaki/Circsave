/**
 * Currency Utilities – Backend
 *
 * ALL monetary values in CircSave are stored as INTEGER KOBO (₦1 = 100 kobo).
 * These helpers are the single source of truth for all conversions.
 *
 * Rule: Convert user-supplied Naira → kobo at the ENTRY POINT (controller).
 *       Everything inside services/schedulers operates on kobo integers only.
 *       Convert kobo → Naira only at DISPLAY POINTS (log messages, error strings).
 */

/**
 * Convert a Naira amount (user input / API input) to kobo for storage.
 * Always rounds to the nearest kobo to handle any floating-point input.
 * @param {number} naira - Amount in Naira (e.g. 10000)
 * @returns {number} Integer amount in kobo (e.g. 1000000)
 */
export const convertNairaToKobo = (naira) => {
    if (typeof naira !== 'number' || isNaN(naira)) {
        throw new Error(`Invalid Naira amount: ${naira}`);
    }
    return Math.round(naira * 100);
};

/**
 * Convert a kobo integer back to Naira for display purposes only.
 * Never store the result of this function.
 * @param {number} kobo - Integer amount in kobo (e.g. 1000000)
 * @returns {number} Amount in Naira (e.g. 10000)
 */
export const convertKoboToNaira = (kobo) => {
    return kobo / 100;
};

/**
 * Format a kobo integer as a human-readable Naira string for logs and error messages.
 * @param {number} kobo - Integer amount in kobo (e.g. 1000000)
 * @returns {string} Formatted string (e.g. "₦10,000.00")
 */
export const formatKoboAsNaira = (kobo) => {
    const naira = kobo / 100;
    return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
