// server/src/routes/orderRoutes.ts
import { Router } from 'express';
import { getAllOrders,createOrder,updateOrder, updateOrderStatus,getOrderById,updateOrderItemPicked, getMyDraftOrder, upsertDraftOrder, getInventoryTurnoverMetrics, checkoutDraftOrderWithPayment, checkoutDraftOrderWithCredit } from '../controllers/orderController';
import { generateDemandForecasts, getDemandForecastMetrics } from '../controllers/forecastController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
// In orderRoutes.ts
router.patch('/:id/status', authenticateToken, updateOrderStatus);
router.get('/draft', authenticateToken, getMyDraftOrder);
router.put('/draft', authenticateToken, upsertDraftOrder);
router.get('/metrics/inventory-turnover', authenticateToken, getInventoryTurnoverMetrics);
router.get('/metrics/demand-forecast', authenticateToken, getDemandForecastMetrics);
router.post('/metrics/demand-forecast/generate', authenticateToken, generateDemandForecasts);
router.post('/checkout', authenticateToken, checkoutDraftOrderWithPayment);
router.post('/checkout-with-credit', authenticateToken, checkoutDraftOrderWithCredit);
router.post('/', authenticateToken, createOrder);
router.put('/:id', authenticateToken, updateOrder);
router.get('/', authenticateToken, getAllOrders);
router.get('/:id', authenticateToken, getOrderById); // ← Add this route
router.patch('/:orderId/items/:itemId/pick', authenticateToken, updateOrderItemPicked);

export default router; // ← This line is REQUIRED
