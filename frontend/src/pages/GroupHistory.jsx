import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, Calendar, Users, DollarSign, CheckCircle, ArrowRight, Clock } from 'lucide-react';
import api from '../utils/api';
import { formatNaira } from '../utils/currency';

export default function GroupHistory() {
    const [closedGroups, setClosedGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const response = await api.get('/groups');
            if (response.data.success) {
                setClosedGroups(response.data.data.closedGroups || []);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load group history');
        } finally {
            setLoading(false);
        }
    };

    // Handle Firestore Timestamp objects OR plain ISO strings
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const seconds = date?._seconds ?? date?.seconds;
        const jsDate = seconds !== undefined ? new Date(seconds * 1000) : new Date(date);
        if (isNaN(jsDate.getTime())) return 'N/A';
        return jsDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 p-4 py-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Group History</h1>
                    <p className="text-slate-600">View your past savings circles</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {closedGroups.length === 0 ? (
                    <div className="card">
                        <div className="text-center py-16">
                            <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg mb-2 font-medium">No closed groups yet</p>
                            <p className="text-slate-400 text-sm mb-6">Groups you complete or close will appear here</p>
                            <Link to="/dashboard" className="btn-primary inline-block">
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500 font-medium">
                            {closedGroups.length} closed group{closedGroups.length !== 1 ? 's' : ''}
                        </p>

                        {closedGroups.map((group) => {
                            const memberPaidOut = group.members?.filter(m => m.hasReceivedPayout).length ?? 0;
                            const totalMembers = group.members?.length ?? 0;
                            const allPaid = memberPaidOut === totalMembers && totalMembers > 0;

                            return (
                                <div
                                    key={group.id}
                                    className="card hover:shadow-md transition-shadow border border-slate-200"
                                >
                                    <div className="flex items-start justify-between flex-wrap gap-4">
                                        {/* Left — group info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                <h2 className="text-xl font-bold text-slate-800 truncate">
                                                    {group.name}
                                                </h2>
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${allPaid
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {allPaid ? (
                                                        <><CheckCircle className="w-3 h-3" /> Completed</>
                                                    ) : (
                                                        <><Clock className="w-3 h-3" /> Closed</>
                                                    )}
                                                </span>
                                            </div>

                                            {group.description && (
                                                <p className="text-sm text-slate-500 mb-3">{group.description}</p>
                                            )}

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" /> Contribution
                                                    </p>
                                                    <p className="font-semibold text-slate-800 text-sm">
                                                        {formatNaira(group.contributionAmount)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                                                        <Users className="w-3 h-3" /> Members
                                                    </p>
                                                    <p className="font-semibold text-slate-800 text-sm">
                                                        {totalMembers} / {group.maxMembers}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> Start Date
                                                    </p>
                                                    <p className="font-semibold text-slate-800 text-sm">
                                                        {formatDate(group.startDate)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> Closed On
                                                    </p>
                                                    <p className="font-semibold text-slate-800 text-sm">
                                                        {formatDate(group.closedAt)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Payout progress bar */}
                                            <div className="mt-4">
                                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                    <span>Payouts completed</span>
                                                    <span>{memberPaidOut} / {totalMembers}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
                                                        style={{ width: totalMembers > 0 ? `${(memberPaidOut / totalMembers) * 100}%` : '0%' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right — view details link */}
                                        <div className="flex flex-col items-end justify-between self-stretch gap-2">
                                            <p className="text-xs text-slate-400 capitalize">
                                                {group.contributionFrequency} · {group.totalCycles} cycles
                                            </p>
                                            <Link
                                                to={`/group/${group.id}`}
                                                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-semibold"
                                            >
                                                View Details <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div className="pt-4">
                            <Link to="/dashboard" className="btn-secondary inline-flex items-center gap-2">
                                ← Back to Dashboard
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
