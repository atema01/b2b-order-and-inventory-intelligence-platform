// server/src/routes/orderRoutes.ts
import { Router } from 'express';
import { getAllOrders,createOrder,updateOrder, updateOrderStatus,getOrderById,updateOrderItemPicked} from '../controllers/orderController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
// In orderRoutes.ts
router.patch('/:id/status', authenticateToken, updateOrderStatus);
router.post('/', authenticateToken, createOrder);
router.put('/:id', authenticateToken, updateOrder);
router.get('/', authenticateToken, getAllOrders);
router.get('/:id', authenticateToken, getOrderById); // ← Add this route
router.patch('/:orderId/items/:itemId/pick', authenticateToken, updateOrderItemPicked);

export default router; // ← This line is REQUIRED