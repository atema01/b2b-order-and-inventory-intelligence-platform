// server/src/routes/settingRoutes.ts
import { Router } from 'express';
import { getTaxRate, setTaxRate, getStorageLocations, setStorageLocations } from '../controllers/settingController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
router.get('/tax-rate', authenticateToken, getTaxRate);
router.post('/tax-rate', authenticateToken, setTaxRate);
router.get('/storage-locations', authenticateToken, getStorageLocations);
router.post('/storage-locations', authenticateToken, setStorageLocations);
export default router;
