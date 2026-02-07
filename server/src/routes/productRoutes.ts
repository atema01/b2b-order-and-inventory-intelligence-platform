// src/routes/productRoutes.ts
import { Router } from 'express';
import { getProductById,createProduct,getAllProducts,updateProduct,deleteProduct} from '../controllers/productController';
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
export default router;