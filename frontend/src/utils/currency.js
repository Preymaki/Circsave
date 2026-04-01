/**
 * Currency Utilities – Frontend
 *
 * ALL monetary values from the backend are kobo integers (₦1 = 100 kobo).
 * Users always TYPE and SEE Naira amounts. This file handles the boundary.
 *
 * Usage:
 *   - nairaToKobo()  → before sending any amount to the API
 *   - formatNaira()  → whenever displaying any monetary value from the API
 *   - koboToNaira()  → when you need the raw Naira number (e.g., for <input> prefill)
 */

/**
 * Convert a Naira amount typed by the user into kobo for the API.
 * @param {number|string} naira - User-typed Naira amount (e.g. 10000 or "10000")
 * @returns {number} Integer kobo amount (e.g. 1000000)
 */
export const nairaToKobo = (naira) => {
    const parsed = parseFloat(naira);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
};

/**
 * Convert a kobo integer from the API back to a Naira number.
 * Use this when you need the raw number (e.g., to pre-fill an <input>).
 * @param {number} kobo - Integer kobo amount (e.g. 1000000)
 * @returns {number} Naira amount (e.g. 10000)
 */
export const koboToNaira = (kobo) => {
    if (!kobo && kobo !== 0) return 0;
    return kobo / 100;
};

/**
 * Format a kobo integer from the API as a display-ready Naira string.
 * Use this for ALL monetary display in the UI.
 * @param {number} kobo - Integer kobo amount (e.g. 1000000)
 * @returns {string} Display string (e.g. "₦10,000.00")
 */
export const formatNaira = (kobo) => {
    if (!kobo && kobo !== 0) return '₦0.00';
    const naira = kobo / 100;
    return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
