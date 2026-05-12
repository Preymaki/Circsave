import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { CheckCircle, XCircle, Clock, Eye, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function VerifyReceipts() {
    const { groupId } = useParams();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [contributions, setContributions] = useState([]);
    const [selectedContribution, setSelectedContribution] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [group, setGroup] = useState(null);

    useEffect(() => {
        fetchData();
    }, [groupId]);

    const fetchData = async () => {
        try {
            const [groupRes, contribRes] = await Promise.all([
                api.get(`/groups/${groupId}`),
                api.get(`/contributions/pending/${groupId}`)
            ]);

            if (groupRes.data.success) {
                setGroup(groupRes.data.data.group);
            }

            if (contribRes.data.success) {
                setContributions(contribRes.data.data.contributions);
            }
        } catch (err) {
            setError('Failed to load contributions');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (contributionId, status) => {
        setVerifying(true);
        setError('');

        try {
            const response = await api.put(`/contributions/${contributionId}/verify`, {
                status
            });

            if (response.data.success) {
                // Remove from pending list
                setContributions(prev => prev.filter(c => c._id !== contributionId));
                setSelectedContribution(null);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to verify contribution');
        } finally {
            setVerifying(false);
        }
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
                        Verify Receipts
                    </h1>
                    <p className="text-slate-600">{group?.name}</p>
                </div>

                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {contributions.length === 0 ? (
                    <div className="card text-center py-12">
                        <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">
                            No Pending Contributions
                        </h3>
                        <p className="text-slate-600">
                            All contributions have been verified!
                        </p>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Contributions List */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-slate-800">
                                Pending Contributions ({contributions.length})
                            </h2>
                            {contributions.map((contribution) => (
                                <div
                                    key={contribution._id}
                                    onClick={() => setSelectedContribution(contribution)}
                                    className={`card cursor-pointer transition-all ${selectedContribution?._id === contribution._id
                                            ? 'ring-2 ring-primary-500'
                                            : 'hover:shadow-lg'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800">
                                                {contribution.userId.fullName}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {contribution.userId.email}
                                            </p>
                                            <div className="mt-2 flex items-center gap-4 text-sm">
                                                <span className="text-slate-600">
                                                    Cycle {contribution.cycleNumber}
                                                </span>
                                                <span className="font-semibold text-primary-600">
                                                    ₦{contribution.amount.toLocaleString()}
                                                </span>
                                                {contribution.isLate && (
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                                                        Late
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Eye className="w-5 h-5 text-slate-400" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Receipt Preview */}
                        <div className="lg:sticky lg:top-4 h-fit">
                            {selectedContribution ? (
                                <div className="card space-y-4">
                                    <h2 className="text-lg font-semibold text-slate-800">
                                        Receipt Details
                                    </h2>

                                    {/* Receipt Image */}
                                    <div className="bg-slate-100 rounded-lg p-4">
                                        <img
                                            src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${selectedContribution.receiptUrl}`}
                                            alt="Payment receipt"
                                            className="w-full rounded-lg"
                                        />
                                    </div>

                                    {/* Contribution Info */}
                                    <div className="space-y-3 pt-4 border-t border-slate-200">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Member:</span>
                                            <span className="font-semibold">
                                                {selectedContribution.userId.fullName}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Cycle:</span>
                                            <span className="font-semibold">
                                                {selectedContribution.cycleNumber}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Amount:</span>
                                            <span className="font-semibold text-primary-600">
                                                ₦{selectedContribution.amount.toLocaleString()}
                                            </span>
                                        </div>
                                        {selectedContribution.isLate && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Penalty:</span>
                                                <span className="font-semibold text-orange-600">
                                                    ₦{selectedContribution.penaltyAmount.toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Submitted:</span>
                                            <span className="font-semibold">
                                                {new Date(selectedContribution.uploadedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {selectedContribution.notes && (
                                            <div>
                                                <span className="text-slate-600 block mb-1">Notes:</span>
                                                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                                                    {selectedContribution.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => handleVerify(selectedContribution._id, 'rejected')}
                                            disabled={verifying}
                                            className="flex-1 px-4 py-3 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="w-5 h-5" />
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleVerify(selectedContribution._id, 'approved')}
                                            disabled={verifying}
                                            className="flex-1 px-4 py-3 bg-green-50 text-green-700 rounded-lg font-semibold hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="card text-center py-12">
                                    <Eye className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-600">
                                        Select a contribution to view receipt
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
