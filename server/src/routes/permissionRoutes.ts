// src/routes/permissionRoutes.ts
import { Router } from 'express';
import { getAllPermissions } from '../controllers/permissionController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();

// Permission catalog is used in role management, so gate it with Roles permission.
router.get('/', authenticateToken, authorizePermissions('Roles'), getAllPermissions);

export default router;
