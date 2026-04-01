import { auth } from '../config/firebase.js';

/**
 * Create a new user with Firebase Authentication
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User's full name
 * @returns {Promise<Object>} Created user record
 */
export async function createFirebaseUser(email, password, displayName) {
    try {
        const userRecord = await auth.createUser({
            email,
            password,
            displayName,
            emailVerified: false
        });

        return userRecord;
    } catch (error) {
        console.error('Error creating Firebase user:', error);
        throw error;
    }
}

/**
 * Update Firebase user
 * @param {string} uid - Firebase  user ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated user record
 */
export async function updateFirebaseUser(uid, updates) {
    try {
        const userRecord = await auth.updateUser(uid, updates);
        return userRecord;
    } catch (error) {
        console.error('Error updating Firebase user:', error);
        throw error;
    }
}

/**
 * Delete Firebase user
 * @param {string} uid - Firebase user ID
 * @returns {Promise<void>}
 */
export async function deleteFirebaseUser(uid) {
    try {
        await auth.deleteUser(uid);
    } catch (error) {
        console.error('Error deleting Firebase user:', error);
        throw error;
    }
}

/**
 * Get Firebase user by UID
 * @param {string} uid - Firebase user ID
 * @returns {Promise<Object>} User record
 */
export async function getFirebaseUser(uid) {
    try {
        const userRecord = await auth.getUser(uid);
        return userRecord;
    } catch (error) {
        console.error('Error getting Firebase user:', error);
        throw error;
    }
}

/**
 * Get Firebase user by email
 * @param {string} email - User email
 * @returns {Promise<Object>} User record
 */
export async function getFirebaseUserByEmail(email) {
    try {
        const userRecord = await auth.getUserByEmail(email);
        return userRecord;
    } catch (error) {
        console.error('Error getting Firebase user by email:', error);
        throw error;
    }
}

/**
 * Verify Firebase ID token
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<Object>} Decoded token
 */
export async function verifyFirebaseToken(idToken) {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
}

/**
 * Create custom token for user (useful for server-side authentication)
 * @param {string} uid - Firebase user ID
 * @param {Object} additionalClaims - Optional additional claims
 * @returns {Promise<string>} Custom token
 */
export async function createCustomToken(uid, additionalClaims = {}) {
    try {
        const customToken = await auth.createCustomToken(uid, additionalClaims);
        return customToken;
    } catch (error) {
        console.error('Error creating custom token:', error);
        throw error;
    }
}

/**
 * Set custom user claims (for roles, permissions, etc.)
 * @param {string} uid - Firebase user ID
 * @param {Object} claims - Custom claims to set
 * @returns {Promise<void>}
 */
export async function setCustomClaims(uid, claims) {
    try {
        await auth.setCustomUserClaims(uid, claims);
    } catch (error) {
        console.error('Error setting custom claims:', error);
        throw error;
    }
}

/**
 * Revoke all refresh tokens for a user (force re-authentication)
 * @param {string} uid - Firebase user ID
 * @returns {Promise<void>}
 */
export async function revokeRefreshTokens(uid) {
    try {
        await auth.revokeRefreshTokens(uid);
    } catch (error) {
        console.error('Error revoking refresh tokens:', error);
        throw error;
    }
}

export default {
    createFirebaseUser,
    updateFirebaseUser,
    deleteFirebaseUser,
    getFirebaseUser,
    getFirebaseUserByEmail,
    verifyFirebaseToken,
    createCustomToken,
    setCustomClaims,
    revokeRefreshTokens
};
