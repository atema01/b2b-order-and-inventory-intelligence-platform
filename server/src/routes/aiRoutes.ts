import { Router } from 'express';
import { chatWithWebsiteAssistant, getChatbotStatus } from '../controllers/aiController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/status', authenticateToken, getChatbotStatus);
router.post('/chat', authenticateToken, chatWithWebsiteAssistant);

export default router;
