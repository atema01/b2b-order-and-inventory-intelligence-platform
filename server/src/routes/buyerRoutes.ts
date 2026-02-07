// server/src/routes/buyerRoutes.ts
import { Router } from 'express';
import { getAllBuyers,getBuyerById,updateBuyer } from '../controllers/buyerController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
router.get('/', authenticateToken, getAllBuyers);
router.get('/:id', authenticateToken, getBuyerById);
router.put('/:id', authenticateToken, updateBuyer);


export default router;