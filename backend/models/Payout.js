import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    recipientId: {
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
    scheduledDate: {
        type: Date,
        required: true
    },
    paidAt: {
        type: Date
    },
    // WALLET-ONLY SYSTEM: Reference to wallet transaction
    walletTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    status: {
        type: String,
        enum: ['scheduled', 'processing', 'completed', 'failed', 'insufficient_funds'],
        default: 'scheduled'
    },
    isAutomated: {
        type: Boolean,
        default: false
    },
    processedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
payoutSchema.index({ groupId: 1, cycleNumber: 1 });

const Payout = mongoose.model('Payout', payoutSchema);

export default Payout;
