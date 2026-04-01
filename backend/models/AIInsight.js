import mongoose from 'mongoose';

const aiInsightSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    },
    insightType: {
        type: String,
        enum: ['saving_pattern', 'advice', 'forecast', 'reminder'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries
aiInsightSchema.index({ userId: 1, isRead: 1 });

const AIInsight = mongoose.model('AIInsight', aiInsightSchema);

export default AIInsight;
