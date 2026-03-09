// src/routes/roleRoutes.ts
import { Router } from 'express';
import { getAllRoles, getRoleById, createRole, updateRole, deleteRole } from '../controllers/roleController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();

// Role management follows dynamic RBAC via the Roles permission.
router.get('/', authenticateToken, authorizePermissions('Roles'), getAllRoles);
router.get('/:id', authenticateToken, authorizePermissions('Roles'), getRoleById);
router.post('/', authenticateToken, authorizePermissions('Roles'), createRole);
router.put('/:id', authenticateToken, authorizePermissions('Roles'), updateRole);
router.delete('/:id', authenticateToken, authorizePermissions('Roles'), deleteRole);

export default router;
