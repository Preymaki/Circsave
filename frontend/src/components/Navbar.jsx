import { LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Brand */}
                    <Link to="/dashboard" className="flex items-center gap-2">
                        <span className="text-xl font-bold text-slate-800 tracking-tight">CircSave</span>
                    </Link>

                    {/* Right side nav items */}
                    <div className="flex items-center gap-4">
                        <Link to="/history" className="text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors">
                            History
                        </Link>
                        <Link to="/wallet" className="text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors">
                            Wallet
                        </Link>
                        {user && (
                            <span className="text-sm text-slate-600 hidden sm:inline">
                                Welcome, <span className="font-semibold">{user?.fullName}</span>
                            </span>
                        )}
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-red-600 transition-colors text-sm font-medium"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
