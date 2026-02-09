// src/controllers/roleController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';

const mapPermissionsToObject = (names: string[]) => {
  return names.reduce((acc, name) => {
    if (name) acc[name] = true;
    return acc;
  }, {} as Record<string, boolean>);
};

export const getAllRoles = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
         r.id,
         r.name,
         r.description,
         r.access_level AS "accessLevel",
         COUNT(DISTINCT u.id) AS "memberCount",
         COALESCE(json_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '[]') AS permissions
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE r.id <> 'R-BUYER' AND r.name <> 'Buyer'
       GROUP BY r.id
       ORDER BY r.name`
    );

    const roles = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      accessLevel: row.accessLevel,
      memberCount: Number(row.memberCount) || 0,
      permissions: mapPermissionsToObject(row.permissions || [])
    }));

    res.json(roles);
  } catch (err) {
    console.error('Get roles error:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

export const getRoleById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (id === 'R-BUYER') {
    return res.status(404).json({ error: 'Role not found' });
  }
  try {
    const result = await pool.query(
      `SELECT 
         r.id,
         r.name,
         r.description,
         r.access_level AS "accessLevel",
         COUNT(DISTINCT u.id) AS "memberCount",
         COALESCE(json_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '[]') AS permissions
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      description: row.description,
      accessLevel: row.accessLevel,
      memberCount: Number(row.memberCount) || 0,
      permissions: mapPermissionsToObject(row.permissions || [])
    });
  } catch (err) {
    console.error('Get role error:', err);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

export const updateRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, accessLevel, permissions } = req.body || {};

  if (!name || !accessLevel) {
    return res.status(400).json({ error: 'name and accessLevel are required' });
  }
  if (id === 'R-BUYER' || String(name).trim().toLowerCase() === 'buyer') {
    return res.status(400).json({ error: 'Buyer is not a configurable role' });
  }

  try {
    await pool.query('BEGIN');

    const roleResult = await pool.query(
      `UPDATE roles
       SET name = $1, description = $2, access_level = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id`,
      [name, description || '', accessLevel, id]
    );

    if (roleResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Role not found' });
    }

    if (permissions && typeof permissions === 'object') {
      const enabled = Object.keys(permissions).filter(k => permissions[k]);
      await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

      if (enabled.length > 0) {
        const permResult = await pool.query(
          `SELECT id, name FROM permissions WHERE name = ANY($1)`,
          [enabled]
        );

        for (const p of permResult.rows) {
          await pool.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [id, p.id]
          );
        }
      }
    }

    await pool.query('COMMIT');

    await logActivity(
      req,
      'Update Role',
      'Roles',
      `Updated role ${id} (${name}). Permissions updated.`
    );

    // Return updated role
    req.params.id = id;
    return getRoleById(req, res);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

export const createRole = async (req: Request, res: Response) => {
  const { name, description, accessLevel, permissions } = req.body || {};

  if (!name || !accessLevel) {
    return res.status(400).json({ error: 'name and accessLevel are required' });
  }
  if (String(name).trim().toLowerCase() === 'buyer') {
    return res.status(400).json({ error: 'Buyer is not a configurable role' });
  }

  const roleId = `R-${Date.now().toString().slice(-6)}`;

  try {
    await pool.query('BEGIN');

    await pool.query(
      `INSERT INTO roles (id, name, description, access_level)
       VALUES ($1, $2, $3, $4)`,
      [roleId, name, description || '', accessLevel]
    );

    if (permissions && typeof permissions === 'object') {
      const enabled = Object.keys(permissions).filter(k => permissions[k]);
      if (enabled.length > 0) {
        const permResult = await pool.query(
          `SELECT id, name FROM permissions WHERE name = ANY($1)`,
          [enabled]
        );

        for (const p of permResult.rows) {
          await pool.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [roleId, p.id]
          );
        }
      }
    }

    await pool.query('COMMIT');

    await logActivity(
      req,
      'Create Role',
      'Roles',
      `Created role ${roleId} (${name}).`
    );

    req.params.id = roleId;
    return getRoleById(req, res);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Create role error:', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

export const deleteRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const usage = await pool.query(
      'SELECT COUNT(*)::int AS count FROM users WHERE role_id = $1',
      [id]
    );
    if ((usage.rows[0]?.count || 0) > 0) {
      return res.status(400).json({ error: 'Role is assigned to staff' });
    }

    await pool.query('BEGIN');
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
    const result = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Role not found' });
    }
    await pool.query('COMMIT');

    await logActivity(
      req,
      'Delete Role',
      'Roles',
      `Deleted role ${id}.`
    );
    res.json({ message: 'Role deleted' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Delete role error:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};
