// server/src/controllers/buyerController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';
import { hashPassword } from '../utils/auth';

// server/src/controllers/buyerController.ts
export const getAllBuyers = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.company_name AS "companyName",
        u.name AS "contactPerson",
        u.email,
        u.phone,
        u.address,
        u.outstanding_balance AS "outstandingBalance",
        u.payment_terms AS "paymentTerms",
        COALESCE(u.total_spend, 0) AS "totalSpend",
        COALESCE(u.total_orders, 0) AS "totalOrders",
        COALESCE(pr.name, '') AS "tier",
        COALESCE(u.discount_rate, 0.05) AS "discountRate",
        u.join_date AS "joinDate",
        COALESCE(u.avatar, '') AS "avatar",
        COALESCE(u.status, 'Active') AS "status"
      FROM users u
      LEFT JOIN pricing_rules pr ON pr.name = u.tier
      WHERE u.role_id = 'R-BUYER'
      ORDER BY u.company_name
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get buyers error:', err);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
};

// GET /api/buyers/:id
// server/src/controllers/buyerController.ts
export const getBuyerById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;
  const isBuyer = currentUser?.role === 'R-BUYER';
  if (isBuyer && currentUser?.userId !== id) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  try {
    const result = await pool.query(
      `SELECT 
         u.*,
         COALESCE(pr.name, '') AS tier_name
       FROM users u
       LEFT JOIN pricing_rules pr ON pr.name = u.tier
       WHERE u.id = $1 AND u.role_id = $2`,
      [id, 'R-BUYER'] // Make sure you're filtering by buyer role
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const buyer = result.rows[0];
    
    // Return exactly what your frontend expects
    res.json({
      id: buyer.id,
      companyName: buyer.company_name,
      contactPerson: buyer.name, // Assuming 'name' is contact person
      email: buyer.email,
      phone: buyer.phone,
      address: buyer.address,
      outstandingBalance: buyer.outstanding_balance,
      paymentTerms: buyer.payment_terms,
      totalSpend: buyer.total_spend || 0,
      totalOrders: buyer.total_orders || 0,
      tier: buyer.tier_name || '',
      discountRate: buyer.discount_rate || 0,
      joinDate: buyer.join_date,
      avatar: buyer.avatar || '',
      status: buyer.status || 'Active'
    });
  } catch (err) {
    console.error('Get buyer by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch buyer' });
  }
};
// PUT /api/buyers/:id
export const updateBuyer = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    if (Object.prototype.hasOwnProperty.call(updates, 'tier')) {
      const desiredTier = typeof updates.tier === 'string' ? updates.tier.trim() : '';
      if (!desiredTier) {
        updates.tier = null;
        updates.discountRate = 0;
      } else {
        const tierResult = await pool.query(
          'SELECT name, discount_percentage FROM pricing_rules WHERE name = $1',
          [desiredTier]
        );
        if (tierResult.rows.length > 0) {
          updates.tier = tierResult.rows[0].name;
          updates.discountRate = Number(tierResult.rows[0].discount_percentage || 0) / 100;
        } else {
          updates.tier = null;
          updates.discountRate = 0;
        }
      }
    }

    // Build dynamic query based on provided fields
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map((field, index) => {
      // Map frontend field names to database column names
      const dbField = field === 'companyName' ? 'company_name' :
                     field === 'contactPerson' ? 'name' :
                     field === 'outstandingBalance' ? 'outstanding_balance' :
                     field === 'paymentTerms' ? 'payment_terms' :
                     field === 'totalSpend' ? 'total_spend' :
                     field === 'totalOrders' ? 'total_orders' :
                     field === 'discountRate' ? 'discount_rate' :
                     field === 'joinDate' ? 'join_date' :
                     field; // avatar, status, tier, email, phone, address
      return `${dbField} = $${index + 1}`;
    }).join(', ');

    const values = [...fields.map(field => updates[field]), id];

    const result = await pool.query(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${fields.length + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    await logActivity(
      req,
      'Update Buyer',
      'Users',
      `Updated buyer ${id}.`
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update buyer error:', err);
    res.status(500).json({ error: 'Failed to update buyer' });
  }
};

// POST /api/buyers/:id/password
export const resetBuyerPassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  try {
    // Always hash passwords before persisting to protect credentials at rest.
    const hashedPassword = await hashPassword(newPassword);

    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    await logActivity(
      req,
      'Reset Buyer Password',
      'Users',
      `Password reset for buyer ${id}.`
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
