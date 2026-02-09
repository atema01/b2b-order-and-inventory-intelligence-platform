// src/controllers/permissionController.ts
import { Request, Response } from 'express';
import pool from '../config/db';

export const getAllPermissions = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name
       FROM permissions
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get permissions error:', err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
};
