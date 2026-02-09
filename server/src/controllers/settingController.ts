// server/src/controllers/settingController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';

const DEFAULT_STORAGE_LOCATIONS = [
  { id: 'mainWarehouse', name: 'Main Warehouse', capacityUnits: 1000 },
  { id: 'backRoom', name: 'Back Room', capacityUnits: 1000 },
  { id: 'showRoom', name: 'Show Room', capacityUnits: 1000 }
];

const normalizeStorageLocations = (input: any) => {
  const defaults = new Map(DEFAULT_STORAGE_LOCATIONS.map((loc) => [loc.id, loc]));
  const incoming = Array.isArray(input) ? input : [];
  const merged = new Map<string, { id: string; name: string; capacityUnits: number }>();

  for (const loc of incoming) {
    if (!loc || typeof loc !== 'object') continue;
    const id = String(loc.id);
    if (!defaults.has(id)) continue;
    const fallback = defaults.get(id)!;
    const name = typeof loc.name === 'string' && loc.name.trim() ? loc.name.trim() : fallback.name;
    const rawUnits = typeof loc.capacityUnits === 'number' ? loc.capacityUnits : loc.capacity;
    const capRaw = typeof rawUnits === 'number' ? rawUnits : fallback.capacityUnits;
    const capacityUnits = Math.max(0, Math.round(capRaw));
    merged.set(id, { id, name, capacityUnits });
  }

  for (const def of DEFAULT_STORAGE_LOCATIONS) {
    if (!merged.has(def.id)) {
      merged.set(def.id, { ...def });
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const order = ['mainWarehouse', 'backRoom', 'showRoom'];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });
};

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

export const getStorageLocations = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['storage_locations']
    );

    if (result.rows.length === 0) {
      return res.json({ locations: DEFAULT_STORAGE_LOCATIONS });
    }

    const rawValue = result.rows[0].value;
    let parsed: any = [];
    try {
      parsed = JSON.parse(rawValue);
    } catch (err) {
      parsed = [];
    }

    res.json({ locations: normalizeStorageLocations(parsed) });
  } catch (err) {
    console.error('Get storage locations error:', err);
    res.status(500).json({ error: 'Failed to fetch storage locations' });
  }
};
//handling the storage locations setting, ensuring that the input is normalized and validated before being stored in the database. It also logs the activity of updating storage locations for auditing purposes.
export const setStorageLocations = async (req: Request, res: Response) => {
  const { locations } = req.body || {};
  const normalized = normalizeStorageLocations(locations);

  try {
    await pool.query(
      `INSERT INTO settings (key, value)
       VALUES ('storage_locations', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(normalized)]
    );

    await logActivity(
      req,
      'Update Storage Locations',
      'Settings',
      `Updated ${normalized.length} storage locations.`
    );

    res.json({ message: 'Storage locations updated successfully', locations: normalized });
  } catch (err) {
    console.error('Set storage locations error:', err);
    res.status(500).json({ error: 'Failed to update storage locations' });
  }
};
//handling the tax rate setting, ensuring it's a valid number between 0 and 100, and storing it as a decimal in the database.
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
    await logActivity(
      req,
      'Update Tax Rate',
      'Settings',
      `Set tax rate to ${taxRate}%.`
    );
    res.json({ message: 'Tax rate updated successfully' });
  } catch (err) {
    console.error('Set tax rate error:', err);
    res.status(500).json({ error: 'Failed to update tax rate' });
  }
};
