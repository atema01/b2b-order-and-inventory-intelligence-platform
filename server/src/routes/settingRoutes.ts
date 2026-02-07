// server/src/routes/settingRoutes.ts
import { Router } from 'express';
import { getTaxRate, setTaxRate } from '../controllers/settingController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
router.get('/tax-rate', authenticateToken, getTaxRate);
router.post('/tax-rate', authenticateToken, setTaxRate);
export default router;