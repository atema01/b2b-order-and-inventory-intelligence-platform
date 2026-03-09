// src/controllers/staffController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';
import { hashPassword } from '../utils/auth';

export const getAllStaff = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
         u.id,
         u.name,
         u.email,
         u.phone,
         u.status,
         r.name AS "role"
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.role_id IS NOT NULL AND u.role_id <> 'R-BUYER'
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

export const getStaffById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
         u.id,
         u.name,
         u.email,
         u.phone,
         u.status,
         r.name AS "role",
         u.role_id AS "roleId"
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get staff by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, roleId, status } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE users SET
         name = $1,
         email = $2,
         phone = $3,
         role_id = $4,
         status = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id`,
      [name, email, phone, roleId, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await logActivity(
      req,
      'Update Staff',
      'Users',
      `Updated staff ${id}.`
    );

    return getStaffById(req, res);
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Failed to update staff' });
  }
};

export const updateStaffStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    await logActivity(
      req,
      'Update Staff Status',
      'Users',
      `Set staff ${id} status to ${status}.`
    );
    return getStaffById(req, res);
  } catch (err) {
    console.error('Update staff status error:', err);
    res.status(500).json({ error: 'Failed to update staff status' });
  }
};

export const resetStaffPassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body || {};

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
      return res.status(404).json({ error: 'Staff member not found' });
    }
    await logActivity(
      req,
      'Reset Staff Password',
      'Users',
      `Password reset for staff ${id}.`
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset staff password error:', err);
    res.status(500).json({ error: 'Failed to reset staff password' });
  }
};
