// src/routes/staffRoutes.ts
import { Router } from 'express';
import { getAllStaff, getStaffById, updateStaff, updateStaffStatus, resetStaffPassword } from '../controllers/staffController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();

// Staff administration follows dynamic RBAC via the Staff permission.
router.get('/', authenticateToken, authorizePermissions('Staff'), getAllStaff);
router.get('/:id', authenticateToken, authorizePermissions('Staff'), getStaffById);
router.put('/:id', authenticateToken, authorizePermissions('Staff'), updateStaff);
router.patch('/:id/status', authenticateToken, authorizePermissions('Staff'), updateStaffStatus);
router.post('/:id/password', authenticateToken, authorizePermissions('Staff'), resetStaffPassword);

export default router;
