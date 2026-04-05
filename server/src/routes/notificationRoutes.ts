import { Router } from 'express';
import { getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getNotifications);
router.post('/read-all', authenticateToken, markAllNotificationsRead);
router.post('/:id/read', authenticateToken, markNotificationRead);
router.delete('/:id', authenticateToken, deleteNotification);

export default router;
