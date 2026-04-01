import * as walletService from '../services/walletService.js';
import { getPlatformConfig } from '../services/platformConfigService.js';
import { convertNairaToKobo } from '../utils/currency.js';

/**
 * @desc    Get user's wallet balance
 * @route   GET /api/wallet
 * @access  Private
 */
export const getWallet = async (req, res) => {
    try {
        const wallet = await walletService.getWalletBalance(req.user.id);

        res.status(200).json({
            success: true,
            data: { wallet }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching wallet',
            error: error.message
        });
    }
};

/**
 * @desc    Fund wallet with simulated money
 * @route   POST /api/wallet/fund
 * @access  Private
 */
export const fundWallet = async (req, res) => {
    try {
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid amount greater than zero'
            });
        }

        // Convert user-supplied Naira amount to kobo for storage
        const amountKobo = convertNairaToKobo(parseFloat(amount));

        const result = await walletService.fundWallet(
            req.user.id,
            amountKobo,
            description || 'Wallet funding (demo)'
        );

        res.status(200).json({
            success: true,
            message: result.message,
            data: { wallet: result.wallet }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error funding wallet',
            error: error.message
        });
    }
};

/**
 * @desc    Get transaction history
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
export const getTransactions = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const skip = parseInt(req.query.skip) || 0;

        const result = await walletService.getTransactionHistory(
            req.user.id,
            limit,
            skip
        );

        res.status(200).json({
            success: true,
            data: {
                transactions: result.transactions,
                total: result.total,
                hasMore: result.hasMore
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions',
            error: error.message
        });
    }
};
/**
 * @desc    Get platform configuration (commission rate, etc.)
 * @route   GET /api/wallet/platform-config
 * @access  Private
 */
export const getPlatformConfiguration = async (req, res) => {
    try {
        const config = await getPlatformConfig();
        res.status(200).json({
            success: true,
            data: {
                commissionRate: config.platform_commission_percentage,
                companyWalletBalance: config.company_wallet_balance
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching platform configuration',
            error: error.message
        });
    }
};


