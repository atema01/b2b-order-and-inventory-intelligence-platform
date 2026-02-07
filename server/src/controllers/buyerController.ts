// server/src/controllers/buyerController.ts
import { Request, Response } from 'express';
import pool from '../config/db';

// server/src/controllers/buyerController.ts
export const getAllBuyers = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        company_name AS "companyName",
        name AS "contactPerson",
        email,
        phone,
        address,
        credit_limit AS "creditLimit",
        available_credit AS "availableCredit",
        outstanding_balance AS "outstandingBalance",
        payment_terms AS "paymentTerms",
        COALESCE(total_spend, 0) AS "totalSpend",
        COALESCE(total_orders, 0) AS "totalOrders",
        COALESCE(tier, 'Silver') AS "tier",
        COALESCE(discount_rate, 0.05) AS "discountRate",
        join_date AS "joinDate",
        COALESCE(avatar, '') AS "avatar",
        COALESCE(status, 'Active') AS "status"
      FROM users
      WHERE role_id = 'R-BUYER'
      ORDER BY company_name
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
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role_id = $2',
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
      creditLimit: buyer.credit_limit,
      availableCredit: buyer.available_credit,
      outstandingBalance: buyer.outstanding_balance,
      paymentTerms: buyer.payment_terms,
      totalSpend: buyer.total_spend || 0,
      totalOrders: buyer.total_orders || 0,
      tier: buyer.tier || 'Bronze',
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
    // Build dynamic query based on provided fields
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map((field, index) => {
      // Map frontend field names to database column names
      const dbField = field === 'companyName' ? 'company_name' :
                     field === 'contactPerson' ? 'name' :
                     field === 'creditLimit' ? 'credit_limit' :
                     field === 'availableCredit' ? 'available_credit' :
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
    // In production, you'd hash the password
    // For now, store as plain text (you'll implement proper hashing later)
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [newPassword, id] // Replace with bcrypt.hash(newPassword) in production
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};