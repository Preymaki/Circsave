import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    availableBalance: {
        type: Number,
        default: 0,
        min: [0, 'Available balance cannot be negative']
    },
    lockedBalance: {
        type: Number,
        default: 0,
        min: [0, 'Locked balance cannot be negative']
    },
    totalFunded: {
        type: Number,
        default: 0,
        min: [0, 'Total funded cannot be negative']
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: [0, 'Total spent cannot be negative']
    }
}, {
    timestamps: true
});

// Virtual to calculate total balance
walletSchema.virtual('totalBalance').get(function () {
    return this.availableBalance + this.lockedBalance;
});

// Ensure virtuals are included in JSON response
walletSchema.set('toJSON', { virtuals: true });
walletSchema.set('toObject', { virtuals: true });

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
