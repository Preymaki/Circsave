import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';

/**
 * Middleware to check if the authenticated user is a system admin (role === 'admin')
 * Must be used AFTER the `protect` middleware so that req.user is already set
 */
export const checkSystemAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. System admin privileges required.'
        });
    }

    next();
};

/**
 * Middleware to check if user is admin of a specific group
 * Attaches the group to req.group if user is admin
 */
export const checkGroupAdmin = async (req, res, next) => {
    try {
        // Routes may use :id or :groupId — support both
        const groupId = req.params.id || req.params.groupId;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        // Get group from Firestore
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Check if current user is the admin
        if (group.adminId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only group admin can perform this action.'
            });
        }

        // Attach group to request
        req.group = group;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying admin status',
            error: error.message
        });
    }
};

/**
 * Middleware to check if user is a member of a specific group
 * Attaches the group to req.group if user is a member
 */
export const isGroupMember = async (req, res, next) => {
    try {
        // Routes may use :id or :groupId — support both
        const groupId = req.params.id || req.params.groupId;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        // Get group from Firestore
        const groupDoc = await db.collection(COLLECTIONS.GROUPS).doc(groupId).get();

        if (!groupDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const group = { id: groupDoc.id, ...groupDoc.data() };

        // Check if current user is a member
        const isMember = group.members && group.members.some(
            m => m.userId === req.user.id
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not a member of this group.'
            });
        }

        // Attach group to request
        req.group = group;
        next();
    } catch (error) {
        console.error('Member check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying membership',
            error: error.message
        });
    }
};

export default { checkGroupAdmin, isGroupMember, checkSystemAdmin };
