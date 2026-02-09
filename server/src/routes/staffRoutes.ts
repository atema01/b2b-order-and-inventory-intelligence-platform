// src/routes/staffRoutes.ts
import { Router } from 'express';
import { getAllStaff, getStaffById, updateStaff, updateStaffStatus, resetStaffPassword } from '../controllers/staffController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getAllStaff);
router.get('/:id', authenticateToken, getStaffById);
router.put('/:id', authenticateToken, updateStaff);
router.patch('/:id/status', authenticateToken, updateStaffStatus);
router.post('/:id/password', authenticateToken, resetStaffPassword);

export default router;
