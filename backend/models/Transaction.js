import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: ['fund', 'lock', 'unlock', 'escrow_deposit', 'payout', 'refund'],
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0, 'Transaction amount cannot be negative']
    },
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    reference: {
        type: String,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    metadata: {
        groupId: mongoose.Schema.Types.ObjectId,
        contributionId: mongoose.Schema.Types.ObjectId,
        payoutId: mongoose.Schema.Types.ObjectId
    }
}, {
    timestamps: true
});

// Index for efficient querying
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
