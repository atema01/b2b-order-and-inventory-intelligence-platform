// server/src/routes/paymentRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { createPayment, getAllPayments, getPaymentById, updatePaymentStatus } from '../controllers/paymentController';

const router = Router();

router.get('/', authenticateToken, getAllPayments);
router.get('/:id', authenticateToken, getPaymentById);
router.post('/', authenticateToken, createPayment);
router.patch('/:id', authenticateToken, updatePaymentStatus);

export default router;
