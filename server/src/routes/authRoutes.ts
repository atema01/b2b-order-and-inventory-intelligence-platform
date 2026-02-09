// src/routes/authRoutes.ts
import { Router } from 'express';
import { register, login, getMe, logout, changePassword, updateMe } from '../controllers/authController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.post('/register', authenticateToken, authorizeRoles('R-ADMIN', 'admin'), register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/change-password', authenticateToken, changePassword);
router.put('/me', authenticateToken, updateMe);

// Protected route
router.get('/me', authenticateToken, getMe);

export default router;
