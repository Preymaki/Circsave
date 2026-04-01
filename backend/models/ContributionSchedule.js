import mongoose from 'mongoose';

/**
 * ContributionSchedule Model
 * Tracks when contributions are due and manages auto-debit attempts
 */
const contributionScheduleSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    cycleNumber: {
        type: Number,
        required: true,
        min: 1
    },
    dueDate: {
        type: Date,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'auto-debited', 'manually-submitted', 'missed', 'verified', 'rejected'],
        default: 'pending',
        index: true
    },
    autoDebitAttempted: {
        type: Boolean,
        default: false
    },
    autoDebitedAt: {
        type: Date
    },
    contributionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contribution'
    },
    failureReason: {
        type: String
    },
    retryCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
contributionScheduleSchema.index({ groupId: 1, cycleNumber: 1 });
contributionScheduleSchema.index({ userId: 1, dueDate: 1 });
contributionScheduleSchema.index({ status: 1, dueDate: 1 });

const ContributionSchedule = mongoose.model('ContributionSchedule', contributionScheduleSchema);

export default ContributionSchedule;
