// server/src/routes/categoryRoutes.ts
import { Router } from 'express';
import { createCategory, deleteCategory, getAllCategories, updateCategory } from '../controllers/categoryController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
router.get('/', authenticateToken, getAllCategories);
// server/src/routes/categoryRoutes.ts
router.post('/', authenticateToken, createCategory);
router.put('/:id', authenticateToken, updateCategory);
router.delete('/:id', authenticateToken, deleteCategory);
export default router;