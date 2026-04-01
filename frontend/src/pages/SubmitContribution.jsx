import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { DollarSign, AlertCircle, ArrowLeft, Calendar, Wallet, CheckCircle, Info } from 'lucide-react';
import { formatNaira, nairaToKobo, koboToNaira } from '../utils/currency';

export default function SubmitContribution() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [group, setGroup] = useState(null);
    const [formData, setFormData] = useState({
        cycleNumber: '1',
        amount: '',
        notes: ''
    });
    const [walletBalance, setWalletBalance] = useState(null);

    useEffect(() => {
        fetchGroup();
        fetchWallet();
    }, [groupId]);

    const fetchGroup = async () => {
        try {
            const response = await api.get(`/groups/${groupId}`);
            if (response.data.success) {
                setGroup(response.data.data.group);
                // Pre-fill amount in Naira (convert from the stored kobo value)
                setFormData(prev => ({
                    ...prev,
                    amount: koboToNaira(response.data.data.group.contributionAmount).toString()
                }));
            }
        } catch (err) {
            setError('Failed to load group details');
        }
    };

    const fetchWallet = async () => {
        try {
            const response = await api.get('/wallet');
            if (response.data.success) {
                setWalletBalance(response.data.data.wallet);
            }
        } catch (err) {
            console.error('Error fetching wallet:', err);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // WALLET-ONLY SYSTEM: Check balance before submitting
        // Amount is Naira (user-typed); wallet balance is kobo
        const contributionAmountKobo = nairaToKobo(parseFloat(formData.amount));
        if (walletBalance && walletBalance.availableBalance < contributionAmountKobo) {
            setError(`Insufficient wallet balance. You need ${formatNaira(contributionAmountKobo)} but only have ${formatNaira(walletBalance.availableBalance)}`);
            setLoading(false);
            return;
        }

        try {
            // WALLET-ONLY: Send Naira amount; contributionController converts to kobo
            const response = await api.post('/contributions', {
                groupId,
                cycleNumber: formData.cycleNumber,
                amount: parseFloat(formData.amount),
                notes: formData.notes
            });

            if (response.data.success) {
                setSuccess(true);
                // Refresh wallet balance
                fetchWallet();
                setTimeout(() => {
                    navigate(`/group/${groupId}`);
                }, 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit contribution');
        } finally {
            setLoading(false);
        }
    };

    if (!group) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    // insufficientBalance check: compare user-typed Naira vs available kobo balance
    const insufficientBalance = walletBalance && nairaToKobo(parseFloat(formData.amount)) > walletBalance.availableBalance;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link to={`/group/${groupId}`} className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Group
                    </Link>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                        Submit Contribution
                    </h1>
                    <p className="text-slate-600">{group.name}</p>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-green-800">Contribution paid successfully from your wallet!</p>
                            <p className="text-sm text-green-700">Redirecting to group page...</p>
                        </div>
                    </div>
                )}

                {/* Wallet-Only System Notice */}
                <div className="bg-gradient-to-r from-blue-50 to-primary-50 border-2 border-primary-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-primary-900 mb-1">Wallet-Only Payment System</p>
                            <p className="text-sm text-primary-700">
                                This contribution will be paid directly from your in-app wallet. No receipt upload needed.
                            </p>
                        </div>
                    </div>
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

                        {/* Wallet Balance Info */}
                        {walletBalance && (
                            <div className={`border-2 rounded-lg p-4 mb-4 ${insufficientBalance
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gradient-to-r from-primary-50 to-secondary-50 border-primary-200'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600 mb-1 flex items-center gap-2">
                                            <Wallet className="w-4 h-4" />
                                            Your Wallet Balance
                                        </p>
                                        <p className="text-2xl font-bold text-slate-800">
                                            {formatNaira(walletBalance.availableBalance)}
                                        </p>
                                        {walletBalance.lockedBalance > 0 && (
                                            <p className="text-xs text-orange-600 mt-1">
                                                {formatNaira(walletBalance.lockedBalance)} locked
                                            </p>
                                        )}
                                    </div>
                                    <Link
                                        to="/wallet"
                                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                        Add Funds →
                                    </Link>
                                </div>
                                {insufficientBalance && (
                                    <div className="mt-3 pt-3 border-t border-red-200">
                                        <p className="text-sm text-red-600 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            Insufficient balance. Please{' '}
                                            <Link to="/wallet" className="underline font-medium">
                                                fund your wallet
                                            </Link>
                                            {' '}first.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Contribution Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-primary-600" />
                                Contribution Details
                            </h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="cycleNumber" className="label">
                                        Cycle Number *
                                    </label>
                                    <select
                                        id="cycleNumber"
                                        name="cycleNumber"
                                        value={formData.cycleNumber}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    >
                                        {[...Array(group.totalCycles)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                Cycle {i + 1}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="amount" className="label">
                                        Amount (₦) *
                                    </label>
                                    <input
                                        type="number"
                                        id="amount"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleChange}
                                        className="input-field"
                                        placeholder="10000"
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Expected: {formatNaira(group.contributionAmount)}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="notes" className="label">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="Any additional information..."
                                    rows={3}
                                    maxLength={500}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate(`/group/${groupId}`)}
                                className="btn-secondary flex-1"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || insufficientBalance}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Processing...
                                    </span>
                                ) : (
                                    'Pay from Wallet'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
