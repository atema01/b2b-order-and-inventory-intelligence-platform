// server/src/controllers/settingController.ts
import { Request, Response } from 'express';
import pool from '../config/db';

export const getTaxRate = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['tax_rate']
    );
    
    const taxRate = result.rows.length > 0 
      ? parseFloat(result.rows[0].value) 
      : 0.15;
      
    res.json({ taxRate });
  } catch (err) {
    console.error('Get tax rate error:', err);
    res.status(500).json({ error: 'Failed to fetch tax rate' });
  }
};

export const setTaxRate = async (req: Request, res: Response) => {
  const { taxRate } = req.body;
  
  if (typeof taxRate !== 'number' || taxRate < 0 || taxRate > 100) {
    return res.status(400).json({ error: 'Invalid tax rate' });
  }

  try {
    await pool.query(
      `INSERT INTO settings (key, value) 
       VALUES ('tax_rate', $1) 
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [taxRate / 100]
    );
    res.json({ message: 'Tax rate updated successfully' });
  } catch (err) {
    console.error('Set tax rate error:', err);
    res.status(500).json({ error: 'Failed to update tax rate' });
  }
};