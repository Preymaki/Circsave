import { verifyFirebaseToken } from '../utils/firebaseAuth.js';
import db from '../config/firebase.js';
import { auth } from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';

/**
 * Decode a JWT token without verification (for custom tokens)
 * Custom tokens are signed by the service account and contain uid in the payload
 */
function decodeJWTPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        // Decode base64url payload
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

/**
 * Protect routes - Verify Firebase token (ID token or Custom token)
 */
export const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route. Please login.'
            });
        }

        let uid;

        try {
            // First try: verify as Firebase ID token (from Firebase SDK signIn)
            const decodedToken = await verifyFirebaseToken(token);
            uid = decodedToken.uid;
        } catch (idTokenError) {
            // Second try: decode as custom token (JWT signed by service account)
            // Custom tokens have 'uid' in the payload and 'iss' = service account email
            try {
                const payload = decodeJWTPayload(token);
                if (!payload) {
                    throw new Error('Invalid token format');
                }

                // Custom tokens contain 'uid' field directly
                if (payload.uid) {
                    uid = payload.uid;
                }
                // Some custom tokens store uid as 'sub' (subject)
                else if (payload.sub && !payload.firebase) {
                    uid = payload.sub;
                }
                else {
                    throw new Error('Cannot extract UID from token');
                }

                // Verify the uid actually exists in Firebase Auth
                await auth.getUser(uid);

            } catch (customTokenError) {
                console.error('Token verification error:', idTokenError.message);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token. Please login again.'
                });
            }
        }

        // Get user from Firestore using the UID
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();

        if (!userDoc.exists) {
            return res.status(401).json({
                success: false,
                message: 'User not found. Please login again.'
            });
        }

        // Attach user to request
        req.user = {
            id: userDoc.id,
            uid,
            ...userDoc.data()
        };

        // Remove sensitive data
        delete req.user.password;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during authentication'
        });
    }
};
