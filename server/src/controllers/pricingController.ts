// server/src/controllers/pricingController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const ensureSellerAccess = (req: Request, res: Response): boolean => {
  const role = (req as any).user?.role;
  if (role === 'R-BUYER') {
    res.status(403).json({ error: 'Insufficient permissions' });
    return false;
  }
  return true;
};

const mapPricingRule = (row: any) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  discountPercentage: parseNumber(row.discount_percentage),
  minSpend: parseNumber(row.min_spend),
  minYears: Number(row.min_years || 0),
  memberCount: Number(row.member_count || 0),
  status: row.status || 'Active'
});

const mapBulkRule = (row: any) => ({
  id: row.id,
  unitThreshold: Number(row.unit_threshold || 0),
  discountPercentage: parseNumber(row.discount_percentage),
  isActive: Boolean(row.is_active)
});

const mapMarginRule = (row: any) => ({
  id: row.id,
  minUnitCost: parseNumber(row.min_unit_cost),
  minMarginPercentage: parseNumber(row.min_margin_percentage),
  bonusDiscount: parseNumber(row.bonus_discount),
  isActive: Boolean(row.is_active)
});

// ===== Pricing Tiers =====
export const getAllPricingRules = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;

  try {
    const result = await pool.query(
      `SELECT pr.id, pr.name, pr.description, pr.discount_percentage, pr.min_spend, pr.min_years, pr.status,
              COALESCE(u.count, 0) AS member_count
       FROM pricing_rules pr
       LEFT JOIN (
         SELECT tier, COUNT(*)::int AS count
         FROM users
         WHERE role_id = 'R-BUYER'
         GROUP BY tier
       ) u ON u.tier = pr.name
       ORDER BY pr.min_spend ASC, pr.min_years ASC`
    );

    res.json(result.rows.map(mapPricingRule));
  } catch (err) {
    console.error('Get pricing rules error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
};

export const getPricingRuleById = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT pr.id, pr.name, pr.description, pr.discount_percentage, pr.min_spend, pr.min_years, pr.status,
              COALESCE(u.count, 0) AS member_count
       FROM pricing_rules pr
       LEFT JOIN (
         SELECT tier, COUNT(*)::int AS count
         FROM users
         WHERE role_id = 'R-BUYER'
         GROUP BY tier
       ) u ON u.tier = pr.name
       WHERE pr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    res.json(mapPricingRule(result.rows[0]));
  } catch (err) {
    console.error('Get pricing rule error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing rule' });
  }
};

export const createPricingRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { name, description, discountPercentage, minSpend, minYears, status } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const id = `PR-${Date.now().toString().slice(-6)}`;

  try {
    const result = await pool.query(
      `INSERT INTO pricing_rules
        (id, name, description, discount_percentage, min_spend, min_years, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, description, discount_percentage, min_spend, min_years, status`,
      [
        id,
        name,
        description || '',
        parseNumber(discountPercentage),
        parseNumber(minSpend),
        Number(minYears || 0),
        status || 'Active'
      ]
    );

    await logActivity(
      req,
      'Create Pricing Rule',
      'Settings',
      `Pricing rule ${id} created.`
    );

    res.status(201).json(mapPricingRule({ ...result.rows[0], member_count: 0 }));
  } catch (err) {
    console.error('Create pricing rule error:', err);
    res.status(500).json({ error: 'Failed to create pricing rule' });
  }
};

export const updatePricingRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;
  const { name, description, discountPercentage, minSpend, minYears, status } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE pricing_rules SET
         name = $1,
         description = $2,
         discount_percentage = $3,
         min_spend = $4,
         min_years = $5,
         status = $6,
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, description, discount_percentage, min_spend, min_years, status`,
      [
        name,
        description || '',
        parseNumber(discountPercentage),
        parseNumber(minSpend),
        Number(minYears || 0),
        status || 'Active',
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    await logActivity(
      req,
      'Update Pricing Rule',
      'Settings',
      `Pricing rule ${id} updated.`
    );

    res.json(mapPricingRule({ ...result.rows[0], member_count: 0 }));
  } catch (err) {
    console.error('Update pricing rule error:', err);
    res.status(500).json({ error: 'Failed to update pricing rule' });
  }
};

export const deletePricingRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM pricing_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    await logActivity(
      req,
      'Delete Pricing Rule',
      'Settings',
      `Pricing rule ${id} deleted.`
    );

    res.json({ message: 'Pricing rule deleted' });
  } catch (err) {
    console.error('Delete pricing rule error:', err);
    res.status(500).json({ error: 'Failed to delete pricing rule' });
  }
};

// ===== Bulk Discounts =====
export const getAllBulkRules = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT id, unit_threshold, discount_percentage, is_active
       FROM bulk_discount_rules
       ORDER BY unit_threshold ASC`
    );
    res.json(result.rows.map(mapBulkRule));
  } catch (err) {
    console.error('Get bulk rules error:', err);
    res.status(500).json({ error: 'Failed to fetch bulk rules' });
  }
};

export const getBulkRuleById = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, unit_threshold, discount_percentage, is_active
       FROM bulk_discount_rules
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk rule not found' });
    }
    res.json(mapBulkRule(result.rows[0]));
  } catch (err) {
    console.error('Get bulk rule error:', err);
    res.status(500).json({ error: 'Failed to fetch bulk rule' });
  }
};

export const createBulkRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { unitThreshold, discountPercentage, isActive } = req.body || {};

  if (!unitThreshold) {
    return res.status(400).json({ error: 'unitThreshold is required' });
  }

  const id = `BR-${Date.now().toString().slice(-6)}`;

  try {
    const result = await pool.query(
      `INSERT INTO bulk_discount_rules
        (id, unit_threshold, discount_percentage, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, unit_threshold, discount_percentage, is_active`,
      [id, Number(unitThreshold), parseNumber(discountPercentage), isActive !== false]
    );

    await logActivity(
      req,
      'Create Bulk Rule',
      'Settings',
      `Bulk rule ${id} created.`
    );

    res.status(201).json(mapBulkRule(result.rows[0]));
  } catch (err) {
    console.error('Create bulk rule error:', err);
    res.status(500).json({ error: 'Failed to create bulk rule' });
  }
};

export const updateBulkRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;
  const { unitThreshold, discountPercentage, isActive } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE bulk_discount_rules SET
         unit_threshold = $1,
         discount_percentage = $2,
         is_active = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, unit_threshold, discount_percentage, is_active`,
      [Number(unitThreshold), parseNumber(discountPercentage), isActive !== false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk rule not found' });
    }

    await logActivity(
      req,
      'Update Bulk Rule',
      'Settings',
      `Bulk rule ${id} updated.`
    );

    res.json(mapBulkRule(result.rows[0]));
  } catch (err) {
    console.error('Update bulk rule error:', err);
    res.status(500).json({ error: 'Failed to update bulk rule' });
  }
};

export const deleteBulkRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM bulk_discount_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk rule not found' });
    }

    await logActivity(
      req,
      'Delete Bulk Rule',
      'Settings',
      `Bulk rule ${id} deleted.`
    );

    res.json({ message: 'Bulk rule deleted' });
  } catch (err) {
    console.error('Delete bulk rule error:', err);
    res.status(500).json({ error: 'Failed to delete bulk rule' });
  }
};

// ===== Margin Constraints =====
export const getAllMarginRules = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT id, min_unit_cost, min_margin_percentage, bonus_discount, is_active
       FROM margin_discount_rules
       ORDER BY min_unit_cost ASC`
    );
    res.json(result.rows.map(mapMarginRule));
  } catch (err) {
    console.error('Get margin rules error:', err);
    res.status(500).json({ error: 'Failed to fetch margin rules' });
  }
};

export const getMarginRuleById = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, min_unit_cost, min_margin_percentage, bonus_discount, is_active
       FROM margin_discount_rules
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Margin rule not found' });
    }
    res.json(mapMarginRule(result.rows[0]));
  } catch (err) {
    console.error('Get margin rule error:', err);
    res.status(500).json({ error: 'Failed to fetch margin rule' });
  }
};

export const createMarginRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { minUnitCost, minMarginPercentage, bonusDiscount, isActive } = req.body || {};

  const id = `MR-${Date.now().toString().slice(-6)}`;

  try {
    const result = await pool.query(
      `INSERT INTO margin_discount_rules
        (id, min_unit_cost, min_margin_percentage, bonus_discount, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, min_unit_cost, min_margin_percentage, bonus_discount, is_active`,
      [
        id,
        parseNumber(minUnitCost),
        parseNumber(minMarginPercentage),
        parseNumber(bonusDiscount),
        isActive !== false
      ]
    );

    await logActivity(
      req,
      'Create Margin Rule',
      'Settings',
      `Margin rule ${id} created.`
    );

    res.status(201).json(mapMarginRule(result.rows[0]));
  } catch (err) {
    console.error('Create margin rule error:', err);
    res.status(500).json({ error: 'Failed to create margin rule' });
  }
};

export const updateMarginRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;
  const { minUnitCost, minMarginPercentage, bonusDiscount, isActive } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE margin_discount_rules SET
         min_unit_cost = $1,
         min_margin_percentage = $2,
         bonus_discount = $3,
         is_active = $4,
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, min_unit_cost, min_margin_percentage, bonus_discount, is_active`,
      [
        parseNumber(minUnitCost),
        parseNumber(minMarginPercentage),
        parseNumber(bonusDiscount),
        isActive !== false,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Margin rule not found' });
    }

    await logActivity(
      req,
      'Update Margin Rule',
      'Settings',
      `Margin rule ${id} updated.`
    );

    res.json(mapMarginRule(result.rows[0]));
  } catch (err) {
    console.error('Update margin rule error:', err);
    res.status(500).json({ error: 'Failed to update margin rule' });
  }
};

export const deleteMarginRule = async (req: Request, res: Response) => {
  if (!ensureSellerAccess(req, res)) return;
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM margin_discount_rules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Margin rule not found' });
    }

    await logActivity(
      req,
      'Delete Margin Rule',
      'Settings',
      `Margin rule ${id} deleted.`
    );

    res.json({ message: 'Margin rule deleted' });
  } catch (err) {
    console.error('Delete margin rule error:', err);
    res.status(500).json({ error: 'Failed to delete margin rule' });
  }
};
