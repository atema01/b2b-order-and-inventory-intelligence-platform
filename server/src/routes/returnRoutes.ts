// src/routes/returnRoutes.ts
import { Router } from 'express';
import { getAllReturns, getReturnById, createReturnLog, updateReturnLog, deleteReturnLog } from '../controllers/returnController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getAllReturns);
router.get('/:id', authenticateToken, getReturnById);
router.post('/', authenticateToken, createReturnLog);
router.put('/:id', authenticateToken, updateReturnLog);
router.delete('/:id', authenticateToken, deleteReturnLog);

export default router;
