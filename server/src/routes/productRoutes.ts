// src/routes/productRoutes.ts
import { Router } from 'express';
import {
  addProductBatch,
  adjustProductStock,
  createProduct,
  deleteProduct,
  editProductBatch,
  getAllProducts,
  getProductById,
  removeProductBatch,
  updateProduct,
} from '../controllers/productController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
// server/src/routes/productRoutes.ts
// In productRoutes.ts
router.post('/', authenticateToken, createProduct);
router.get('/:id', authenticateToken, getProductById);
router.get('/', authenticateToken, getAllProducts);
// In productRoutes.ts
router.delete('/:id', authenticateToken, deleteProduct);
// In productRoutes.ts
router.put('/:id', authenticateToken, updateProduct);
router.post('/:id/batches', authenticateToken, addProductBatch);
router.put('/:id/batches/:batchId', authenticateToken, editProductBatch);
router.delete('/:id/batches/:batchId', authenticateToken, removeProductBatch);
router.post('/:id/adjust-stock', authenticateToken, adjustProductStock);
export default router;
