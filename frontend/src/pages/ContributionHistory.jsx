import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    CheckCircle, XCircle, Clock, ArrowLeft, FileText, Eye,
    AlertTriangle, AlertOctagon
} from 'lucide-react';
import { formatNaira } from '../utils/currency';

export default function ContributionHistory() {
    const { groupId } = useParams();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [contributions, setContributions] = useState([]);
    const [group, setGroup] = useState(null);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    // Extended filter set covers new enforcement statuses
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, [groupId]);

    const fetchData = async () => {
        try {
            const [groupRes, contribRes] = await Promise.all([
                api.get(`/groups/${groupId}`),
                api.get(`/contributions/group/${groupId}`)
            ]);

            if (groupRes.data.success) {
                setGroup(groupRes.data.data.group);
            }

            if (contribRes.data.success) {
                setContributions(contribRes.data.data.contributions);
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    /** Normalise status → icon */
    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved':
            case 'paid':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'rejected':
                return <XCircle className="w-5 h-5 text-red-600" />;
            case 'overdue':
                return <AlertOctagon className="w-5 h-5 text-red-600" />;
            case 'failed':
                return <AlertTriangle className="w-5 h-5 text-orange-500" />;
            default:
                return <Clock className="w-5 h-5 text-orange-600" />;
        }
    };

    /** Normalise status → coloured pill */
    const getStatusBadge = (status, graceDeadline) => {
        const styles = {
            approved: 'bg-green-100 text-green-700',
            paid: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700',
            pending: 'bg-orange-100 text-orange-700',
            missed: 'bg-orange-100 text-orange-700',
            failed: 'bg-orange-100 text-orange-800',
            overdue: 'bg-red-100 text-red-800'
        };
        const label = {
            approved: 'Approved',
            paid: 'Paid',
            rejected: 'Rejected',
            pending: 'Pending',
            missed: 'Missed',
            failed: 'In Grace Period',
            overdue: 'Overdue'
        };
        return (
            <div className="flex flex-col items-end gap-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] ?? 'bg-slate-100 text-slate-700'}`}>
                    {label[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                {status === 'failed' && graceDeadline && (() => {
                    const deadline = graceDeadline?.toDate ? graceDeadline.toDate() : new Date(graceDeadline);
                    const daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
                    return daysLeft > 0 ? (
                        <span className="text-xs text-orange-600">Grace ends in {daysLeft}d</span>
                    ) : null;
                })()}
            </div>
        );
    };

    // Tabs with counts — includes enforcement statuses
    const FILTER_TABS = ['all', 'paid', 'approved', 'pending', 'failed', 'overdue', 'rejected'];

    const filteredContributions = contributions.filter(c =>
        filter === 'all' ? true : c.status === filter
    );

    const formatDate = (val) => {
        if (!val) return 'N/A';
        const seconds = val?._seconds ?? val?.seconds;
        const d = seconds !== undefined ? new Date(seconds * 1000) : new Date(val);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link to={`/group/${groupId}`} className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Group
                    </Link>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                        Contribution History
                    </h1>
                    <p className="text-slate-600">{group?.name}</p>
                </div>

                {/* Filter Tabs — now includes failed + overdue */}
                <div className="card mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {FILTER_TABS.map((f) => {
                            const count = f === 'all'
                                ? contributions.length
                                : contributions.filter(c => c.status === f).length;
                            if (f !== 'all' && count === 0) return null; // hide empty tabs
                            return (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${filter === f
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {f === 'failed' ? 'In Grace' : f === 'overdue' ? 'Overdue' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    <span className="ml-2 text-sm">({count})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Contributions List */}
                {filteredContributions.length === 0 ? (
                    <div className="card text-center py-12">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">
                            No Contributions Found
                        </h3>
                        <p className="text-slate-600">
                            {filter === 'all'
                                ? 'No contributions have been submitted yet.'
                                : `No ${filter === 'failed' ? 'grace-period' : filter} contributions.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredContributions.map((contribution) => (
                            <div key={contribution.id || contribution._id} className="card hover:shadow-lg transition-shadow">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        {getStatusIcon(contribution.status)}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">
                                                        {contribution.userId?.fullName ?? contribution.userId}
                                                    </h3>
                                                    <p className="text-sm text-slate-600">
                                                        Cycle {contribution.cycleNumber}
                                                    </p>
                                                </div>
                                                {getStatusBadge(contribution.status, contribution.graceDeadline)}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                                <div>
                                                    <p className="text-xs text-slate-500">Amount</p>
                                                    <p className="font-semibold text-primary-600">
                                                        {formatNaira(contribution.amount)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Submitted</p>
                                                    <p className="font-medium text-slate-700">
                                                        {formatDate(contribution.uploadedAt ?? contribution.createdAt ?? contribution.paidAt)}
                                                    </p>
                                                </div>
                                                {contribution.attemptCount > 0 && (
                                                    <div>
                                                        <p className="text-xs text-slate-500">Deduction Attempts</p>
                                                        <p className="font-medium text-orange-700">{contribution.attemptCount}</p>
                                                    </div>
                                                )}
                                                {contribution.verifiedAt && (
                                                    <>
                                                        <div>
                                                            <p className="text-xs text-slate-500">Verified By</p>
                                                            <p className="font-medium text-slate-700">
                                                                {contribution.verifiedBy?.fullName || 'Admin'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-500">Verified On</p>
                                                            <p className="font-medium text-slate-700">
                                                                {formatDate(contribution.verifiedAt)}
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Grace period warning for failed contributions */}
                                            {contribution.status === 'failed' && contribution.graceDeadline && (() => {
                                                const deadline = contribution.graceDeadline?.toDate
                                                    ? contribution.graceDeadline.toDate()
                                                    : new Date(contribution.graceDeadline);
                                                return (
                                                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2 text-sm">
                                                        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="font-semibold text-orange-800">Grace Period Active</p>
                                                            <p className="text-orange-700">
                                                                Automatic retry will attempt daily until{' '}
                                                                <strong>{deadline.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>.
                                                                Please fund your wallet before then.
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Overdue warning */}
                                            {contribution.status === 'overdue' && (
                                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm">
                                                    <AlertOctagon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                                    <p className="text-red-700">
                                                        <span className="font-semibold">Grace period expired.</span>{' '}
                                                        This contribution is overdue. The group payout cycle is currently delayed. Contact the group admin.
                                                    </p>
                                                </div>
                                            )}

                                            {contribution.isLate && (
                                                <div className="mt-3 flex items-center gap-2 text-sm">
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                                                        Late Payment
                                                    </span>
                                                    <span className="text-slate-600">
                                                        Penalty: {formatNaira(contribution.penaltyAmount)}
                                                    </span>
                                                </div>
                                            )}

                                            {contribution.notes && (
                                                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                                    <p className="text-sm text-slate-700">
                                                        <span className="font-medium">Notes:</span> {contribution.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {contribution.receiptUrl && (
                                        <button
                                            onClick={() => setSelectedReceipt(contribution)}
                                            className="btn-secondary flex items-center gap-2 flex-shrink-0"
                                        >
                                            <Eye className="w-4 h-4" />
                                            View Receipt
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Receipt Modal */}
                {selectedReceipt && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                        onClick={() => setSelectedReceipt(null)}
                    >
                        <div
                            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            Payment Receipt
                                        </h3>
                                        <p className="text-sm text-slate-600">
                                            {selectedReceipt.userId?.fullName ?? selectedReceipt.userId} — Cycle {selectedReceipt.cycleNumber}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedReceipt(null)}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                <img
                                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${selectedReceipt.receiptUrl}`}
                                    alt="Payment receipt"
                                    className="w-full rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
