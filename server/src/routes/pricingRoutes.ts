// server/src/routes/pricingRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
  getAllPricingRules,
  getPricingRuleById,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  getAllBulkRules,
  getBulkRuleById,
  createBulkRule,
  updateBulkRule,
  deleteBulkRule,
  getAllMarginRules,
  getMarginRuleById,
  createMarginRule,
  updateMarginRule,
  deleteMarginRule
} from '../controllers/pricingController';

const router = Router();

// Pricing tiers
router.get('/tiers', authenticateToken, getAllPricingRules);
router.get('/tiers/:id', authenticateToken, getPricingRuleById);
router.post('/tiers', authenticateToken, createPricingRule);
router.put('/tiers/:id', authenticateToken, updatePricingRule);
router.delete('/tiers/:id', authenticateToken, deletePricingRule);

// Bulk discounts
router.get('/bulk', authenticateToken, getAllBulkRules);
router.get('/bulk/:id', authenticateToken, getBulkRuleById);
router.post('/bulk', authenticateToken, createBulkRule);
router.put('/bulk/:id', authenticateToken, updateBulkRule);
router.delete('/bulk/:id', authenticateToken, deleteBulkRule);

// Margin constraints
router.get('/margin', authenticateToken, getAllMarginRules);
router.get('/margin/:id', authenticateToken, getMarginRuleById);
router.post('/margin', authenticateToken, createMarginRule);
router.put('/margin/:id', authenticateToken, updateMarginRule);
router.delete('/margin/:id', authenticateToken, deleteMarginRule);

export default router;
