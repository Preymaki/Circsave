import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp, increment, docToObject } from '../db/converters.js';
import { getPlatformConfig, calculateCommission, creditCompanyWalletInTransaction } from './platformConfigService.js';
import { formatKoboAsNaira } from '../utils/currency.js';

/**
 * Wallet Service - Handles all wallet operations with atomic transactions
 * CRITICAL: All balance operations must go through this service
 * Controllers must NEVER manipulate wallet balances directly
 * 
 * Converted to use Firestore transactions instead of Mongoose sessions
 */

/**
 * Get or create wallet for a user
 */
export const getOrCreateWallet = async (userId) => {
    const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
        const walletData = prepareForFirestore({
            userId,
            availableBalance: 0,
            lockedBalance: 0,
            totalFunded: 0,
            totalSpent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await walletRef.set(walletData);
        const wallet = { id: userId, ...walletData };
        wallet.totalBalance = (wallet.availableBalance || 0) + (wallet.lockedBalance || 0);
        return wallet;
    }

    const walletData = walletDoc.data();
    const wallet = { id: walletDoc.id, ...walletData };
    wallet.totalBalance = (wallet.availableBalance || 0) + (wallet.lockedBalance || 0);
    return wallet;
};

/**
 * Fund wallet with simulated money (demo mode)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to fund
 * @param {string} description - Transaction description
 */
export const fundWallet = async (userId, amount, description = 'Wallet funding') => {
    try {
        // Validate amount
        if (amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        // Get or create wallet
        let wallet = await getOrCreateWallet(userId);
        const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);

        // Record balance before
        const balanceBefore = wallet.availableBalance || 0;
        const newAvailableBalance = balanceBefore + amount;
        const newTotalFunded = (wallet.totalFunded || 0) + amount;

        // Update wallet
        await walletRef.update({
            availableBalance: newAvailableBalance,
            totalFunded: newTotalFunded,
            updatedAt: serverTimestamp()
        });

        // Log transaction
        const transactionData = prepareForFirestore({
            walletId: userId,
            userId,
            type: 'fund',
            amount,
            balanceBefore,
            balanceAfter: newAvailableBalance,
            description,
            status: 'completed',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await db.collection(COLLECTIONS.TRANSACTIONS).add(transactionData);

        // Get updated wallet
        const updatedWallet = await getOrCreateWallet(userId);

        return {
            success: true,
            wallet: updatedWallet,
            message: 'Wallet funded successfully'
        };
    } catch (error) {
        console.error('Fund wallet error:', error);
        throw error;
    }
};

/**
 * Lock funds for contribution (pending approval)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to lock
 * @param {string} reference - Contribution ID or reference
 */
export const lockFunds = async (userId, amount, reference, metadata = {}) => {
    try {
        // Validate amount
        if (amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        // Use Firestore transaction for atomicity
        const result = await db.runTransaction(async (transaction) => {
            const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
            const walletDoc = await transaction.get(walletRef);

            if (!walletDoc.exists) {
                throw new Error('Wallet not found');
            }

            const wallet = walletDoc.data();
            const availableBalance = wallet.availableBalance || 0;
            const lockedBalance = wallet.lockedBalance || 0;

            // Check sufficient balance (all values in kobo)
            if (availableBalance < amount) {
                throw new Error(`Insufficient balance. Available: ${formatKoboAsNaira(availableBalance)}, Required: ${formatKoboAsNaira(amount)}`);
            }

            // Record balances before
            const availableBalanceBefore = availableBalance;
            const lockedBalanceBefore = lockedBalance;

            // Move from available to locked
            const newAvailableBalance = availableBalance - amount;
            const newLockedBalance = lockedBalance + amount;

            transaction.update(walletRef, {
                availableBalance: newAvailableBalance,
                lockedBalance: newLockedBalance,
                updatedAt: serverTimestamp()
            });

            // Log transaction
            const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            const transactionData = prepareForFirestore({
                walletId: userId,
                userId,
                type: 'lock',
                amount,
                balanceBefore: availableBalanceBefore,
                balanceAfter: newAvailableBalance,
                reference,
                description: `Locked funds for contribution ${reference}`,
                status: 'completed',
                groupId: metadata.groupId || null,
                contributionId: metadata.contributionId || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            transaction.set(transactionRef, transactionData);

            return {
                availableBalance: newAvailableBalance,
                lockedBalance: newLockedBalance
            };
        });

        return {
            success: true,
            wallet: await getOrCreateWallet(userId),
            message: 'Funds locked successfully'
        };
    } catch (error) {
        console.error('Lock funds error:', error);
        throw error;
    }
};

/**
 * Unlock funds (on rejection or cancellation)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to unlock
 * @param {string} reference - Contribution ID or reference
 */
export const unlockFunds = async (userId, amount, reference) => {
    try {
        await db.runTransaction(async (transaction) => {
            const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
            const walletDoc = await transaction.get(walletRef);

            if (!walletDoc.exists) {
                throw new Error('Wallet not found');
            }

            const wallet = walletDoc.data();
            const availableBalance = wallet.availableBalance || 0;
            const lockedBalance = wallet.lockedBalance || 0;

            // Check sufficient locked balance
            if (lockedBalance < amount) {
                throw new Error('Insufficient locked balance');
            }

            // Move from locked to available
            const newLockedBalance = lockedBalance - amount;
            const newAvailableBalance = availableBalance + amount;

            transaction.update(walletRef, {
                lockedBalance: newLockedBalance,
                availableBalance: newAvailableBalance,
                updatedAt: serverTimestamp()
            });

            // Log transaction
            const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            const transactionData = prepareForFirestore({
                walletId: userId,
                userId,
                type: 'unlock',
                amount,
                balanceBefore: lockedBalance,
                balanceAfter: newLockedBalance,
                reference,
                description: `Unlocked funds for contribution ${reference}`,
                status: 'completed',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            transaction.set(transactionRef, transactionData);
        });

        return {
            success: true,
            wallet: await getOrCreateWallet(userId),
            message: 'Funds unlocked successfully'
        };
    } catch (error) {
        console.error('Unlock funds error:', error);
        throw error;
    }
};

/**
 * Move locked funds to group escrow (on approval)
 * @param {string} userId - User ID
 * @param {string} groupId - Group ID
 * @param {number} amount - Amount to move to escrow
 */
export const moveToEscrow = async (userId, groupId, amount) => {
    try {
        await db.runTransaction(async (transaction) => {
            const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
            const groupRef = db.collection(COLLECTIONS.GROUPS).doc(groupId);

            const walletDoc = await transaction.get(walletRef);
            const groupDoc = await transaction.get(groupRef);

            if (!walletDoc.exists) {
                throw new Error('Wallet not found');
            }
            if (!groupDoc.exists) {
                throw new Error('Group not found');
            }

            const wallet = walletDoc.data();
            const group = groupDoc.data();

            const lockedBalance = wallet.lockedBalance || 0;
            const currentEscrowBalance = group.currentEscrowBalance || 0;

            // Check sufficient locked balance
            if (lockedBalance < amount) {
                throw new Error('Insufficient locked balance');
            }

            // Move from user's locked balance to group escrow
            const newLockedBalance = lockedBalance - amount;
            const newTotalSpent = (wallet.totalSpent || 0) + amount;
            const newEscrowBalance = currentEscrowBalance + amount;

            transaction.update(walletRef, {
                lockedBalance: newLockedBalance,
                totalSpent: newTotalSpent,
                updatedAt: serverTimestamp()
            });

            transaction.update(groupRef, {
                currentEscrowBalance: newEscrowBalance,
                updatedAt: serverTimestamp()
            });

            // Log transaction
            const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            const transactionData = prepareForFirestore({
                walletId: userId,
                userId,
                type: 'escrow_deposit',
                amount,
                balanceBefore: lockedBalance,
                balanceAfter: newLockedBalance,
                reference: groupId,
                description: `Moved to group escrow: ${group.name}`,
                status: 'completed',
                groupId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            transaction.set(transactionRef, transactionData);
        });

        return {
            success: true,
            wallet: await getOrCreateWallet(userId),
            message: 'Funds moved to escrow successfully'
        };
    } catch (error) {
        console.error('Move to escrow error:', error);
        throw error;
    }
};

/**
 * Process payout from group escrow to recipient wallet.
 * Deducts 1% platform commission atomically before crediting the recipient.
 *
 * @param {string} recipientId - Recipient user ID
 * @param {string} groupId - Group ID
 * @param {number} grossAmount - Full payout amount (before commission)
 * @returns {{ success, wallet, commission: { grossPayout, commission, netPayout, commissionRate } }}
 */
export const processPayout = async (recipientId, groupId, grossAmount) => {
    try {
        // Fetch commission % from Firestore (outside transaction — read-only config)
        const platformConfig = await getPlatformConfig();
        const breakdown = calculateCommission(grossAmount, platformConfig.platform_commission_percentage);
        const { netPayout, commission, commissionRate } = breakdown;

        const configRef = db.collection(COLLECTIONS.SETTINGS).doc('platform_config');

        await db.runTransaction(async (transaction) => {
            const walletRef = db.collection(COLLECTIONS.WALLETS).doc(recipientId);
            const groupRef = db.collection(COLLECTIONS.GROUPS).doc(groupId);

            // ── ALL READS FIRST (Firestore transaction requirement) ──────────
            const walletDoc = await transaction.get(walletRef);
            const groupDoc = await transaction.get(groupRef);
            const configDoc = await transaction.get(configRef);
            // ───────────────────────────────────────────────────────────────

            if (!groupDoc.exists) {
                throw new Error('Group not found');
            }

            const wallet = walletDoc.exists ? walletDoc.data() : { availableBalance: 0 };
            const group = groupDoc.data();
            const currentEscrowBalance = group.currentEscrowBalance || 0;
            const availableBalance = wallet.availableBalance || 0;

            // Validate escrow has sufficient balance for the GROSS amount (all values in kobo)
            if (currentEscrowBalance < grossAmount) {
                throw new Error(`Insufficient escrow balance for payout. Required: ${formatKoboAsNaira(grossAmount)}, Available: ${formatKoboAsNaira(currentEscrowBalance)}`);
            }

            // ── ALL WRITES AFTER READS ──────────────────────────────────────

            // Create wallet if it doesn't exist yet
            if (!walletDoc.exists) {
                transaction.set(walletRef, prepareForFirestore({
                    userId: recipientId,
                    availableBalance: 0,
                    lockedBalance: 0,
                    totalFunded: 0,
                    totalSpent: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }));
            }

            // Deduct full gross from escrow, credit only net to recipient
            const newEscrowBalance = currentEscrowBalance - grossAmount;
            const newAvailableBalance = availableBalance + netPayout;

            transaction.update(walletRef, {
                availableBalance: newAvailableBalance,
                updatedAt: serverTimestamp()
            });

            transaction.update(groupRef, {
                currentEscrowBalance: newEscrowBalance,
                updatedAt: serverTimestamp()
            });

            // Credit commission to company wallet (integer kobo addition)
            const currentCompanyBalance = configDoc.exists
                ? (configDoc.data().company_wallet_balance || 0)
                : 0;
            const newCompanyBalance = currentCompanyBalance + commission;

            if (configDoc.exists) {
                transaction.update(configRef, {
                    company_wallet_balance: newCompanyBalance,
                    updatedAt: serverTimestamp()
                });
            } else {
                transaction.set(configRef, {
                    platform_commission_percentage: 1,
                    company_wallet_balance: newCompanyBalance,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            // Log payout transaction (net amount received by user)
            const payoutTxRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            transaction.set(payoutTxRef, prepareForFirestore({
                walletId: recipientId,
                userId: recipientId,
                type: 'payout',
                amount: netPayout,
                grossAmount,
                commission,
                commissionRate,
                balanceBefore: availableBalance,
                balanceAfter: newAvailableBalance,
                reference: groupId,
                description: `Payout received from group: ${group.name} (after ${commissionRate}% platform fee)`,
                status: 'completed',
                groupId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }));

            // Log platform_fee transaction for auditability
            const feeTxRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            transaction.set(feeTxRef, prepareForFirestore({
                walletId: 'platform',
                userId: recipientId,
                type: 'platform_fee',
                amount: commission,
                grossPayoutAmount: grossAmount,
                commissionRate,
                reference: groupId,
                description: `${commissionRate}% platform commission on payout from group: ${group.name}`,
                status: 'completed',
                groupId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }));
        });

        return {
            success: true,
            wallet: await getOrCreateWallet(recipientId),
            commission: breakdown,
            message: `Payout of ${formatKoboAsNaira(netPayout)} processed (${formatKoboAsNaira(commission)} platform fee deducted)`
        };
    } catch (error) {
        console.error('Process payout error:', error);
        throw error;
    }
};

/**
 * Get wallet balance for a user
 */
export const getWalletBalance = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return wallet;
};

/**
 * Get transaction history for a user
 */
export const getTransactionHistory = async (userId, limit = 50, skip = 0) => {
    const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
        return { transactions: [], total: 0, hasMore: false };
    }

    // Query transactions without orderBy to avoid requiring a composite index.
    // We sort client-side after fetching instead.
    const transactionsSnapshot = await db.collection(COLLECTIONS.TRANSACTIONS)
        .where('userId', '==', userId)
        .get();

    /**
     * Safely convert a Firestore Timestamp (or any date-like value) to an ISO string.
     * Firestore Timestamps serialized as JSON become { _seconds, _nanoseconds } plain objects,
     * which new Date() cannot parse. Handle all known shapes here.
     */
    const toISOString = (ts) => {
        if (!ts) return null;
        if (typeof ts.toDate === 'function') return ts.toDate().toISOString(); // Firestore Timestamp
        if (ts._seconds !== undefined) return new Date(ts._seconds * 1000).toISOString(); // JSON-serialized Timestamp
        if (ts instanceof Date) return ts.toISOString();
        const d = new Date(ts);
        return isNaN(d) ? null : d.toISOString();
    };

    // Convert docs and sort by createdAt descending
    const allTransactions = transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        // doc.createTime is Firestore's own internal document creation timestamp —
        // always available regardless of what was (or wasn't) stored in the document.
        // This is the fallback for existing records whose createdAt was never stored.
        const createdAt = toISOString(data.createdAt) || toISOString(doc.createTime);
        return {
            id: doc.id,
            ...data,
            createdAt,
            updatedAt: toISOString(data.updatedAt) || toISOString(doc.updateTime)
        };
    }).sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
    });

    const total = allTransactions.length;
    const transactions = allTransactions.slice(skip, skip + limit);

    return {
        transactions,
        total,
        hasMore: total > (skip + limit)
    };
};

/**
 * Withdraw funds from a user's wallet (simulated — no real bank transfer)
 * @param {string} userId      - User ID
 * @param {number} amount      - Amount in KOBO to withdraw
 * @param {string} bank        - Destination bank / fintech name
 * @param {string} accountNumber - 10-digit destination account number
 * @param {string} accountName - Destination account name
 * @param {string} [narration] - Optional narration
 * @returns {Object} { success, wallet, transactionId, message }
 */
export const withdrawWallet = async (userId, amount, bank, accountNumber, accountName, narration = '') => {
    try {
        if (amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        let transactionId;

        await db.runTransaction(async (transaction) => {
            const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
            const walletDoc = await transaction.get(walletRef);

            if (!walletDoc.exists) {
                throw new Error('Wallet not found. Please fund your wallet first.');
            }

            const wallet = walletDoc.data();
            const availableBalance = wallet.availableBalance || 0;

            // Validate sufficient balance (all values in kobo)
            if (availableBalance < amount) {
                throw new Error(
                    `Insufficient balance. Available: ${formatKoboAsNaira(availableBalance)}, Required: ${formatKoboAsNaira(amount)}`
                );
            }

            const newAvailableBalance = availableBalance - amount;

            // Debit the wallet
            transaction.update(walletRef, {
                availableBalance: newAvailableBalance,
                totalSpent: (wallet.totalSpent || 0) + amount,
                updatedAt: serverTimestamp()
            });

            // Log the withdrawal transaction
            const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            transactionId = transactionRef.id;

            transaction.set(transactionRef, prepareForFirestore({
                walletId: userId,
                userId,
                type: 'withdrawal',
                amount,
                balanceBefore: availableBalance,
                balanceAfter: newAvailableBalance,
                bank,
                accountNumber,
                accountName,
                narration: narration || '',
                description: `Withdrawal to ${bank} — ${accountNumber} (${accountName})`,
                status: 'successful',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }));
        });

        return {
            success: true,
            wallet: await getOrCreateWallet(userId),
            transactionId,
            message: `Withdrawal of ${formatKoboAsNaira(amount)} processed successfully`
        };
    } catch (error) {
        console.error('Withdraw wallet error:', error);
        throw error;
    }
};

/**
 * WALLET-ONLY SYSTEM: Debit wallet immediately for contribution
 * This replaces the lock/approve flow with instant payment
 * @param {string} userId - User ID
 * @param {string} groupId - Group ID
 * @param {number} amount - Contribution amount
 * @param {string} contributionId - Contribution reference ID
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Result with success status and wallet/transaction data
 */
export const debitForContribution = async (userId, groupId, amount, contributionId, metadata = {}) => {
    try {
        // Validate amount
        if (amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        let transactionId;

        await db.runTransaction(async (transaction) => {
            const walletRef = db.collection(COLLECTIONS.WALLETS).doc(userId);
            const groupRef = db.collection(COLLECTIONS.GROUPS).doc(groupId);

            const walletDoc = await transaction.get(walletRef);
            const groupDoc = await transaction.get(groupRef);

            if (!walletDoc.exists) {
                throw new Error('Wallet not found');
            }
            if (!groupDoc.exists) {
                throw new Error('Group not found');
            }

            const wallet = walletDoc.data();
            const group = groupDoc.data();

            const availableBalance = wallet.availableBalance || 0;
            const currentEscrowBalance = group.currentEscrowBalance || 0;
            const totalContributed = group.totalContributed || 0;

            // Check sufficient balance (all values in kobo)
            if (availableBalance < amount) {
                throw new Error(`Insufficient balance. Available: ${formatKoboAsNaira(availableBalance)}, Required: ${formatKoboAsNaira(amount)}`);
            }

            // Debit from wallet and add to group escrow
            const newAvailableBalance = availableBalance - amount;
            const newTotalSpent = (wallet.totalSpent || 0) + amount;
            const newEscrowBalance = currentEscrowBalance + amount;
            const newTotalContributed = totalContributed + amount;

            transaction.update(walletRef, {
                availableBalance: newAvailableBalance,
                totalSpent: newTotalSpent,
                updatedAt: serverTimestamp()
            });

            transaction.update(groupRef, {
                currentEscrowBalance: newEscrowBalance,
                totalContributed: newTotalContributed,
                updatedAt: serverTimestamp()
            });

            // Log transaction
            const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
            transactionId = transactionRef.id;

            const transactionData = prepareForFirestore({
                walletId: userId,
                userId,
                type: 'escrow_deposit',
                amount,
                balanceBefore: availableBalance,
                balanceAfter: newAvailableBalance,
                reference: contributionId,
                description: `Contribution payment for ${group.name} - Cycle ${metadata.cycleNumber || 'N/A'}`,
                status: 'completed',
                groupId,
                contributionId,
                ...metadata,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            transaction.set(transactionRef, transactionData);
        });

        return {
            success: true,
            wallet: await getOrCreateWallet(userId),
            transactionId,
            message: 'Contribution paid successfully'
        };
    } catch (error) {
        console.error('Debit for contribution error:', error);
        throw error;
    }
};
