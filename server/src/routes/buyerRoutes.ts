// server/src/routes/buyerRoutes.ts
import { Router } from 'express';
import { getAllBuyers, getBuyerById, updateBuyer, resetBuyerPassword } from '../controllers/buyerController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';

const router = Router();
// Buyer management follows dynamic RBAC via the Buyers permission.
router.get('/', authenticateToken, authorizePermissions('Buyers'), getAllBuyers);
router.get('/:id', authenticateToken, authorizePermissions('Buyers'), getBuyerById);
router.put('/:id', authenticateToken, authorizePermissions('Buyers'), updateBuyer);
router.post('/:id/password', authenticateToken, authorizePermissions('Buyers'), resetBuyerPassword);


export default router;
