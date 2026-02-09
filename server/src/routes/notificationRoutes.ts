import { Router } from 'express';
import { getNotifications, markAllNotificationsRead, deleteNotification } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getNotifications);
router.post('/read-all', authenticateToken, markAllNotificationsRead);
router.delete('/:id', authenticateToken, deleteNotification);

export default router;
