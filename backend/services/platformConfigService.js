import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { serverTimestamp } from '../db/converters.js';
import { formatKoboAsNaira } from '../utils/currency.js';

const PLATFORM_CONFIG_DOC = 'platform_config';
const DEFAULT_COMMISSION_PERCENTAGE = 1; // 1%
const DEFAULT_GRACE_PERIOD_DAYS = 3;

/**
 * Get platform configuration from Firestore.
 * Creates the document with defaults if it doesn't exist yet.
 * NOTE: company_wallet_balance is stored as an INTEGER in KOBO.
 */
export const getPlatformConfig = async () => {
    const ref = db.collection(COLLECTIONS.SETTINGS).doc(PLATFORM_CONFIG_DOC);
    const doc = await ref.get();

    if (!doc.exists) {
        // Seed default config on first call
        const defaults = {
            platform_commission_percentage: DEFAULT_COMMISSION_PERCENTAGE,
            grace_period_days: DEFAULT_GRACE_PERIOD_DAYS,
            company_wallet_balance: 0, // kobo integer
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        await ref.set(defaults);
        return { id: doc.id, ...defaults, platform_commission_percentage: DEFAULT_COMMISSION_PERCENTAGE, grace_period_days: DEFAULT_GRACE_PERIOD_DAYS };
    }

    return { id: doc.id, ...doc.data() };
};

/**
 * Calculate commission breakdown for a given payout amount.
 * All values are INTEGER KOBO. No floating-point arithmetic.
 *
 * @param {number} grossAmountKobo - Full payout amount in KOBO (integer)
 * @param {number} commissionPercentage - Platform commission % (e.g. 1 for 1%)
 * @returns {{ grossPayout, commissionRate, commission, netPayout }} — all in kobo
 */
export const calculateCommission = (grossAmountKobo, commissionPercentage = DEFAULT_COMMISSION_PERCENTAGE) => {
    // Integer arithmetic only — floor to avoid over-deducting
    const commission = Math.floor(grossAmountKobo * commissionPercentage / 100);
    const netPayout = grossAmountKobo - commission;

    return {
        grossPayout: grossAmountKobo,    // kobo
        commissionRate: commissionPercentage,
        commission,                       // kobo
        netPayout                         // kobo
    };
};

/**
 * Increment the company wallet balance inside an existing Firestore transaction.
 * Must be called within a db.runTransaction() block.
 * All amounts are INTEGER KOBO.
 *
 * @param {FirebaseFirestore.Transaction} transaction - Active Firestore transaction
 * @param {number} commissionAmountKobo - Amount to credit in KOBO (integer)
 */
export const creditCompanyWalletInTransaction = async (transaction, commissionAmountKobo) => {
    const configRef = db.collection(COLLECTIONS.SETTINGS).doc(PLATFORM_CONFIG_DOC);
    const configDoc = await transaction.get(configRef);

    const currentBalance = configDoc.exists
        ? (configDoc.data().company_wallet_balance || 0)
        : 0;

    // Integer addition — no rounding needed
    const newBalance = currentBalance + commissionAmountKobo;

    if (configDoc.exists) {
        transaction.update(configRef, {
            company_wallet_balance: newBalance,
            updatedAt: serverTimestamp()
        });
    } else {
        transaction.set(configRef, {
            platform_commission_percentage: DEFAULT_COMMISSION_PERCENTAGE,
            company_wallet_balance: newBalance,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }

    return newBalance;
};

/**
 * Get configured grace period in days.
 * Falls back to DEFAULT_GRACE_PERIOD_DAYS if not set in Firestore.
 * @returns {Promise<number>}
 */
export const getGracePeriodDays = async () => {
    const config = await getPlatformConfig();
    return config.grace_period_days ?? DEFAULT_GRACE_PERIOD_DAYS;
};
