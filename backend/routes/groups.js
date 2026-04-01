import express from 'express';
import {
    createGroup,
    getMyGroups,
    getGroup,
    joinGroup,
    updateGroup,
    closeGroup,
    getFinancialSummary,
    previewGroup,
    leaveGroup,
    removeMember,
    simulatePayout,
    requestRotationChange,
    approveRotationChange,
    applyRotationChange
} from '../controllers/groupController.js';
import { protect } from '../middleware/auth.js';
import { checkGroupAdmin } from '../middleware/adminCheck.js';
import { createGroupValidation, joinGroupValidation } from '../utils/validators.js';

const router = express.Router();

// Public group routes (require authentication)
router.post('/', protect, createGroupValidation, createGroup);
router.get('/', protect, getMyGroups);
router.get('/preview', protect, previewGroup);          // GET /api/groups/preview?code=XXXXXX
router.get('/:id', protect, getGroup);
router.get('/:id/financial-summary', protect, getFinancialSummary);
router.post('/join', protect, joinGroupValidation, joinGroup);
router.delete('/:id/leave', protect, leaveGroup);      // Member self-exit

// Admin-only routes
router.put('/:id', protect, checkGroupAdmin, updateGroup);
router.post('/:id/close', protect, checkGroupAdmin, closeGroup);
router.delete('/:id/members/:memberId', protect, checkGroupAdmin, removeMember);
router.post('/:id/simulate-payout', protect, checkGroupAdmin, simulatePayout); // Simulation/testing only

// Rotation-order change (democratic 3-step flow)
router.post('/:id/rotation-change', protect, requestRotationChange);                                    // Any member: create request
router.post('/:id/rotation-change/:requestId/approve', protect, approveRotationChange);                 // Any member: record approval
router.post('/:id/rotation-change/:requestId/apply', protect, checkGroupAdmin, applyRotationChange);    // Admin only: apply once all approved

export default router;
