import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    ArrowLeft,
    Users,
    DollarSign,
    Calendar,
    Clock,
    Copy,
    CheckCircle,
    XCircle,
    Settings,
    UserMinus,
    Lock,
    Upload,
    FileText,
    Eye,
    TrendingUp,
    PiggyBank,
    Wallet,
    AlertTriangle,
    Info,
    ArrowUpDown,
    ShieldX,
    AlertOctagon
} from 'lucide-react';
import { formatNaira, koboToNaira } from '../utils/currency';

export default function GroupDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [group, setGroup] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [financialSummary, setFinancialSummary] = useState(null);
    const [wallet, setWallet] = useState(null);
    const [myStatus, setMyStatus] = useState(null);
    const [paying, setPaying] = useState(false);
    const [payingOut, setPayingOut] = useState(false);
    const [payoutResult, setPayoutResult] = useState(null);
    const [commissionRate, setCommissionRate] = useState(1);

    // Rotation-change state
    const [rotationTargetId, setRotationTargetId] = useState('');
    const [rotationLoading, setRotationLoading] = useState(false);
    const [rotationMsg, setRotationMsg] = useState(null);  // { type: 'success'|'error', text }

    useEffect(() => {
        fetchGroup();
        fetchFinancialSummary();
        fetchWallet();
        fetchMyStatus();
        fetchCommissionRate();
    }, [id]);

    const fetchGroup = async () => {
        try {
            const response = await api.get(`/groups/${id}`);
            setGroup(response.data.data.group);
            setIsAdmin(response.data.data.isAdmin);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load group');
        } finally {
            setLoading(false);
        }
    };

    const fetchFinancialSummary = async () => {
        try {
            const response = await api.get(`/groups/${id}/financial-summary`);
            if (response.data.success) {
                setFinancialSummary(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching financial summary:', err);
        }
    };

    const fetchWallet = async () => {
        try {
            const response = await api.get('/wallet');
            if (response.data.success) {
                setWallet(response.data.data.wallet);
            }
        } catch (err) {
            console.error('Error fetching wallet:', err);
        }
    };

    const fetchMyStatus = async () => {
        try {
            const response = await api.get(`/contributions/summary/${id}`);
            if (response.data.success) {
                setMyStatus(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching contribution status:', err);
        }
    };

    const fetchCommissionRate = async () => {
        try {
            const response = await api.get('/wallet/platform-config');
            if (response.data.success) {
                setCommissionRate(response.data.data.commissionRate);
            }
        } catch (err) {
            console.error('Error fetching commission rate:', err);
        }
    };

    const handlePayNow = async () => {
        if (!window.confirm(`Confirm payment of ${formatNaira(group.contributionAmount)}?`)) return;

        setPaying(true);
        try {
            await api.post('/contributions', {
                groupId: id,
                // Send Naira value; contributionController converts to kobo
                amount: koboToNaira(group.contributionAmount),
                cycleNumber: group.currentCycle
            });
            // Refresh all data
            fetchFinancialSummary();
            fetchMyStatus();
            fetchWallet();
            alert('Contribution paid successfully!');
        } catch (err) {
            alert(err.response?.data?.message || 'Payment failed');
        } finally {
            setPaying(false);
        }
    };

    const handleReleasePayout = async () => {
        if (!window.confirm(
            `Release payout of ${formatNaira(financialSummary?.totalPayout)} from escrow to the next recipient (${financialSummary?.nextPayoutRecipient?.fullName})? A platform fee will be deducted.`
        )) return;

        setPayingOut(true);
        setPayoutResult(null);
        try {
            const res = await api.post(`/groups/${id}/simulate-payout`);
            const data = res.data.data;
            setPayoutResult(data);
            // Refresh all data
            fetchGroup();
            fetchFinancialSummary();
            fetchWallet();
            fetchMyStatus();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to release payout');
        } finally {
            setPayingOut(false);
        }
    };

    const copyJoinCode = () => {
        navigator.clipboard.writeText(group.joinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCloseGroup = async () => {
        if (!window.confirm('Are you sure you want to close this group? This action cannot be undone.')) {
            return;
        }

        try {
            await api.post(`/groups/${id}/close`);
            fetchGroup();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to close group');
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this member?')) {
            return;
        }

        try {
            await api.delete(`/groups/${id}/members/${userId}`);
            fetchGroup();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to remove member');
        }
    };

    // ── Rotation-change handlers ─────────────────────────────────────────────
    const handleRequestRotation = async () => {
        if (!rotationTargetId) return;
        setRotationLoading(true);
        setRotationMsg(null);
        try {
            const res = await api.post(`/groups/${id}/rotation-change`, { targetUserId: rotationTargetId });
            setRotationMsg({ type: 'success', text: res.data.message });
            setRotationTargetId('');
            fetchGroup();
        } catch (err) {
            setRotationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit request' });
        } finally {
            setRotationLoading(false);
        }
    };

    const handleApproveRotation = async (requestId) => {
        setRotationLoading(true);
        setRotationMsg(null);
        try {
            const res = await api.post(`/groups/${id}/rotation-change/${requestId}/approve`);
            setRotationMsg({ type: 'success', text: res.data.message });
            fetchGroup();
        } catch (err) {
            setRotationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to approve' });
        } finally {
            setRotationLoading(false);
        }
    };

    const handleApplyRotation = async (requestId) => {
        if (!window.confirm('Apply the approved rotation change? This cannot be undone.')) return;
        setRotationLoading(true);
        setRotationMsg(null);
        try {
            const res = await api.post(`/groups/${id}/rotation-change/${requestId}/apply`);
            setRotationMsg({ type: 'success', text: res.data.message });

            // Immediately apply nextPayoutRecipient from the response so the
            // Financial Summary card updates before the re-fetches complete.
            const { nextPayoutRecipient } = res.data.data || {};
            if (nextPayoutRecipient) {
                setFinancialSummary(prev => prev ? { ...prev, nextPayoutRecipient } : prev);
            }

            // Await both fetches sequentially so they run AFTER the Firestore
            // transaction is fully visible — eliminates the read-before-write race.
            await fetchGroup();
            await fetchFinancialSummary();
        } catch (err) {
            setRotationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to apply change' });
        } finally {
            setRotationLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="card max-w-md text-center">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Error</h2>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <Link to="/dashboard" className="btn-primary inline-block">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (!group) return null;

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const seconds = date?._seconds ?? date?.seconds;
        const jsDate = seconds !== undefined ? new Date(seconds * 1000) : new Date(date);
        if (isNaN(jsDate.getTime())) return 'N/A';
        return jsDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // True once ANY paid contribution exists for this group
    // (financialSummary.totalContributed is updated on every paid contribution)
    const hasFinancialActivity = (financialSummary?.totalContributed ?? 0) > 0;

    // Pending rotation-change request embedded in the group document
    const rotationRequest = group.rotationChangeRequest || null;
    const myUserId = user?.uid || user?.id;

    // Has the current user already approved the pending request?
    const iHaveApproved = rotationRequest?.approvals?.[myUserId] === true;

    // Can admin apply? All values in approvals map must be true
    const allApproved = rotationRequest
        ? Object.values(rotationRequest.approvals || {}).every(v => v === true)
        : false;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-7xl mx-auto">
                {/* CYCLE DELAYED BANNER */}
                {group.cycleStatus === 'delayed' && (
                    <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3">
                        <AlertOctagon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-red-800">⛔ Payout Delayed — Incomplete Contributions</p>
                            <p className="text-sm text-red-700 mt-1">
                                One or more members have overdue contributions for this cycle.
                                The next payout is on hold until all members complete their contributions.
                                Members with overdue balances have been notified.
                            </p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-6">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl font-bold text-slate-800">{group.name}</h1>
                                {group.status === 'closed' && (
                                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                        Closed
                                    </span>
                                )}
                                {group.cycleStatus === 'delayed' && (
                                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold flex items-center gap-1">
                                        <AlertOctagon className="w-3 h-3" /> Cycle Delayed
                                    </span>
                                )}
                                {isAdmin && (
                                    <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                                        Admin
                                    </span>
                                )}
                            </div>
                            {group.description && (
                                <p className="text-slate-600">{group.description}</p>
                            )}
                        </div>

                        {isAdmin && group.status === 'active' && (
                            hasFinancialActivity ? (
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-500 rounded-lg text-sm font-semibold cursor-not-allowed" title="Cannot close group once contributions have started">
                                    <ShieldX className="w-4 h-4 text-red-400" />
                                    Group Locked
                                </div>
                            ) : (
                                <button
                                    onClick={handleCloseGroup}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                                >
                                    <Lock className="w-4 h-4" />
                                    Close Group
                                </button>
                            )
                        )}
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Join Code - Only for non-daily groups */}
                        {group.status === 'active' && group.contributionFrequency !== 'daily' && (
                            <div className="card">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Join Code</h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4 text-center">
                                        <p className="text-4xl font-bold tracking-widest text-primary-700">
                                            {group.joinCode}
                                        </p>
                                    </div>
                                    <button
                                        onClick={copyJoinCode}
                                        className="btn-secondary flex items-center gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircle className="w-4 h-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Financial Summary */}
                        {financialSummary && (
                            <div className="card bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 border-2 border-emerald-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <PiggyBank className="w-5 h-5 text-emerald-600" />
                                    Financial Summary
                                </h3>

                                <div className="grid md:grid-cols-2 gap-4 mb-4">
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-slate-600 mb-1">Total Contributed So Far</p>
                                        <p className="text-3xl font-bold text-emerald-600">
                                            {formatNaira(financialSummary.totalContributed)}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">All verified contributions</p>
                                    </div>

                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-slate-600 mb-1">Current Escrow Balance</p>
                                        <p className="text-3xl font-bold text-blue-600">
                                            {formatNaira(financialSummary.currentEscrowBalance)}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">Held in group escrow</p>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 mb-4">
                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-slate-600 mb-1">Expected Payout Amount</p>
                                        <p className="text-2xl font-bold text-purple-600">
                                            {formatNaira(financialSummary.totalPayout)}
                                        </p>
                                        {/* Commission breakdown — all integer kobo math */}
                                        <div className="mt-2 space-y-0.5 text-xs text-slate-500 border-t border-slate-100 pt-2">
                                            <p>Gross: {formatNaira(financialSummary.totalPayout)}</p>
                                            <p className="text-red-400">Platform fee ({commissionRate}%): -{formatNaira(Math.floor(financialSummary.totalPayout * commissionRate / 100))}</p>
                                            <p className="text-emerald-600 font-semibold">
                                                Net to you: {formatNaira(financialSummary.totalPayout - Math.floor(financialSummary.totalPayout * commissionRate / 100))}
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Per member payout</p>
                                    </div>

                                    <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-slate-600 mb-1">Group Capacity</p>
                                        <p className="text-2xl font-bold text-slate-800">
                                            {financialSummary.memberCount} / {financialSummary.maxMembers}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">Current members</p>
                                    </div>
                                </div>

                                {/* Cycle Progress */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-slate-600">Cycle Progress</p>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {financialSummary.completedCycles} / {financialSummary.totalCycles} Completed
                                        </p>
                                    </div>

                                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
                                            style={{ width: `${financialSummary.completionPercentage}%` }}
                                        ></div>
                                    </div>

                                    <p className="text-xs text-slate-500 mt-2">
                                        {financialSummary.completionPercentage}% complete
                                    </p>

                                    {/* Auto-Deduction / Daily Savings Info */}
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-800 mb-1">
                                            <Clock className="w-4 h-4" />
                                            {group.contributionFrequency === 'daily' ? 'Daily Savings Schedule' : 'Next Auto-Deduction'}
                                        </h4>
                                        {(() => {
                                            if (group.contributionFrequency === 'daily') {
                                                return (
                                                    <div>
                                                        <p className="text-sm text-blue-900 font-semibold">
                                                            Daily at {group.daily_deduction_time || '12:00'} UTC
                                                        </p>
                                                        <p className="text-[10px] text-blue-600 mt-2 italic">
                                                            *Deducted automatically each day at your chosen time.
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            // Use cycle_start_date from the Firestore group doc (set by cycleEngine).
                                            // Deduction = cycle_start_date + (deductionOffset - 1) days.
                                            // monthly: offset=25 → +24 days | weekly: offset=5 → +4 days
                                            const cycleStartRaw = group.cycle_start_date;
                                            if (!cycleStartRaw) {
                                                return <p className="text-xs text-blue-700">Scheduled based on frequency</p>;
                                            }

                                            const cycleStart = new Date(cycleStartRaw);
                                            const offsetDays = group.contributionFrequency === 'weekly' ? 4 : 24; // Day 5 or Day 25
                                            const nextDeduction = new Date(cycleStart);
                                            nextDeduction.setUTCDate(nextDeduction.getUTCDate() + offsetDays);

                                            const daysLeft = Math.ceil((nextDeduction - new Date()) / (1000 * 60 * 60 * 24));

                                            return (
                                                <div>
                                                    <p className="text-sm text-blue-900 font-semibold">{formatDate(nextDeduction.toISOString())}</p>
                                                    {daysLeft > 0 ? (
                                                        <p className="text-xs text-blue-700 mt-1">in {daysLeft} days</p>
                                                    ) : (
                                                        <p className="text-xs text-amber-700 mt-1 font-bold">Processing soon!</p>
                                                    )}
                                                    <p className="text-[10px] text-blue-600 mt-2 italic">
                                                        *Auto-deducted {group.contributionFrequency === 'weekly' ? '2 days' : '5 days'} before payout. Keep your wallet funded.
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {financialSummary.nextPayoutRecipient && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <p className="text-xs text-slate-600 mb-1">Next Payout Recipient:</p>
                                            <p className="font-semibold text-slate-800">
                                                {financialSummary.nextPayoutRecipient.fullName} (Turn #{financialSummary.nextPayoutRecipient.payoutTurn})
                                            </p>
                                        </div>
                                    )}

                                    {/* Admin: Release Payout button */}
                                    {isAdmin && group.status === 'active' && financialSummary.nextPayoutRecipient && financialSummary.currentEscrowBalance >= financialSummary.totalPayout && (
                                        <div className="mt-4">
                                            {payoutResult ? (
                                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                                                    <p className="font-bold text-emerald-800 mb-1">✅ Payout Released!</p>
                                                    <p className="text-emerald-700">Recipient: <strong>{payoutResult.recipient.fullName}</strong></p>
                                                    <p className="text-emerald-700">Net paid: <strong>{payoutResult.payoutBreakdown.netPayoutNaira}</strong></p>
                                                    <p className="text-xs text-emerald-600 mt-1">Commission: {payoutResult.payoutBreakdown.commissionNaira}</p>
                                                </div>
                                            ) : group.cycleStatus === 'delayed' ? (
                                                /* Payout blocked — delayed cycle */
                                                <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-sm">
                                                    <p className="font-bold text-red-800 flex items-center gap-2 mb-1">
                                                        <AlertOctagon className="w-4 h-4" /> Payout Blocked
                                                    </p>
                                                    <p className="text-red-700">
                                                        One or more members have overdue contributions. All members must pay before this payout can be released.
                                                    </p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleReleasePayout}
                                                    disabled={payingOut}
                                                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {payingOut ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                                    ) : (
                                                        <TrendingUp className="w-4 h-4" />
                                                    )}
                                                    {payingOut ? 'Processing...' : `Release Payout · ${formatNaira(financialSummary.totalPayout)}`}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Wallet & Contribution Status */}
                        {group.status === 'active' && (
                            <div className="card">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <Wallet className="w-5 h-5 text-primary-600" />
                                    Wallet & Contribution Status
                                </h3>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Wallet Balance */}
                                    <div className={`p-4 rounded-lg border-l-4 ${wallet?.availableBalance >= group.contributionAmount ? 'bg-emerald-50 border-emerald-500' : 'bg-amber-50 border-amber-500'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-medium text-slate-600 mb-1">Your Wallet Balance</p>
                                                <p className={`text-2xl font-bold ${wallet?.availableBalance >= group.contributionAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                    {wallet ? formatNaira(wallet.availableBalance) : '₦0.00'}
                                                </p>
                                            </div>
                                            <Link to="/wallet" className="text-primary-600 hover:text-primary-700 p-2 hover:bg-primary-50 rounded-full transition-colors">
                                                <Settings className="w-4 h-4" />
                                            </Link>
                                        </div>

                                        {wallet?.availableBalance < group.contributionAmount && (
                                            <div className="mt-2 text-xs text-amber-800 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Top up {formatNaira(group.contributionAmount - (wallet?.availableBalance || 0))} for next payment
                                            </div>
                                        )}

                                        <Link to="/wallet" className="mt-3 block text-center py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                            Fund Wallet
                                        </Link>
                                    </div>

                                    {/* Action Center */}
                                    <div className="flex flex-col justify-center gap-3">
                                        {(() => {
                                            // Check if paid for current cycle
                                            const currentCycle = group.currentCycle;
                                            const hasPaid = myStatus?.contributions.some(c =>
                                                c.cycleNumber === currentCycle && c.status === 'paid'
                                            );

                                            if (hasPaid) {
                                                return (
                                                    <div className="bg-emerald-100 text-emerald-800 p-3 rounded-lg flex items-center gap-3">
                                                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-bold text-sm">Contribution Paid</p>
                                                            <p className="text-xs">You are all set for Cycle #{currentCycle}</p>
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <button
                                                        onClick={handlePayNow}
                                                        disabled={wallet?.availableBalance < group.contributionAmount || paying}
                                                        className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {paying ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        ) : (
                                                            <DollarSign className="w-4 h-4" />
                                                        )}
                                                        Pay {formatNaira(group.contributionAmount)} Now
                                                    </button>
                                                );
                                            }
                                        })()}

                                        <button
                                            onClick={() => navigate(`/group/${id}/contributions`)}
                                            className="btn-secondary w-full flex items-center justify-center gap-2"
                                        >
                                            <FileText className="w-4 h-4" />
                                            View Contribution History
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Members */}
                        <div className="card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary-600" />
                                    Members ({group.members.length})
                                </h3>
                                {/* Cycle payment summary */}
                                {group.status === 'active' && (() => {
                                    const paidCount = group.members.filter(m => m.hasPaidCurrentCycle).length;
                                    return (
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${paidCount === group.members.length
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {paidCount}/{group.members.length} paid · Cycle #{group.currentCycle}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="space-y-3">
                                {group.members.map((member) => (
                                    <div
                                        key={member.userId}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Avatar with paid/unpaid ring */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ring-2 ${member.hasPaidCurrentCycle
                                                ? 'bg-gradient-to-br from-emerald-500 to-teal-500 ring-emerald-300'
                                                : 'bg-gradient-to-br from-primary-500 to-secondary-500 ring-slate-200'
                                                }`}>
                                                {member.userDetails?.fullName?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                                                    {member.userDetails?.fullName || 'Unknown'}
                                                    {member.userId === group.adminId && (
                                                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Admin</span>
                                                    )}
                                                    {/* Cycle payment status badge — visible to all */}
                                                    {group.status === 'active' && (
                                                        member.hasPaidCurrentCycle ? (
                                                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <CheckCircle className="w-3 h-3" /> Paid
                                                            </span>
                                                        ) : member.contributionStatus === 'overdue' ? (
                                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <AlertOctagon className="w-3 h-3" /> Overdue
                                                            </span>
                                                        ) : member.contributionStatus === 'failed' ? (
                                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> In Grace Period
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <Clock className="w-3 h-3" /> Pending
                                                            </span>
                                                        )
                                                    )}
                                                </p>
                                                <p className="text-sm text-slate-600">{member.userDetails?.email}</p>
                                                {isAdmin && member.userDetails?.phoneNumber && (
                                                    <p className="text-sm text-slate-500">📞 {member.userDetails.phoneNumber}</p>
                                                )}
                                                {member.hasReceivedPayout && (
                                                    <p className="text-xs text-purple-600 font-semibold mt-0.5">✓ Payout received</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-slate-600">Payout Turn</p>
                                            <p className="text-2xl font-bold text-primary-600">#{member.payoutTurn}</p>
                                            {isAdmin && member.userId !== group.adminId && group.status === 'active' && (
                                                hasFinancialActivity ? (
                                                    <span className="mt-2 text-xs text-gray-400 flex items-center gap-1 justify-end" title="Removal blocked: contributions exist">
                                                        <ShieldX className="w-3 h-3" />
                                                        Locked
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.userId)}
                                                        className="mt-2 text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                                                    >
                                                        <UserMinus className="w-3 h-3" />
                                                        Remove
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Rotation Order Change ─────────────────────────── */}
                        {group.status === 'active' && group.savingsMode !== 'individual' && (
                            <div className="card border-2 border-indigo-100">
                                <h3 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
                                    <ArrowUpDown className="w-5 h-5 text-indigo-500" />
                                    Rotation Order Change
                                </h3>
                                <p className="text-xs text-slate-500 mb-4">
                                    Members can request to swap payout positions. All members must approve before the admin can apply the change.
                                    Blocked once any payout has been executed.
                                </p>

                                {/* Feedback message */}
                                {rotationMsg && (
                                    <div className={`mb-3 p-3 rounded-lg text-sm font-medium ${rotationMsg.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-red-50 text-red-800 border border-red-200'
                                        }`}>
                                        {rotationMsg.text}
                                    </div>
                                )}

                                {hasFinancialActivity && group.members.every(m => !m.hasReceivedPayout) === false ? (
                                    /* Payout already started — fully locked */
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                                        <ShieldX className="w-4 h-4 text-red-400" />
                                        Rotation changes are locked once a payout cycle has started.
                                    </div>
                                ) : rotationRequest && rotationRequest.status === 'pending' ? (
                                    /* Pending request — show approval status */
                                    <div className="space-y-3">
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                            <p className="font-semibold text-amber-800 mb-1">⏳ Pending Request</p>
                                            <p className="text-amber-700">
                                                Swap requested between positions #{group.members.find(m => m.userId === rotationRequest.requestedBy)?.payoutTurn} and #{group.members.find(m => m.userId === rotationRequest.targetUserId)?.payoutTurn}
                                            </p>
                                            <p className="text-xs text-amber-600 mt-1">Request ID: {rotationRequest.id}</p>
                                        </div>

                                        {/* Approval chips */}
                                        <div className="space-y-1">
                                            {group.members.map(m => (
                                                <div key={m.userId} className="flex items-center justify-between text-sm">
                                                    <span className="text-slate-700">{m.userDetails?.fullName || m.userId}</span>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rotationRequest.approvals?.[m.userId]
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {rotationRequest.approvals?.[m.userId] ? '✓ Approved' : 'Pending'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Approve button for this member (if they haven't yet) */}
                                        {!iHaveApproved && myUserId in (rotationRequest.approvals || {}) && (
                                            <button
                                                onClick={() => handleApproveRotation(rotationRequest.id)}
                                                disabled={rotationLoading}
                                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                                            >
                                                {rotationLoading ? 'Approving...' : 'Approve Swap'}
                                            </button>
                                        )}

                                        {/* Admin apply button — only when all approved */}
                                        {isAdmin && allApproved && (
                                            <button
                                                onClick={() => handleApplyRotation(rotationRequest.id)}
                                                disabled={rotationLoading}
                                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                                            >
                                                {rotationLoading ? 'Applying...' : '✓ Apply Rotation Change'}
                                            </button>
                                        )}
                                    </div>
                                ) : rotationRequest && rotationRequest.status === 'applied' ? (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                                        ✅ Last rotation change was applied successfully.
                                    </div>
                                ) : (
                                    /* No active request — show the create form */
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Request a swap with:</label>
                                            <select
                                                value={rotationTargetId}
                                                onChange={e => setRotationTargetId(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            >
                                                <option value="">— Select a member —</option>
                                                {group.members
                                                    .filter(m => m.userId !== myUserId)
                                                    .map(m => (
                                                        <option key={m.userId} value={m.userId}>
                                                            {m.userDetails?.fullName || m.userId} (Turn #{m.payoutTurn})
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                        <button
                                            onClick={handleRequestRotation}
                                            disabled={!rotationTargetId || rotationLoading}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {rotationLoading ? 'Submitting...' : 'Submit Swap Request'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Group Stats</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Contribution Amount</p>
                                    <p className="text-2xl font-bold text-slate-800">{formatNaira(group.contributionAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Frequency</p>
                                    <p className="text-lg font-semibold text-slate-800 capitalize">{group.contributionFrequency}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Duration</p>
                                    <p className="text-lg font-semibold text-slate-800">{group.contributionPeriodMonths} Months</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Total Cycles</p>
                                    <p className="text-lg font-semibold text-slate-800">{group.totalCycles}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Current Cycle</p>
                                    <p className="text-lg font-semibold text-primary-600">{group.currentCycle} / {group.totalCycles}</p>
                                </div>
                                {group.latePaymentPenalty > 0 && (
                                    <div>
                                        <p className="text-sm text-slate-600 mb-1">Late Penalty</p>
                                        <p className="text-lg font-semibold text-red-600">{formatNaira(group.latePaymentPenalty)}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary-600" />
                                Important Dates
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-slate-600">Group Start Date</p>
                                    <p className="font-semibold text-slate-800">{formatDate(group.startDate)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600">Group End Date</p>
                                    <p className="font-semibold text-slate-800">{formatDate(group.endDate)}</p>
                                </div>
                                {/* Current cycle fields from the fixed cycle engine */}
                                {group.cycle_start_date && (
                                    <div className="pt-2 border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Cycle</p>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-sm text-slate-600">Cycle Start</p>
                                                <p className="font-semibold text-slate-800">{formatDate(group.cycle_start_date)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-600">Payout Date</p>
                                                <p className="font-semibold text-emerald-700">{formatDate(group.cycle_end_date)}</p>
                                            </div>
                                            {group.contributionFrequency !== 'daily' && (
                                                <div>
                                                    <p className="text-sm text-slate-600">Deduction Due</p>
                                                    <p className="font-semibold text-blue-700">
                                                        {(() => {
                                                            if (!group.cycle_start_date) return 'N/A';
                                                            const s = new Date(group.cycle_start_date);
                                                            const off = group.contributionFrequency === 'weekly' ? 4 : 24;
                                                            s.setUTCDate(s.getUTCDate() + off);
                                                            return formatDate(s.toISOString());
                                                        })()}
                                                    </p>
                                                </div>
                                            )}
                                            {group.contributionFrequency === 'daily' && group.daily_deduction_time && (
                                                <div>
                                                    <p className="text-sm text-slate-600">Daily Deduction Time</p>
                                                    <p className="font-semibold text-blue-700">{group.daily_deduction_time} UTC</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {group.closedAt && (
                                    <div>
                                        <p className="text-sm text-slate-600">Closed On</p>
                                        <p className="font-semibold text-red-600">{formatDate(group.closedAt)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
