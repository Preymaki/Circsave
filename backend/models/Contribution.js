import mongoose from 'mongoose';

const contributionSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cycleNumber: {
        type: Number,
        required: true,
        min: 1
    },
    amount: {
        type: Number,
        required: true,
        min: [0, 'Amount cannot be negative']
    },
    // WALLET-ONLY SYSTEM: Receipt fields kept optional for historical data compatibility
    receiptUrl: {
        type: String,
        required: false  // Changed from required to optional for legacy data
    },
    // New wallet-based fields
    walletTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    dueDate: {
        type: Date,
        required: true
    },
    paidAt: {
        type: Date
    },
    // Auto-debit tracking
    isAutoDebited: {
        type: Boolean,
        default: false
    },
    autoDebitedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['scheduled', 'paid', 'missed', 'locked', 'released'],
        default: 'scheduled'
    },
    isLate: {
        type: Boolean,
        default: false
    },
    penaltyAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    }
}, {
    timestamps: true
});

// Index for faster queries
contributionSchema.index({ groupId: 1, userId: 1, cycleNumber: 1 });

const Contribution = mongoose.model('Contribution', contributionSchema);

export default Contribution;
