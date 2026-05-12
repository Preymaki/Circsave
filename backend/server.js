import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { auth } from './config/firebase.js';
import { ensureDirectoryExists } from './utils/helpers.js';

// Import routes
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import contributionRoutes from './routes/contributions.js';
import walletRoutes from './routes/wallet.js';

// Import auth & admin middleware
import { protect } from './middleware/auth.js';
import { checkSystemAdmin } from './middleware/adminCheck.js';

// Load environment variables
dotenv.config();

// Initialize cron jobs for automated contribution/payout processing
import './jobs/cronJobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        // Test Firestore by getting a collection reference
        await db.collection('_health_check').limit(1).get();
        console.log('✅ Firebase Firestore Connected');

        // Test Firebase Auth
        await auth.listUsers(1);
        console.log('✅ Firebase Authentication Connected');
    } catch (error) {
        console.error('❌ Firebase Connection Error:', error.message);
        console.error('Please ensure Firebase service account is properly configured');
        process.exit(1);
    }
}

testFirebaseConnection();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/wallet', walletRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'CircSave API is running',
        timestamp: new Date().toISOString(),
        cronJobs: {
            contributionAutoDebit:  'Running every hour (0 * * * *)',
            automatedPayouts:       'Running every 6 hours (0 */6 * * *)',
            graceRetry:             'Running daily at 08:00 (0 8 * * *)',
            graceExpiry:            'Running daily at 09:00 (0 9 * * *)',
            blockedPayoutRecheck:   'Running every hour at :30 (30 * * * *)'
        }
    });
});

// Manual cron job triggers (protected: requires valid Firebase token + admin role)
app.post('/api/admin/trigger-contributions', protect, async (req, res) => {
    try {
        const { processScheduledContributions } = await import('./services/contributionScheduler.js');
        const result = await processScheduledContributions();

        res.json({
            success: true,
            message: 'Contribution auto-debit manually triggered',
            result: {
                processed: result.processed,
                succeeded: result.succeeded,
                failed: result.failed
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering contributions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger contribution processing',
            error: error.message
        });
    }
});

app.post('/api/admin/trigger-payouts', protect, async (req, res) => {
    try {
        const { processScheduledPayouts } = await import('./services/payoutScheduler.js');
        const result = await processScheduledPayouts();

        res.json({
            success: true,
            message: 'Automated payouts manually triggered',
            result: {
                processed: result.processed,
                succeeded: result.succeeded,
                failed: result.failed
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering payouts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger payout processing',
            error: error.message
        });
    }
});

// Manually trigger grace-period retry (protected: admin only)
app.post('/api/admin/trigger-grace-retry', protect, async (req, res) => {
    try {
        const { retryGraceContributions } = await import('./services/contributionScheduler.js');
        const result = await retryGraceContributions();

        res.json({
            success: true,
            message: 'Grace-period retry manually triggered',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering grace retry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger grace retry',
            error: error.message
        });
    }
});

// Manually trigger grace-period expiry (protected: admin only)
app.post('/api/admin/trigger-grace-expiry', protect, async (req, res) => {
    try {
        const { expireGraceContributions } = await import('./services/contributionScheduler.js');
        const result = await expireGraceContributions();

        res.json({
            success: true,
            message: 'Grace-period expiry manually triggered',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering grace expiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger grace expiry',
            error: error.message
        });
    }
});

// Manually trigger blocked-payout re-check (protected: admin only)
app.post('/api/admin/trigger-blocked-payouts', protect, async (req, res) => {
    try {
        const { processBlockedPayouts } = await import('./services/payoutScheduler.js');
        const result = await processBlockedPayouts();

        res.json({
            success: true,
            message: 'Blocked payout re-check manually triggered',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering blocked payout check:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger blocked payout re-check',
            error: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Initialize server
const initializeServer = async () => {
    // Ensure upload directories exist
    const uploadsPath = path.join(__dirname, 'uploads', 'receipts');
    await ensureDirectoryExists(uploadsPath);

    // Start server
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`\n🚀 CircSave Server running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 API URL: http://localhost:${PORT}/api`);
        console.log(`🔥 Firebase: Connected (Firestore + Authentication)\n`);
    });
};

// Start the server
initializeServer();

export default app;
