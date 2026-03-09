// server/src/routes/creditRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getAllCreditRequests, getCreditRequestById, getMyCreditRequests, createCreditRequest, updateCreditRequest } from '../controllers/creditController';

const router = Router();

router.get('/', authenticateToken, getAllCreditRequests);
router.get('/my', authenticateToken, getMyCreditRequests);
router.get('/:id', authenticateToken, getCreditRequestById);
router.post('/', authenticateToken, createCreditRequest);
router.patch('/:id', authenticateToken, updateCreditRequest);

export default router;
