import express from 'express';
import { getWallet, fundWallet, getTransactions, getPlatformConfiguration, withdrawWallet } from '../controllers/walletController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All wallet routes require authentication
router.use(protect);

// Wallet routes
router.get('/', getWallet);
router.post('/fund', fundWallet);
router.post('/withdraw', withdrawWallet);
router.get('/transactions', getTransactions);
router.get('/platform-config', getPlatformConfiguration);

export default router;
