// src/routes/roleRoutes.ts
import { Router } from 'express';
import { getAllRoles, getRoleById, createRole, updateRole, deleteRole } from '../controllers/roleController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getAllRoles);
router.get('/:id', authenticateToken, getRoleById);
router.post('/', authenticateToken, createRole);
router.put('/:id', authenticateToken, updateRole);
router.delete('/:id', authenticateToken, deleteRole);

export default router;
