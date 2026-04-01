import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatNaira, nairaToKobo } from '../utils/currency';
import {
    Wallet as WalletIcon,
    TrendingUp,
    Lock,
    DollarSign,
    ArrowLeft,
    AlertCircle,
    CheckCircle,
    ArrowUpRight,
    ArrowDownLeft,
    Shield,
    Clock,
    Plus,
    RefreshCw,
    Eye,
    EyeOff
} from 'lucide-react';

export default function WalletDashboard() {
    const { user } = useAuth();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [txPage, setTxPage] = useState(0);
    const [fundAmount, setFundAmount] = useState('');
    const [funding, setFunding] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showBalance, setShowBalance] = useState(true);
    // Quick amounts are Naira display values; sent as kobo to the API
    const [quickAmounts] = useState([5000, 10000, 25000, 50000]);
    const TX_LIMIT = 50;

    useEffect(() => {
        fetchWallet();
        fetchTransactions();
    }, []);

    const fetchWallet = async () => {
        try {
            const response = await api.get('/wallet');
            if (response.data.success) {
                setWallet(response.data.data.wallet);
            }
        } catch (err) {
            console.error('Error fetching wallet:', err);
            setError('Failed to load wallet');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Safely convert any timestamp shape to a JS Date.
     * Handles: ISO string, JS Date, Firestore Timestamp (.toDate()),
     * and JSON-serialized Firestore Timestamp ({ _seconds, _nanoseconds }).
     */
    const parseTimestamp = (ts) => {
        if (!ts) return null;
        if (typeof ts.toDate === 'function') return ts.toDate();       // Firestore Timestamp
        if (ts._seconds !== undefined) return new Date(ts._seconds * 1000); // JSON Firestore obj
        if (ts instanceof Date) return ts;
        const d = new Date(ts);
        return isNaN(d) ? null : d;
    };

    const sortByDate = (txns) =>
        [...txns].sort((a, b) => {
            const aTime = parseTimestamp(a.createdAt)?.getTime() ?? 0;
            const bTime = parseTimestamp(b.createdAt)?.getTime() ?? 0;
            return bTime - aTime;
        });

    const fetchTransactions = async () => {
        try {
            const response = await api.get(`/wallet/transactions?limit=${TX_LIMIT}&skip=0`);
            if (response.data.success) {
                setTransactions(sortByDate(response.data.data.transactions));
                setHasMore(response.data.data.hasMore);
                setTxPage(1);
            } else {
                setError(response.data.message || 'Failed to load transactions');
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load transaction history');
        }
    };

    const fetchMoreTransactions = async () => {
        setLoadingMore(true);
        try {
            const skip = txPage * TX_LIMIT;
            const response = await api.get(`/wallet/transactions?limit=${TX_LIMIT}&skip=${skip}`);
            if (response.data.success) {
                setTransactions(prev => sortByDate([...prev, ...response.data.data.transactions]));
                setHasMore(response.data.data.hasMore);
                setTxPage(p => p + 1);
            }
        } catch (err) {
            console.error('Error fetching more transactions:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleFundWallet = async (e) => {
        e.preventDefault();
        setFunding(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.post('/wallet/fund', {
                // Send Naira amount — walletController calls convertNairaToKobo()
                amount: parseFloat(fundAmount),
                description: 'Simulated wallet funding (demo mode)'
            });

            if (response.data.success) {
                setSuccess(`Successfully added ${formatNaira(nairaToKobo(parseFloat(fundAmount)))} to your wallet`);
                setFundAmount('');
                fetchWallet();
                fetchTransactions();

                // Auto-hide success message after 3 seconds
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            console.error('Funding error:', err);
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fund wallet';
            setError(errorMsg);
        } finally {
            setFunding(false);
        }
    };

    const handleQuickFund = async (amount) => {
        setFunding(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.post('/wallet/fund', {
                // Send Naira amount — walletController calls convertNairaToKobo()
                amount,
                description: 'Quick fund (demo mode)'
            });

            if (response.data.success) {
                setSuccess(`Successfully added ${formatNaira(nairaToKobo(amount))} to your wallet`);
                fetchWallet();
                fetchTransactions();
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            console.error('Quick funding error:', err);
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fund wallet';
            setError(errorMsg);
        } finally {
            setFunding(false);
        }
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'fund':
                return <ArrowDownLeft className="w-4 h-4" />;
            case 'lock':
            case 'escrow_deposit':
                return <ArrowUpRight className="w-4 h-4" />;
            case 'unlock':
            case 'payout':
                return <ArrowDownLeft className="w-4 h-4" />;
            case 'platform_fee':
                return <Shield className="w-4 h-4" />;
            default:
                return <RefreshCw className="w-4 h-4" />;
        }
    };

    const getTransactionTypeColor = (type) => {
        const colors = {
            fund: 'text-emerald-700 bg-emerald-50 border-emerald-200',
            lock: 'text-orange-700 bg-orange-50 border-orange-200',
            unlock: 'text-blue-700 bg-blue-50 border-blue-200',
            escrow_deposit: 'text-purple-700 bg-purple-50 border-purple-200',
            payout: 'text-green-700 bg-green-50 border-green-200',
            refund: 'text-cyan-700 bg-cyan-50 border-cyan-200',
            platform_fee: 'text-slate-500 bg-slate-50 border-slate-200'
        };
        return colors[type] || 'text-slate-700 bg-slate-50 border-slate-200';
    };

    const getTransactionTypeLabel = (type) => {
        const labels = {
            fund: 'Added Funds',
            lock: 'Locked',
            unlock: 'Unlocked',
            escrow_deposit: 'To Escrow',
            payout: 'Payout',
            refund: 'Refund',
            platform_fee: 'Platform Fee'
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Loading your wallet...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6 font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-5xl font-bold text-slate-900 mb-3 flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <WalletIcon className="w-8 h-8 text-white" />
                                </div>
                                My Wallet
                            </h1>
                            <p className="text-slate-600 text-lg">Manage your simulated funds for contributions</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl shadow-sm">
                                <Shield className="w-5 h-5 text-amber-600" />
                                <span className="text-sm font-semibold text-amber-800">Demo Mode - No Real Money</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Success/Error Alerts */}
                {success && (
                    <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 flex items-start gap-3 shadow-md animate-fade-in">
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-green-900">{success}</p>
                            <p className="text-sm text-green-700 mt-1">Your balance has been updated</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 shadow-md">
                        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="font-medium text-red-900">{error}</p>
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-6 mb-8">
                    {/* Main Balance Card */}
                    <div className="lg:col-span-2">
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 p-8 shadow-2xl">
                            {/* Decorative circles */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <p className="text-primary-100 text-sm font-medium mb-2 uppercase tracking-wide">Total Balance</p>
                                        <div className="flex items-center gap-4">
                                            {showBalance ? (
                                                <h2 className="text-6xl font-bold text-white">
                                                    {wallet ? formatNaira(wallet.totalBalance) : '₦0.00'}
                                                </h2>
                                            ) : (
                                                <h2 className="text-6xl font-bold text-white">₦••••••</h2>
                                            )}
                                            <button
                                                onClick={() => setShowBalance(!showBalance)}
                                                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                                            >
                                                {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        <p className="text-primary-100 text-sm mt-2">
                                            Available: {wallet ? formatNaira(wallet.availableBalance) : '₦0.00'}
                                        </p>
                                    </div>
                                    <DollarSign className="w-16 h-16 text-white opacity-20" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Lock className="w-5 h-5 text-orange-200" />
                                            <p className="text-white text-sm font-medium">Locked</p>
                                        </div>
                                        <p className="text-2xl font-bold text-white">
                                            {wallet ? formatNaira(wallet.lockedBalance) : '₦0.00'}
                                        </p>
                                        <p className="text-xs text-primary-100 mt-1">Pending approval</p>
                                    </div>

                                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-5 h-5 text-emerald-200" />
                                            <p className="text-white text-sm font-medium">Total Funded</p>
                                        </div>
                                        <p className="text-2xl font-bold text-white">
                                            {wallet ? formatNaira(wallet.totalFunded) : '₦0.00'}
                                        </p>
                                        <p className="text-xs text-primary-100 mt-1">Lifetime</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="card">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary-600" />
                            Quick Actions
                        </h3>

                        {/* Quick Amount Buttons */}
                        <div className="mb-6">
                            <p className="text-sm font-semibold text-slate-700 mb-3">Quick Add</p>
                            <div className="grid grid-cols-2 gap-2">
                                {quickAmounts.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => handleQuickFund(amount)}
                                        disabled={funding}
                                        className="px-4 py-3 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-primary-50 hover:to-primary-100 border-2 border-slate-200 hover:border-primary-300 rounded-xl font-semibold text-slate-800 hover:text-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        ₦{amount.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Amount Form */}
                        <form onSubmit={handleFundWallet} className="space-y-4">
                            <div>
                                <label htmlFor="fundAmount" className="block text-sm font-semibold text-slate-700 mb-2">
                                    Custom Amount
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₦</span>
                                    <input
                                        type="number"
                                        id="fundAmount"
                                        value={fundAmount}
                                        onChange={(e) => setFundAmount(e.target.value)}
                                        className="input-field pl-8 text-lg font-semibold"
                                        placeholder="Enter amount"
                                        min="1"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={funding || !fundAmount}
                                className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200"
                            >
                                {funding ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Processing...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <Plus className="w-5 h-5" />
                                        Add Funds
                                    </span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="card shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-primary-600" />
                            Transaction History
                        </h3>
                        {transactions.length > 0 && (
                            <button
                                onClick={fetchTransactions}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        )}
                    </div>

                    {transactions.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <WalletIcon className="w-10 h-10 text-slate-400" />
                            </div>
                            <p className="text-xl font-semibold text-slate-700 mb-2">No transactions yet</p>
                            <p className="text-slate-500">Your transaction history will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((txn) => (
                                <div
                                    key={txn.id}
                                    className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border-2 border-slate-100 hover:border-primary-200 hover:shadow-md transition-all"
                                >
                                    {/* Icon */}
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 ${getTransactionTypeColor(txn.type)}`}>
                                        {getTransactionIcon(txn.type)}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-slate-900">{txn.description}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getTransactionTypeColor(txn.type)}`}>
                                                {getTransactionTypeLabel(txn.type)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            {(() => {
                                                const d = parseTimestamp(txn.createdAt);
                                                return d
                                                    ? d.toLocaleString('en-GB', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })
                                                    : 'Date unavailable';
                                            })()}
                                        </p>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${txn.type === 'fund' || txn.type === 'payout' || txn.type === 'unlock'
                                            ? 'text-green-600'
                                            : txn.type === 'platform_fee'
                                                ? 'text-slate-400'
                                                : 'text-slate-700'
                                            }`}>
                                            {txn.type === 'fund' || txn.type === 'payout' || txn.type === 'unlock' ? '+' : '-'}
                                            {formatNaira(txn.amount)}
                                        </p>
                                        {/* Show commission breakdown for payout transactions */}
                                        {txn.type === 'payout' && txn.grossAmount && (
                                            <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                                                <p>Gross: {formatNaira(txn.grossAmount)}</p>
                                                <p className="text-red-400">Fee ({txn.commissionRate}%): -{formatNaira(txn.commission)}</p>
                                            </div>
                                        )}
                                        <p className="text-sm text-slate-500 mt-1">
                                            Balance: {txn.balanceAfter != null ? formatNaira(txn.balanceAfter) : '—'}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {/* Load More */}
                            {hasMore && (
                                <div className="pt-4 flex justify-center">
                                    <button
                                        onClick={fetchMoreTransactions}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-50 to-secondary-50 border-2 border-primary-200 hover:border-primary-400 text-primary-700 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
                                                Loading...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="w-4 h-4" />
                                                Load More
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
