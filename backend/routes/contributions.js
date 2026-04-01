import express from 'express';
import {
    submitContribution,
    getGroupContributions,
    getMyContributions,
    getPendingContributions,
    verifyContribution,
    getContributionStats,
    getContributionSummary
} from '../controllers/contributionController.js';
import { protect } from '../middleware/auth.js';
import { checkGroupAdmin } from '../middleware/adminCheck.js';

const router = express.Router();

// Protected routes - require authentication
router.use(protect);

// Submit contribution via wallet
router.post('/', submitContribution);

// Get user's own contributions
router.get('/my', getMyContributions);

// Get all contributions for a specific group
router.get('/group/:groupId', getGroupContributions);

// Get contribution statistics for a group
router.get('/stats/:groupId', getContributionStats);

// Get contribution summary for user in a group (used by GroupDetail page)
router.get('/summary/:groupId', getContributionSummary);

// Admin-only routes
router.get('/pending/:groupId', checkGroupAdmin, getPendingContributions);
router.put('/:id/verify', verifyContribution);

export default router;
