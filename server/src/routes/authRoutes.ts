// src/routes/authRoutes.ts
import { Router } from 'express';
import { register, login, getMe, logout, changePassword, updateMe } from '../controllers/authController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();

// Public routes
// Registration is part of user management, so gate by management permissions.
router.post('/register', authenticateToken, authorizePermissions('Staff', 'Buyers', 'Roles'), register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.post('/change-password', authenticateToken, changePassword);
router.put('/me', authenticateToken, updateMe);

// Protected route
router.get('/me', authenticateToken, getMe);

export default router;
