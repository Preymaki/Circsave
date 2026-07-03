import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, TrendingUp, Clock, ArrowRight, Wallet, AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatNaira } from '../utils/currency';
import Navbar from '../components/Navbar';

export default function Dashboard() {
    const { user, logout } = useAuth();
    const [groups, setGroups] = useState({ activeGroups: [], closedGroups: [] });
    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState(null);
    const [totalSaved, setTotalSaved] = useState(0);
    const [nextContribution, setNextContribution] = useState(null);

    useEffect(() => {
        fetchGroups();
        fetchWallet();
        fetchTotalSaved();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await api.get('/groups');
            if (response.data?.success && response.data?.data) {
                setGroups(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWallet = async () => {
        try {
            const response = await api.get('/wallet');
            if (response.data.success) {
                setWallet(response.data.data.wallet);
            }
        } catch (error) {
            console.error('Failed to fetch wallet:', error);
        }
    };

    const fetchTotalSaved = async () => {
        try {
            const response = await api.get('/contributions/my');
            if (response.data?.success && response.data?.data?.contributions) {
                const paid = response.data.data.contributions
                    .filter(c => c.status === 'paid')
                    .reduce((sum, c) => sum + (c.amount || 0), 0);
                setTotalSaved(paid);
            }
        } catch (error) {
            console.error('Failed to fetch contributions:', error);
        }
    };

    // Derive next contribution date from the active groups already loaded
    const computeNextContribution = (activeGroups) => {
        if (!activeGroups || activeGroups.length === 0) return null;

        const dates = activeGroups
            .map(group => {
                // Prefer the fixed-cycle engine's cycle_end_date if present
                if (group.cycle_end_date) {
                    return new Date(group.cycle_end_date);
                }
                // Fallback: calculate from startDate + currentCycle + frequency
                if (group.startDate) {
                    const start = group.startDate?.toDate
                        ? group.startDate.toDate()
                        : new Date(group.startDate);
                    const cycle = group.currentCycle || 1;
                    const freq = group.contributionFrequency;
                    const due = new Date(start);
                    if (freq === 'weekly') due.setDate(due.getDate() + (cycle - 1) * 7);
                    else if (freq === 'monthly') due.setMonth(due.getMonth() + (cycle - 1));
                    else if (freq === 'daily') due.setDate(due.getDate() + (cycle - 1));
                    return due;
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => a - b);

        return dates.length > 0 ? dates[0] : null;
    };

    // Recompute next contribution whenever groups change
    useEffect(() => {
        const date = computeNextContribution(groups.activeGroups);
        setNextContribution(date);
    }, [groups]);

    const formatNextContribution = () => {
        if (groups.activeGroups.length === 0) return 'No upcoming';
        if (!nextContribution) return 'Calculating…';
        const now = new Date();
        const diffMs = nextContribution - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays <= 6) return `In ${diffDays} days`;

        return nextContribution.toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    return (
        <div className="min-h-screen dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-950">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Link to="/create-group" className="card hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Create New Group</h3>
                                <p className="text-sm text-slate-600">Start a new savings circle</p>
                            </div>
                        </div>
                    </Link>

                    <Link to="/join-group" className="card hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Join Group</h3>
                                <p className="text-sm text-slate-600">Enter a group code to join</p>
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Saved</p>
                                <p className="text-3xl font-bold text-slate-800 dark:text-white">{formatNaira(totalSaved)}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Active Groups</p>
                                <p className="text-3xl font-bold text-slate-800 dark:text-white">{groups.activeGroups.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Next Contribution</p>
                                <p className="text-lg font-semibold text-slate-800 dark:text-white">{formatNextContribution()}</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <Clock className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Wallet Summary Card */}
                <Link to="/wallet" className="card mb-6 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Wallet className="w-6 h-6 text-primary-600" />
                            My Wallet
                        </h2>
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                    </div>

                    {wallet ? (
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-lg p-4">
                                <p className="text-sm text-emerald-700 mb-1">Available Balance</p>
                                <p className="text-2xl font-bold text-emerald-800">
                                    {formatNaira(wallet.availableBalance)}
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-lg p-4">
                                <p className="text-sm text-orange-700 mb-1">Locked Balance</p>
                                <p className="text-2xl font-bold text-orange-800">
                                    {formatNaira(wallet.lockedBalance)}
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4">
                                <p className="text-sm text-blue-700 mb-1">Total Funded</p>
                                <p className="text-2xl font-bold text-blue-800">
                                    {formatNaira(wallet.totalFunded)}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        </div>
                    )}

                    <div className="mt-4 text-sm text-primary-600 font-medium">
                        Click to manage wallet and view transactions →
                    </div>
                </Link>

                <div className="card mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Active Groups</h2>
                        {groups.closedGroups.length > 0 && (
                            <Link to="/history" className="text-sm text-primary-600 hover:text-primary-700 font-semibold">
                                View History →
                            </Link>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                        </div>
                    ) : groups.activeGroups.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600 mb-4">You haven't joined any groups yet</p>
                            <Link to="/create-group" className="btn-primary inline-block">
                                Create Your First Group
                            </Link>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {groups.activeGroups.map((group) => (
                                <Link
                                    key={group.id}
                                    to={`/group/${group.id}`}
                                    className={`p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 rounded-xl border-2 transition-all ${group.cycleStatus === 'delayed'
                                        ? 'border-red-300 hover:border-red-400 hover:shadow-lg'
                                        : 'border-slate-200 dark:border-slate-600 hover:border-primary-300 hover:shadow-lg'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-start justify-between mb-1">
                                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{group.name}</h3>
                                                {group.cycleStatus === 'delayed' && (
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                                                        <AlertOctagon className="w-3 h-3" /> Delayed
                                                    </span>
                                                )}
                                            </div>
                                            {group.description && (
                                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{group.description}</p>
                                            )}
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs text-slate-600">Contribution</p>
                                            <p className="text-lg font-bold text-primary-600">{formatNaira(group.contributionAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-600">Members</p>
                                            <p className="text-lg font-bold text-slate-800">{group.members.length}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400 capitalize">{group.contributionFrequency}</span>
                                        <span className="text-slate-600 dark:text-slate-400">Cycle {group.currentCycle}/{group.totalCycles}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
