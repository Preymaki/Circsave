import express from 'express';
import {
    getMyInsights,
    generateInsight,
    markInsightAsRead,
    checkContributionFraud
} from '../controllers/insightsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes - require authentication
router.use(protect);

// Get user's insights
router.get('/my', getMyInsights);

// Generate new insight
router.post('/generate', generateInsight);

// Mark insight as read
router.put('/:id/read', markInsightAsRead);

// Fraud check for contribution (admin can use this)
router.post('/fraud-check/:contributionId', checkContributionFraud);

export default router;
