import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Users, DollarSign, Calendar, Clock, AlertCircle, ArrowLeft, Percent } from 'lucide-react';
import { formatNaira, nairaToKobo } from '../utils/currency';

export default function CreateGroup() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        contributionAmount: '',
        contributionFrequency: 'monthly',
        contributionPeriodMonths: '6',
        latePaymentPenalty: '',
        maxMembers: '6',
        startDate: new Date().toISOString().split('T')[0],
        daily_deduction_time: '12:00'  // only used for daily frequency (HH:MM UTC)
    });

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Handle frequency change - update maxMembers accordingly
        if (name === 'contributionFrequency') {
            const newMaxMembers = getMaxMembersForFrequency(value);
            setFormData({
                ...formData,
                contributionFrequency: value,
                maxMembers: newMaxMembers.toString()
            });
        } else if (name === 'maxMembers') {
            // Enforce frequency-based max limit
            const limit = getMaxMembersForFrequency(formData.contributionFrequency);
            const newValue = Math.min(parseInt(value) || 1, limit);
            setFormData({
                ...formData,
                maxMembers: newValue.toString()
            });
        } else {
            setFormData({
                ...formData,
                [name]: value
            });
        }
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/groups', {
                ...formData,
                // Send Naira values — groupController calls convertNairaToKobo() for storage
                contributionAmount: parseFloat(formData.contributionAmount),
                latePaymentPenalty: formData.latePaymentPenalty ? parseFloat(formData.latePaymentPenalty) : 0,
                contributionPeriodMonths: parseInt(formData.contributionPeriodMonths),
                maxMembers: parseInt(formData.maxMembers),
                // daily_deduction_time is only used if daily; backend ignores it for other frequencies
                daily_deduction_time: formData.contributionFrequency === 'daily' ? formData.daily_deduction_time : undefined
            });

            if (response.data.success) {
                navigate(`/group/${response.data.data.group.id}`);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    // Get max members allowed for frequency
    const getMaxMembersForFrequency = (freq) => {
        if (freq === 'daily') return 1;
        if (freq === 'weekly') return 10;
        return 6; // monthly
    };

    // Check if current mode is individual savings
    const isIndividualSavings = () => {
        return formData.contributionFrequency === 'daily';
    };

    // Get title based on mode
    const getGroupTitle = () => {
        return isIndividualSavings() ? 'Daily Personal Savings Goal' : 'Create New Group';
    };

    const calculateCycles = () => {
        const period = parseInt(formData.contributionPeriodMonths);
        if (formData.contributionFrequency === 'daily') {
            return period * 30; // Approx 30 days per month
        } else if (formData.contributionFrequency === 'weekly') {
            return period * 4;
        }
        return period;
    };

    // Calculate total payout per member (keep as Naira number for display math)
    const calculateTotalPayout = () => {
        const amount = parseFloat(formData.contributionAmount) || 0;
        const members = parseInt(formData.maxMembers) || 1;
        return amount * members;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                        {getGroupTitle()}
                    </h1>
                    <p className="text-slate-600">
                        {isIndividualSavings()
                            ? 'Build a daily savings habit and track your progress'
                            : 'Start a new savings circle with your community'
                        }
                    </p>
                </div>

                {/* Form */}
                <div className="card">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Group Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary-600" />
                                Group Information
                            </h3>

                            <div>
                                <label htmlFor="name" className="label">
                                    Group Name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="e.g., Family Savings Circle"
                                    required
                                    minLength={3}
                                    maxLength={100}
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className="label">
                                    Description (Optional)
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="Brief description of the group purpose..."
                                    rows={3}
                                    maxLength={500}
                                />
                            </div>
                        </div>

                        {/* Contribution Settings */}
                        <div className="space-y-4 pt-4 border-t border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-primary-600" />
                                Contribution Settings
                            </h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="contributionAmount" className="label">
                                        Contribution Amount (₦) *
                                    </label>
                                    <input
                                        type="number"
                                        id="contributionAmount"
                                        name="contributionAmount"
                                        value={formData.contributionAmount}
                                        onChange={handleChange}
                                        className="input-field"
                                        placeholder="10000"
                                        required
                                        min="1"
                                        step="0.01"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="contributionFrequency" className="label">
                                        Frequency *
                                    </label>
                                    <select
                                        id="contributionFrequency"
                                        name="contributionFrequency"
                                        value={formData.contributionFrequency}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    >
                                        <option value="daily">Daily (Personal Savings)</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                    {isIndividualSavings() && (
                                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-xs text-amber-800">
                                                <strong>⚠️ Personal Savings Mode:</strong> Daily contributions are for individual habit tracking. Group features and join codes are disabled.
                                            </p>
                                        </div>
                                    )}

                                {/* Daily deduction time — only shown for daily savings */}
                                {isIndividualSavings() && (
                                    <div className="mt-3">
                                        <label htmlFor="daily_deduction_time" className="label">
                                            <Clock className="w-4 h-4 inline mr-2" />
                                            Daily Deduction Time (UTC) *
                                        </label>
                                        <input
                                            type="time"
                                            id="daily_deduction_time"
                                            name="daily_deduction_time"
                                            value={formData.daily_deduction_time}
                                            onChange={handleChange}
                                            className="input-field"
                                            required={isIndividualSavings()}
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Your wallet will be automatically deducted at this time each day (UTC).
                                        </p>
                                    </div>
                                )}
                                </div>

                                <div>
                                    <label htmlFor="contributionPeriodMonths" className="label">
                                        Duration (Months) *
                                    </label>
                                    <select
                                        id="contributionPeriodMonths"
                                        name="contributionPeriodMonths"
                                        value={formData.contributionPeriodMonths}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    >
                                        <option value="1">1 Month</option>
                                        <option value="2">2 Months</option>
                                        <option value="3">3 Months</option>
                                        <option value="4">4 Months</option>
                                        <option value="5">5 Months</option>
                                        <option value="6">6 Months</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="startDate" className="label">
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        id="startDate"
                                        name="startDate"
                                        value={formData.startDate}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="latePaymentPenalty" className="label">
                                    <Percent className="w-4 h-4 inline mr-2" />
                                    Late Payment Penalty (₦) - Optional
                                </label>
                                <input
                                    type="number"
                                    id="latePaymentPenalty"
                                    name="latePaymentPenalty"
                                    value={formData.latePaymentPenalty}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Amount charged for late contributions
                                </p>
                            </div>

                            <div>
                                <label htmlFor="maxMembers" className="label">
                                    <Users className="w-4 h-4 inline mr-2" />
                                    {isIndividualSavings() ? 'Members (Personal Goal)' : 'Maximum Group Members *'}
                                </label>
                                <select
                                    id="maxMembers"
                                    name="maxMembers"
                                    value={formData.maxMembers}
                                    onChange={handleChange}
                                    className={`input-field ${isIndividualSavings() ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                    required
                                    disabled={isIndividualSavings()}
                                >
                                    <option value="1">1 Member</option>
                                    <option value="2">2 Members</option>
                                    <option value="3">3 Members</option>
                                    <option value="4">4 Members</option>
                                    <option value="5">5 Members</option>
                                    <option value="6">6 Members</option>
                                    {formData.contributionFrequency === 'weekly' && (
                                        <>
                                            <option value="7">7 Members</option>
                                            <option value="8">8 Members</option>
                                            <option value="9">9 Members</option>
                                            <option value="10">10 Members</option>
                                        </>
                                    )}
                                </select>
                                {isIndividualSavings() && (
                                    <p className="text-xs text-amber-600 mt-1 font-medium">
                                        ℹ️ Daily savings are personal goals (locked to 1 member only)
                                    </p>
                                )}
                                {!isIndividualSavings() && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Maximum number of members allowed in this group
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-6 space-y-3">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary-600" />
                                Group Summary
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-600">Total Cycles</p>
                                    <p className="text-lg font-bold text-slate-800">{calculateCycles()}</p>
                                </div>
                                <div>
                                    <p className="text-slate-600">Max Members</p>
                                    <p className="text-lg font-bold text-slate-800">{formData.maxMembers}</p>
                                </div>
                                <div>
                                    <p className="text-slate-600">Each Member Pays (per cycle)</p>
                                    <p className="text-lg font-bold text-primary-600">
                                        {formData.contributionAmount
                                            ? formatNaira(nairaToKobo(parseFloat(formData.contributionAmount)))
                                            : '₦0.00'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-600">Each Payout Amount</p>
                                    <p className="text-lg font-bold text-secondary-600">
                                        {formatNaira(nairaToKobo(calculateTotalPayout()))}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-primary-200">
                                <p className="text-xs text-slate-600">
                                    💡 <strong>How it works:</strong> All {formData.maxMembers} members contribute{' '}
                                    {formData.contributionAmount
                                        ? formatNaira(nairaToKobo(parseFloat(formData.contributionAmount)))
                                        : '₦0.00'}{' '}
                                    per cycle.
                                    Each member receives {formatNaira(nairaToKobo(calculateTotalPayout()))} exactly once during the rotation.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="btn-secondary flex-1"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Creating...
                                    </span>
                                ) : (
                                    'Create Group'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
