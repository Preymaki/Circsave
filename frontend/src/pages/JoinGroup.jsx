import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import {
    Key, ArrowLeft, AlertCircle, CheckCircle,
    Users, DollarSign, Calendar, Clock, ChevronRight, X
} from 'lucide-react';
import { formatNaira } from '../utils/currency';

// Step constants
const STEP_CODE = 'code';
const STEP_PREVIEW = 'preview';
const STEP_SUCCESS = 'success';

export default function JoinGroup() {
    const navigate = useNavigate();
    const [joinCode, setJoinCode] = useState('');
    const [step, setStep] = useState(STEP_CODE);
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loadingJoin, setLoadingJoin] = useState(false);
    const [error, setError] = useState('');

    // ── Step 1: look up group by code ────────────────────────────────────
    const handlePreview = async (e) => {
        e.preventDefault();
        setLoadingPreview(true);
        setError('');

        try {
            const response = await api.get(`/groups/preview?code=${joinCode.toUpperCase().trim()}`);
            if (response.data.success) {
                setPreview(response.data.data.preview);
                setStep(STEP_PREVIEW);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Group not found. Check the code and try again.');
        } finally {
            setLoadingPreview(false);
        }
    };

    // ── Step 2: confirm and join ─────────────────────────────────────────
    const handleJoin = async () => {
        setLoadingJoin(true);
        setError('');

        try {
            const response = await api.post('/groups/join', {
                joinCode: joinCode.toUpperCase().trim()
            });

            if (response.data.success) {
                setStep(STEP_SUCCESS);
                // Bug fix: backend returns { groupId }, not { group: { id } }
                setTimeout(() => {
                    navigate(`/group/${response.data.data.groupId}`);
                }, 1500);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to join group');
            setStep(STEP_PREVIEW); // stay on preview to retry
        } finally {
            setLoadingJoin(false);
        }
    };

    const handleCodeChange = (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length <= 6) {
            setJoinCode(value);
            setError('');
        }
    };

    const resetToCode = () => {
        setStep(STEP_CODE);
        setPreview(null);
        setError('');
    };

    const frequencyLabel = (freq) => {
        if (freq === 'daily') return 'Daily';
        if (freq === 'weekly') return 'Weekly';
        return 'Monthly';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-2xl mx-auto">

                {/* Header */}
                <div className="mb-6">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                        Join a Group
                    </h1>
                    <p className="text-slate-600">
                        {step === STEP_CODE
                            ? 'Enter the 6-character code to look up an existing savings circle'
                            : step === STEP_PREVIEW
                                ? 'Review the group details before joining'
                                : 'Welcome to the group!'}
                    </p>
                </div>

                {/* ── STEP 1: Code Entry ──────────────────────────────────── */}
                {step === STEP_CODE && (
                    <div className="card">
                        <form onSubmit={handlePreview} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            )}

                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl mb-6 shadow-lg">
                                    <Key className="w-10 h-10 text-white" />
                                </div>

                                <div>
                                    <label htmlFor="joinCode" className="label text-center">
                                        Group Join Code
                                    </label>
                                    <input
                                        type="text"
                                        id="joinCode"
                                        value={joinCode}
                                        onChange={handleCodeChange}
                                        className="input-field text-center text-3xl font-bold tracking-widest uppercase"
                                        placeholder="ABC123"
                                        required
                                        maxLength={6}
                                        minLength={6}
                                        autoFocus
                                    />
                                    <p className="text-xs text-slate-500 mt-2">
                                        {joinCode.length}/6 characters
                                    </p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loadingPreview || joinCode.length !== 6}
                                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loadingPreview ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                        Looking up group...
                                    </>
                                ) : (
                                    <>
                                        Preview Group
                                        <ChevronRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* How to join */}
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="font-semibold text-slate-800 mb-3">How to join:</h3>
                            <ol className="space-y-2 text-sm text-slate-600">
                                {[
                                    'Get the 6-character join code from the group admin',
                                    'Enter the code above and click "Preview Group"',
                                    'Review the group details, then confirm to join',
                                    "You'll be assigned a payout turn automatically"
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Group Preview Card ──────────────────────────── */}
                {step === STEP_PREVIEW && preview && (
                    <div className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <div className="card space-y-5">
                            {/* Group header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{preview.name}</h2>
                                    {preview.description && (
                                        <p className="text-slate-500 mt-1 text-sm">{preview.description}</p>
                                    )}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${preview.isFull
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                                    }`}>
                                    {preview.isFull ? 'Full' : 'Open'}
                                </span>
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                                    <DollarSign className="w-8 h-8 text-primary-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-500">Per Cycle</p>
                                        <p className="text-lg font-bold text-slate-800">
                                            {formatNaira(preview.contributionAmount)}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                                    <Clock className="w-8 h-8 text-secondary-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-500">Frequency</p>
                                        <p className="text-lg font-bold text-slate-800">
                                            {frequencyLabel(preview.contributionFrequency)}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                                    <Users className="w-8 h-8 text-blue-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-500">Members</p>
                                        <p className="text-lg font-bold text-slate-800">
                                            {preview.memberCount} / {preview.maxMembers}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                                    <Calendar className="w-8 h-8 text-purple-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-slate-500">Duration</p>
                                        <p className="text-lg font-bold text-slate-800">
                                            {preview.contributionPeriodMonths} mo
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Payout preview */}
                            <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-4">
                                <p className="text-sm text-slate-700">
                                    💡 <strong>Your payout:</strong> Once all{' '}
                                    {preview.maxMembers} members have joined, each person contributes{' '}
                                    {formatNaira(preview.contributionAmount)} per cycle. Each member
                                    receives {formatNaira(preview.contributionAmount * preview.maxMembers)} exactly once.
                                </p>
                                {preview.latePaymentPenalty > 0 && (
                                    <p className="text-xs text-amber-700 mt-2">
                                        ⚠️ Late penalty: {formatNaira(preview.latePaymentPenalty)} per missed cycle
                                    </p>
                                )}
                            </div>

                            {preview.alreadyMember && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                    ℹ️ You are already a member of this group.
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={resetToCode}
                                    className="btn-secondary flex items-center gap-2"
                                    disabled={loadingJoin}
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleJoin}
                                    disabled={loadingJoin || preview.isFull || preview.alreadyMember}
                                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loadingJoin ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                            Joining...
                                        </>
                                    ) : preview.isFull ? (
                                        'Group is Full'
                                    ) : preview.alreadyMember ? (
                                        'Already a Member'
                                    ) : (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            Confirm & Join
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Success ─────────────────────────────────────── */}
                {step === STEP_SUCCESS && (
                    <div className="card text-center py-12">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to the group!</h2>
                        <p className="text-slate-500">Redirecting you to the group dashboard…</p>
                        <div className="mt-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                        </div>
                    </div>
                )}

                {/* Alternative CTA */}
                {step === STEP_CODE && (
                    <div className="mt-6 text-center">
                        <p className="text-slate-600 mb-4">Don't have a code?</p>
                        <Link to="/create-group" className="btn-secondary inline-block">
                            Create Your Own Group
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
