import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a group name'],
        trim: true,
        minlength: [3, 'Group name must be at least 3 characters'],
        maxlength: [100, 'Group name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    joinCode: {
        type: String,
        required: true,
        unique: true,
        length: 6
    },
    contributionAmount: {
        type: Number,
        required: [true, 'Please specify contribution amount'],
        min: [1, 'Contribution amount must be positive']
    },
    contributionFrequency: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'monthly'
    },
    contributionPeriodMonths: {
        type: Number,
        required: true,
        min: 1,
        max: 6,
        default: 6
    },
    totalCycles: {
        type: Number
    },
    currentCycle: {
        type: Number,
        default: 1
    },
    maxMembers: {
        type: Number,
        required: true,
        min: [1, 'Group must have at least 1 member'],
        max: [10, 'Group cannot have more than 10 members'],
        default: 6
    },
    // Auto-calculated fields (computed via pre-save hooks)
    totalPerCycle: {
        type: Number,
        default: 0,
        min: [0, 'Total per cycle cannot be negative']
    },
    totalPayout: {
        type: Number,
        default: 0,
        min: [0, 'Total payout cannot be negative']
    },
    // Financial tracking fields for wallet integration
    currentEscrowBalance: {
        type: Number,
        default: 0,
        min: [0, 'Escrow balance cannot be negative']
    },
    totalContributed: {
        type: Number,
        default: 0,
        min: [0, 'Total contributed cannot be negative']
    },
    // Savings mode configuration
    savingsMode: {
        type: String,
        enum: ['group', 'individual'],
        default: 'group'
    },
    isInviteEnabled: {
        type: Boolean,
        default: true
    },
    latePaymentPenalty: {
        type: Number,
        default: 0,
        min: [0, 'Penalty cannot be negative']
    },
    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        payoutTurn: {
            type: Number,
            required: true
        },
        hasReceivedPayout: {
            type: Boolean,
            default: false
        }
    }],
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    closedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Pre-save hook: Enforce contribution frequency rules (MUST RUN FIRST)
groupSchema.pre('save', function (next) {
    // Frequency-based mode and member limits
    if (this.contributionFrequency === 'daily') {
        // Daily = Individual personal savings only
        this.savingsMode = 'individual';
        this.maxMembers = 1;
        this.isInviteEnabled = false;

        // Force members array to only contain admin
        if (this.members.length > 1) {
            this.members = this.members.filter(m =>
                m.userId.toString() === this.adminId.toString()
            );
        }
    } else if (this.contributionFrequency === 'weekly') {
        // Weekly = Group mode, max 10 members
        this.savingsMode = 'group';
        this.isInviteEnabled = true;
        if (this.maxMembers > 10) {
            this.maxMembers = 10;
        }
    } else if (this.contributionFrequency === 'monthly') {
        // Monthly = Group mode, max 6 members
        this.savingsMode = 'group';
        this.isInviteEnabled = true;
        if (this.maxMembers > 6) {
            this.maxMembers = 6;
        }
    }

    next();
});

// Calculate total cycles based on frequency and period
groupSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('contributionFrequency') || this.isModified('contributionPeriodMonths')) {
        if (this.contributionFrequency === 'daily') {
            this.totalCycles = this.contributionPeriodMonths * 30; // Approx 30 days per month
        } else if (this.contributionFrequency === 'weekly') {
            this.totalCycles = this.contributionPeriodMonths * 4;
        } else if (this.contributionFrequency === 'monthly') {
            this.totalCycles = this.contributionPeriodMonths;
        }
    }
    next();
});

// Calculate totalPerCycle and totalPayout based on contribution amount and member count
// These are auto-calculated to ensure accuracy and prevent manual errors
groupSchema.pre('save', function (next) {
    // Only recalculate if contribution amount or members array changed
    if (this.isNew || this.isModified('contributionAmount') || this.isModified('members')) {
        const memberCount = this.members.length;

        // totalPerCycle = contribution amount × number of members
        this.totalPerCycle = this.contributionAmount * memberCount;

        // totalPayout = same as totalPerCycle (each member receives the full pool once)
        this.totalPayout = this.contributionAmount * memberCount;
    }
    next();
});

// Calculate end date based on start date, frequency, and period
groupSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('startDate') || this.isModified('contributionPeriodMonths')) {
        const endDate = new Date(this.startDate);
        endDate.setMonth(endDate.getMonth() + this.contributionPeriodMonths);
        this.endDate = endDate;
    }
    next();
});

const Group = mongoose.model('Group', groupSchema);

export default Group;
