import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { formatNaira, nairaToKobo, koboToNaira } from '../utils/currency';
import {
    ArrowLeft,
    Wallet as WalletIcon,
    Building2,
    CreditCard,
    User,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    Shield,
    ChevronRight,
    Send,
    ArrowUpRight
} from 'lucide-react';

const BANKS = [
    'Access Bank',
    'GTBank',
    'UBA',
    'First Bank',
    'Zenith Bank',
    'Opay',
    'PalmPay',
    'Kuda',
    'Moniepoint',
    'Other'
];

export default function Withdrawal() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Wallet data
    const [wallet, setWallet] = useState(null);
    const [loadingWallet, setLoadingWallet] = useState(true);

    // Step: 'form' | 'confirm' | 'success'
    const [step, setStep] = useState('form');

    // Form fields
    const [amount, setAmount] = useState('');
    const [bank, setBank] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [narration, setNarration] = useState('');

    // UI state
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Confirmed transaction info (for success screen)
    const [confirmedAmount, setConfirmedAmount] = useState(0);

    useEffect(() => {
        fetchWallet();
    }, []);

    const fetchWallet = async () => {
        try {
            const res = await api.get('/wallet');
            if (res.data.success) {
                setWallet(res.data.data.wallet);
            }
        } catch (err) {
            console.error('Error fetching wallet:', err);
        } finally {
            setLoadingWallet(false);
        }
    };

    // Validation
    const validateForm = () => {
        const amountNum = parseFloat(amount);

        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            setError('Please enter a valid amount greater than \u20a60.');
            return false;
        }

        const amountKobo = nairaToKobo(amountNum);
        const available = wallet?.availableBalance ?? 0;

        if (amountKobo > available) {
            setError(
                `Amount exceeds your available balance of ${formatNaira(available)}.`
            );
            return false;
        }

        if (!bank) {
            setError('Please select a destination bank or fintech.');
            return false;
        }

        if (!/^\d{10}$/.test(accountNumber.trim())) {
            setError('Account number must be exactly 10 digits.');
            return false;
        }

        if (!accountName.trim()) {
            setError('Please enter the account name.');
            return false;
        }

        return true;
    };

    const handleContinue = (e) => {
        e.preventDefault();
        setError('');
        if (validateForm()) {
            setStep('confirm');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleConfirm = async () => {
        setSubmitting(true);
        setError('');

        try {
            const res = await api.post('/wallet/withdraw', {
                amount: parseFloat(amount),
                bank,
                accountNumber: accountNumber.trim(),
                accountName: accountName.trim(),
                narration: narration.trim()
            });

            if (res.data.success) {
                setConfirmedAmount(nairaToKobo(parseFloat(amount)));
                setStep('success');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                setError(res.data.message || 'Withdrawal failed. Please try again.');
                setStep('form');
            }
        } catch (err) {
            console.error('Withdrawal error:', err);
            const msg =
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Withdrawal failed. Please try again.';
            setError(msg);
            setStep('form');
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingWallet) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Loading your wallet...</p>
                </div>
            </div>
        );
    }

    const amountKobo = nairaToKobo(parseFloat(amount) || 0);

    // SUCCESS SCREEN
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
                <div className="card max-w-md w-full text-center py-12 px-8 shadow-2xl">
                    <div className="flex items-center justify-center mb-6">
                        <div
                            className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                animation: 'successPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both'
                            }}
                        >
                            <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={2.5} />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-slate-900 mb-3">
                        Withdrawal Successful!
                    </h1>

                    <p className="text-lg text-slate-600 mb-2">
                        <span className="font-bold text-emerald-600">
                            {formatNaira(confirmedAmount)}
                        </span>{' '}
                        has been sent successfully.
                    </p>

                    <p className="text-sm text-slate-400 italic mb-6">
                        (This is a simulated transaction.)
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 text-left space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">To</span>
                            <span className="font-semibold text-slate-800">{bank}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Account</span>
                            <span className="font-semibold text-slate-800 font-mono">{accountNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Name</span>
                            <span className="font-semibold text-slate-800">{accountName}</span>
                        </div>
                        {narration && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Narration</span>
                                <span className="font-semibold text-slate-800">{narration}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/wallet')}
                        className="btn-primary w-full py-4 text-base font-semibold shadow-lg shadow-primary-200"
                    >
                        Done
                    </button>
                </div>

                <style>{`
                    @keyframes successPop {
                        0% { transform: scale(0); opacity: 0; }
                        80% { transform: scale(1.1); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // CONFIRMATION SCREEN
    if (step === 'confirm') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
                <div className="max-w-lg mx-auto">
                    <div className="mb-8">
                        <button
                            onClick={() => { setStep('form'); setError(''); }}
                            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6 font-medium transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <ArrowUpRight className="w-6 h-6 text-white" />
                            </div>
                            Confirm Withdrawal
                        </h1>
                        <p className="text-slate-500">Please review the details before confirming</p>
                    </div>

                    {error && (
                        <div className="mb-5 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 shadow-md">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="font-medium text-red-900">{error}</p>
                        </div>
                    )}

                    <div className="card shadow-2xl mb-6">
                        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
                            <Send className="w-5 h-5 text-primary-600" />
                            <h2 className="text-lg font-bold text-slate-900">Withdrawal Summary</h2>
                        </div>

                        <div className="space-y-4">
                            <SummaryRow label="Amount" value={<span className="text-2xl font-bold text-slate-900">{formatNaira(amountKobo)}</span>} />
                            <div className="border-t border-slate-100" />
                            <SummaryRow label="To" value={bank} />
                            <SummaryRow label="Account Number" value={<span className="font-mono font-semibold tracking-widest">{accountNumber}</span>} />
                            <SummaryRow label="Account Name" value={accountName} />
                            {narration && <SummaryRow label="Narration" value={narration} />}
                            <div className="border-t border-slate-100" />
                            <SummaryRow
                                label="Withdrawal Fee"
                                value={<span className="text-emerald-600 font-semibold">₦0.00</span>}
                            />
                            <SummaryRow
                                label="Total Deduction"
                                value={<span className="text-lg font-bold text-slate-900">{formatNaira(amountKobo)}</span>}
                                highlight
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                        <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs font-medium text-amber-800">
                            This is a simulated withdrawal. No real money will be transferred.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => { setStep('form'); setError(''); }}
                            disabled={submitting}
                            className="btn-secondary flex-1 py-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={submitting}
                            className="btn-primary flex-1 py-4 font-semibold shadow-lg shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    Processing...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Send className="w-5 h-5" />
                                    Confirm Withdrawal
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // FORM SCREEN
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 py-8">
            <div className="max-w-lg mx-auto">
                <div className="mb-8">
                    <Link
                        to="/wallet"
                        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6 font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Wallet
                    </Link>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                                    <ArrowUpRight className="w-6 h-6 text-white" />
                                </div>
                                Withdraw Funds
                            </h1>
                            <p className="text-slate-500">Send money to your bank or fintech account</p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                            <Shield className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-800">Simulated</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-5 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 shadow-md">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="font-medium text-red-900">{error}</p>
                    </div>
                )}

                {/* Balance Card */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 p-6 shadow-2xl mb-6">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <WalletIcon className="w-5 h-5 text-primary-200" />
                            <p className="text-primary-100 text-sm font-medium uppercase tracking-wide">
                                Wallet Balance
                            </p>
                        </div>
                        <p className="text-4xl font-bold text-white mb-4">
                            {wallet ? formatNaira(wallet.availableBalance) : '\u20a60.00'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                                <p className="text-primary-100 text-xs mb-1">Available Balance</p>
                                <p className="text-white font-bold text-sm">
                                    {wallet ? formatNaira(wallet.availableBalance) : '\u20a60.00'}
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                                <p className="text-primary-100 text-xs mb-1">Withdrawable Balance</p>
                                <p className="text-white font-bold text-sm">
                                    {wallet ? formatNaira(wallet.availableBalance) : '\u20a60.00'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleContinue} className="card shadow-2xl space-y-5">
                    {/* Amount */}
                    <div>
                        <label htmlFor="w-amount" className="label">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg select-none">₦</span>
                            <input
                                id="w-amount"
                                type="number"
                                min="1"
                                step="1"
                                value={amount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || parseFloat(val) >= 0) setAmount(val);
                                }}
                                onKeyDown={(e) => {
                                    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
                                }}
                                placeholder="Enter amount"
                                className="input-field pl-8 text-lg font-semibold"
                                required
                            />
                        </div>
                        {amount && parseFloat(amount) > 0 && (
                            <p className="text-xs text-slate-500 mt-1.5 ml-1">
                                = {formatNaira(nairaToKobo(parseFloat(amount)))}
                            </p>
                        )}
                    </div>

                    {/* Destination Account Section */}
                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary-500" />
                            Destination Account
                        </p>

                        {/* Bank Dropdown */}
                        <div className="mb-4">
                            <label htmlFor="w-bank" className="label">Bank / Fintech</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <select
                                    id="w-bank"
                                    value={bank}
                                    onChange={(e) => setBank(e.target.value)}
                                    className="input-field pl-10 appearance-none bg-white cursor-pointer"
                                    required
                                >
                                    <option value="">Select bank or fintech...</option>
                                    {BANKS.map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                            </div>
                        </div>

                        {/* Account Number */}
                        <div className="mb-4">
                            <label htmlFor="w-account-number" className="label">Account Number</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="w-account-number"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={accountNumber}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setAccountNumber(val);
                                    }}
                                    placeholder="10-digit account number"
                                    className="input-field pl-10 font-mono tracking-widest"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1 ml-1">{accountNumber.length}/10 digits</p>
                        </div>

                        {/* Account Name */}
                        <div className="mb-4">
                            <label htmlFor="w-account-name" className="label">Account Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="w-account-name"
                                    type="text"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="input-field pl-10"
                                    required
                                />
                            </div>
                        </div>

                        {/* Narration */}
                        <div>
                            <label htmlFor="w-narration" className="label">
                                Narration <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <MessageSquare className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="w-narration"
                                    type="text"
                                    value={narration}
                                    onChange={(e) => setNarration(e.target.value)}
                                    placeholder="e.g. School fees"
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full py-4 text-base font-semibold shadow-lg shadow-primary-200 flex items-center justify-center gap-2"
                    >
                        Continue
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}

function SummaryRow({ label, value, highlight }) {
    return (
        <div className={`flex items-center justify-between ${highlight ? 'bg-slate-50 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm text-slate-900 font-semibold text-right max-w-[60%]">
                {value}
            </span>
        </div>
    );
}
