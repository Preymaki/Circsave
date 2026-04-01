import { createFirebaseUser, createCustomToken } from '../utils/firebaseAuth.js';
import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';
import { prepareForFirestore, serverTimestamp } from '../db/converters.js';
import { hashPassword, comparePassword } from '../utils/password.js';

/**
 * @desc    Register new user
 * @route   POST /api/auth/signup
 * @access  Public
 */
export const signup = async (req, res) => {
    try {
        const { fullName, email, password, phoneNumber } = req.body;

        // Check if user already exists in Firestore
        const existingUserQuery = await db.collection(COLLECTIONS.USERS)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!existingUserQuery.empty) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create user in Firebase Authentication
        const firebaseUser = await createFirebaseUser(email, password, fullName);

        // Hash password for Firestore (backup/sync)
        const hashedPassword = await hashPassword(password);

        // Create user document in Firestore (using Firebase UID as document ID)
        const userData = prepareForFirestore({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber: phoneNumber || null,
            profileImage: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).set(userData);

        // Create wallet for the user (using same UID for 1:1 relationship)
        const walletData = prepareForFirestore({
            userId: firebaseUser.uid,
            availableBalance: 0,
            lockedBalance: 0,
            totalFunded: 0,
            totalSpent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await db.collection(COLLECTIONS.WALLETS).doc(firebaseUser.uid).set(walletData);

        // Generate custom token for client authentication
        const token = await createCustomToken(firebaseUser.uid);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: firebaseUser.uid,
                    fullName,
                    email,
                    phoneNumber
                },
                token
            }
        });
    } catch (error) {
        console.error('Signup error:', error);

        // Handle Firebase Auth errors
        let message = 'Error registering user';
        if (error.code === 'auth/email-already-exists') {
            message = 'User with this email already exists';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password is too weak. Must be at least 6 characters';
        }

        res.status(500).json({
            success: false,
            message,
            error: error.message
        });
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 * 
 * NOTE: With Firebase Authentication, the client should handle login directly
 * using Firebase SDK (signInWithEmailAndPassword). This endpoint is for
 * server-side verification only or custom token generation.
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user from Firestore
        const userQuery = await db.collection(COLLECTIONS.USERS)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (userQuery.empty) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();

        // Check password (stored in Firestore as backup)
        const isPasswordMatch = await comparePassword(password, userData.password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token for client authentication
        const token = await createCustomToken(userDoc.id);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: userDoc.id,
                    fullName: userData.fullName,
                    email: userData.email,
                    phoneNumber: userData.phoneNumber
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res) => {
    try {
        // User is already attached to req by protect middleware
        const user = req.user;

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user profile',
            error: error.message
        });
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber } = req.body;

        // Build update data object
        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        updateData.updatedAt = serverTimestamp();

        // Update user in Firestore
        await db.collection(COLLECTIONS.USERS)
            .doc(req.user.id)
            .update(prepareForFirestore(updateData));

        // Get updated user data
        const updatedUserDoc = await db.collection(COLLECTIONS.USERS)
            .doc(req.user.id)
            .get();

        const updatedUserData = updatedUserDoc.data();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    id: updatedUserDoc.id,
                    fullName: updatedUserData.fullName,
                    email: updatedUserData.email,
                    phoneNumber: updatedUserData.phoneNumber
                }
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};
