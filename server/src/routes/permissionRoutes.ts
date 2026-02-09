// src/routes/permissionRoutes.ts
import { Router } from 'express';
import { getAllPermissions } from '../controllers/permissionController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getAllPermissions);

export default router;
