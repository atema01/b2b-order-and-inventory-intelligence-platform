// server/src/routes/creditRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getAllCreditRequests, getCreditRequestById, getMyCreditRequestById, getMyCreditRequests, createCreditRequest, updateCreditRequest, repayCreditRequest } from '../controllers/creditController';

const router = Router();

router.get('/', authenticateToken, getAllCreditRequests);
router.get('/my', authenticateToken, getMyCreditRequests);
router.get('/my/:id', authenticateToken, getMyCreditRequestById);
router.post('/', authenticateToken, createCreditRequest);
router.post('/repay/:id', authenticateToken, repayCreditRequest);
router.post('/:id/repay', authenticateToken, repayCreditRequest);
router.get('/:id', authenticateToken, getCreditRequestById);
router.patch('/:id', authenticateToken, updateCreditRequest);

export default router;
