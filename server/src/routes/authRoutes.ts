// src/routes/authRoutes.ts
import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/authController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.post('/register', authenticateToken, authorizeRoles('admin'), register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);

// Protected route
router.get('/me', authenticateToken, getMe);

export default router;