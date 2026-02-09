import { Router } from 'express';
import { getSystemLogs } from '../controllers/systemLogController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getSystemLogs);

export default router;
