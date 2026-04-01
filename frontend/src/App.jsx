import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CreateGroup from './pages/CreateGroup';
import JoinGroup from './pages/JoinGroup';
import GroupDetail from './pages/GroupDetail';
import GroupHistory from './pages/GroupHistory';
import SubmitContribution from './pages/SubmitContribution';
import ContributionHistory from './pages/ContributionHistory';
import WalletDashboard from './pages/WalletDashboard';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

// Public route wrapper (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function AppRoutes() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/create-group" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
                <Route path="/join-group" element={<ProtectedRoute><JoinGroup /></ProtectedRoute>} />
                <Route path="/group/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><GroupHistory /></ProtectedRoute>} />
                <Route path="/wallet" element={<ProtectedRoute><WalletDashboard /></ProtectedRoute>} />
                <Route path="/group/:groupId/contribute" element={<ProtectedRoute><SubmitContribution /></ProtectedRoute>} />
                {/* WALLET-ONLY SYSTEM: Receipt verification route removed */}
                <Route path="/group/:groupId/contributions" element={<ProtectedRoute><ContributionHistory /></ProtectedRoute>} />
            </Routes>
        </Router>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}

export default App;
