import { LogOut, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();

    return (
        <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Brand */}
                    <Link to="/dashboard" className="flex items-center gap-2">
                        <span className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                            CircSave
                        </span>
                    </Link>

                    {/* Right side nav items */}
                    <div className="flex items-center gap-4">
                        <Link
                            to="/history"
                            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white font-medium transition-colors"
                        >
                            History
                        </Link>
                        <Link
                            to="/wallet"
                            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white font-medium transition-colors"
                        >
                            Wallet
                        </Link>
                        {user && (
                            <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:inline">
                                Welcome, <span className="font-semibold dark:text-slate-200">{user?.fullName}</span>
                            </span>
                        )}

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                        >
                            {isDark ? (
                                <Sun className="w-4 h-4" />
                            ) : (
                                <Moon className="w-4 h-4" />
                            )}
                        </button>

                        <button
                            onClick={logout}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm font-medium"
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
