import { getAIModel } from '../config/ai.js';
import Contribution from '../models/Contribution.js';
import Group from '../models/Group.js';
import AIInsight from '../models/AIInsight.js';

/**
 * Generate financial insights for a user based on their contribution patterns
 * @param {string} userId - User ID
 * @param {string} groupId - Optional group ID to focus insights
 * @returns {Object} Generated insight
 */
export const generateFinancialInsights = async (userId, groupId = null) => {
    try {
        const model = getAIModel();

        // Get user's contributions
        const query = { userId };
        if (groupId) query.groupId = groupId;

        const contributions = await Contribution.find(query)
            .populate('groupId', 'name contributionAmount contributionFrequency')
            .sort('-createdAt')
            .limit(50);

        if (contributions.length === 0) {
            return {
                success: false,
                message: 'No contributions found to analyze'
            };
        }

        // Calculate statistics
        const totalContributions = contributions.length;
        const approvedContributions = contributions.filter(c => c.status === 'approved');
        const totalAmount = approvedContributions.reduce((sum, c) => sum + c.amount, 0);
        const lateContributions = contributions.filter(c => c.isLate).length;
        const latePercentage = ((lateContributions / totalContributions) * 100).toFixed(2);

        // Get unique groups
        const groups = [...new Set(contributions.map(c => c.groupId?.name).filter(Boolean))];

        // Create prompt for AI
        const prompt = `You are a financial advisor analyzing a user's savings circle contribution patterns. 

User Statistics:
- Total contributions: ${totalContributions}
- Approved contributions: ${approvedContributions.length}
- Total amount contributed: ₦${totalAmount.toLocaleString()}
- Late contributions: ${lateContributions} (${latePercentage}%)
- Active groups: ${groups.join(', ')}

Based on these patterns, provide:
1. A brief assessment of their savings discipline (2-3 sentences)
2. One specific actionable recommendation to improve their savings habits
3. A motivational insight about their progress

Keep the response concise, friendly, and encouraging. Format as plain text, maximum 150 words.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const insightContent = response.text();

        // Save insight to database
        const insight = await AIInsight.create({
            userId,
            groupId: groupId || null,
            insightType: 'advice',
            content: insightContent
        });

        return {
            success: true,
            insight
        };
    } catch (error) {
        console.error('Error generating financial insights:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Analyze contribution pattern and identify saving habits
 * @param {string} userId - User ID
 * @param {string} groupId - Group ID
 * @returns {Object} Pattern analysis
 */
export const analyzeSavingPattern = async (userId, groupId) => {
    try {
        const model = getAIModel();

        const contributions = await Contribution.find({ userId, groupId })
            .sort('cycleNumber');

        if (contributions.length < 3) {
            return {
                success: false,
                message: 'Not enough data to analyze patterns'
            };
        }

        // Calculate pattern metrics
        const onTimeCount = contributions.filter(c => !c.isLate).length;
        const consistencyRate = ((onTimeCount / contributions.length) * 100).toFixed(2);

        // Check for improvement trend
        const recentContributions = contributions.slice(-5);
        const recentOnTime = recentContributions.filter(c => !c.isLate).length;
        const recentRate = ((recentOnTime / recentContributions.length) * 100).toFixed(2);

        const prompt = `Analyze this savings pattern:
- Overall on-time rate: ${consistencyRate}%
- Recent on-time rate (last 5): ${recentRate}%
- Total contributions: ${contributions.length}

Identify the pattern (improving, declining, or stable) and provide a brief 2-sentence insight about their saving habit.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const patternInsight = response.text();

        const insight = await AIInsight.create({
            userId,
            groupId,
            insightType: 'saving_pattern',
            content: patternInsight
        });

        return {
            success: true,
            insight,
            metrics: {
                consistencyRate: parseFloat(consistencyRate),
                recentRate: parseFloat(recentRate),
                trend: recentRate > consistencyRate ? 'improving' : recentRate < consistencyRate ? 'declining' : 'stable'
            }
        };
    } catch (error) {
        console.error('Error analyzing saving pattern:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Detect potential fraudulent receipt patterns
 * @param {string} contributionId - Contribution ID
 * @returns {Object} Fraud detection result
 */
export const detectFraudulentReceipt = async (contributionId) => {
    try {
        const contribution = await Contribution.findById(contributionId)
            .populate('userId', 'fullName')
            .populate('groupId', 'name contributionAmount');

        if (!contribution) {
            return {
                success: false,
                message: 'Contribution not found'
            };
        }

        // Simple fraud indicators
        const indicators = [];
        let fraudScore = 0;

        // Check if amount matches expected
        if (Math.abs(contribution.amount - contribution.groupId.contributionAmount) > 100) {
            indicators.push('Amount significantly different from expected');
            fraudScore += 30;
        }

        // Check if submitted very late
        if (contribution.isLate && contribution.penaltyAmount > 0) {
            indicators.push('Late submission with penalty');
            fraudScore += 10;
        }

        // Check for duplicate submissions in same cycle
        const duplicates = await Contribution.countDocuments({
            userId: contribution.userId._id,
            groupId: contribution.groupId._id,
            cycleNumber: contribution.cycleNumber,
            _id: { $ne: contribution._id }
        });

        if (duplicates > 0) {
            indicators.push('Multiple submissions for same cycle');
            fraudScore += 40;
        }

        // Update contribution with AI analysis
        contribution.aiAnalysis = {
            fraudScore,
            flagged: fraudScore > 50,
            reason: indicators.length > 0 ? indicators.join('; ') : 'No suspicious patterns detected',
            analysisDate: new Date()
        };

        await contribution.save();

        return {
            success: true,
            fraudScore,
            flagged: fraudScore > 50,
            indicators,
            contribution
        };
    } catch (error) {
        console.error('Error detecting fraud:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Generate savings projection for a user in a group
 * @param {string} userId - User ID
 * @param {string} groupId - Group ID
 * @returns {Object} Projection data
 */
export const generateSavingsProjection = async (userId, groupId) => {
    try {
        const model = getAIModel();

        const group = await Group.findById(groupId);
        if (!group) {
            return {
                success: false,
                message: 'Group not found'
            };
        }

        const contributions = await Contribution.find({
            userId,
            groupId,
            status: 'approved'
        });

        const totalSaved = contributions.reduce((sum, c) => sum + c.amount, 0);
        const totalPenalties = contributions.reduce((sum, c) => sum + c.penaltyAmount, 0);
        const remainingCycles = group.totalCycles - group.currentCycle;
        const expectedAmount = group.contributionAmount;

        // Calculate projection
        const projectedTotal = totalSaved + (remainingCycles * expectedAmount);
        const projectedPenalties = totalPenalties + (remainingCycles * (totalPenalties / Math.max(contributions.length, 1)));

        const prompt = `Create a brief savings projection summary:
- Current total saved: ₦${totalSaved.toLocaleString()}
- Projected final total: ₦${projectedTotal.toLocaleString()}
- Remaining cycles: ${remainingCycles}
- Expected per cycle: ₦${expectedAmount.toLocaleString()}

Provide an encouraging 2-sentence projection summary.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const projectionInsight = response.text();

        const insight = await AIInsight.create({
            userId,
            groupId,
            insightType: 'forecast',
            content: projectionInsight
        });

        return {
            success: true,
            insight,
            projection: {
                currentTotal: totalSaved,
                projectedTotal,
                remainingCycles,
                expectedPerCycle: expectedAmount,
                totalPenalties,
                projectedPenalties: Math.round(projectedPenalties)
            }
        };
    } catch (error) {
        console.error('Error generating projection:', error);
        return {
            success: false,
            message: error.message
        };
    }
};
