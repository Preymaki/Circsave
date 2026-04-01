import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp } from '../db/converters.js';

/**
 * @desc    Get user's saved insights
 * @route   GET /api/insights/my
 * @access  Private
 */
export const getMyInsights = async (req, res) => {
    try {
        const { groupId, limit = 10, unreadOnly } = req.query;

        let query = db.collection(COLLECTIONS.AI_INSIGHTS || 'ai_insights')
            .where('userId', '==', req.user.id);

        if (groupId) query = query.where('groupId', '==', groupId);
        if (unreadOnly === 'true') query = query.where('isRead', '==', false);

        const snapshot = await query.orderBy('createdAt', 'desc').limit(parseInt(limit)).get();
        const insights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const unreadSnapshot = await db.collection(COLLECTIONS.AI_INSIGHTS || 'ai_insights')
            .where('userId', '==', req.user.id)
            .where('isRead', '==', false)
            .get();

        res.status(200).json({
            success: true,
            data: { insights, unreadCount: unreadSnapshot.size }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching insights', error: error.message });
    }
};

/**
 * @desc    Mark insight as read
 * @route   PUT /api/insights/:id/read
 * @access  Private
 */
export const markInsightAsRead = async (req, res) => {
    try {
        const insightRef = db.collection(COLLECTIONS.AI_INSIGHTS || 'ai_insights').doc(req.params.id);
        const insightDoc = await insightRef.get();

        if (!insightDoc.exists) {
            return res.status(404).json({ success: false, message: 'Insight not found' });
        }

        if (insightDoc.data().userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this insight' });
        }

        await insightRef.update(prepareForFirestore({ isRead: true, updatedAt: serverTimestamp() }));
        const updated = await insightRef.get();

        res.status(200).json({
            success: true,
            message: 'Insight marked as read',
            data: { insight: { id: updated.id, ...updated.data() } }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating insight', error: error.message });
    }
};

/**
 * @desc    Generate financial insights (placeholder - AI removed)
 * @route   POST /api/insights/generate
 * @access  Private
 */
export const generateInsight = async (req, res) => {
    res.status(200).json({
        success: true,
        message: 'AI insights are not enabled in this version',
        data: { insights: [] }
    });
};

/**
 * @desc    Fraud check placeholder
 * @route   POST /api/insights/fraud-check/:contributionId
 * @access  Private (Admin only)
 */
export const checkContributionFraud = async (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Fraud detection is not enabled in this version',
        data: { fraudulent: false }
    });
};
