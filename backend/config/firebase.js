import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;
let auth;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
    try {
        // Check if already initialized
        if (admin.apps.length > 0) {
            console.log('✓ Firebase already initialized');
            db = admin.firestore();
            auth = admin.auth();
            return { db, auth };
        }

        // Method 1: Use service account JSON file (Recommended for production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            const serviceAccountPath = join(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });

            console.log('✓ Firebase initialized with service account file');
        }
        // Method 2: Use environment variables (Alternative method)
        else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: privateKey,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
                }),
                projectId: process.env.FIREBASE_PROJECT_ID
            });

            console.log('✓ Firebase initialized with environment variables');
        }
        else {
            throw new Error(
                'Firebase credentials not found. Please set either:\n' +
                '1. FIREBASE_SERVICE_ACCOUNT_PATH in .env\n' +
                '2. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env'
            );
        }

        // Get Firestore and Auth instances
        db = admin.firestore();
        auth = admin.auth();

        // Configure Firestore settings
        db.settings({
            timestampsInSnapshots: true,
            ignoreUndefinedProperties: true
        });

        console.log('✓ Firestore and Auth initialized');

        return { db, auth };

    } catch (error) {
        console.error('✗ Firebase initialization failed:', error.message);
        throw error;
    }
}

// Initialize Firebase on module load
initializeFirebase();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down Firebase...');
    await admin.app().delete();
    console.log('✓ Firebase disconnected');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await admin.app().delete();
    process.exit(0);
});

export { db, auth, admin };
export default db;
