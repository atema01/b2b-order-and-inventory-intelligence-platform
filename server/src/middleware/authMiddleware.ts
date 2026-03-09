// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../config/db';

dotenv.config();

/**
 * Verifies JWT from HttpOnly cookie and attaches user to request
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const headerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
  const token = req.cookies?.token || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET missing');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string; role: string };
    (req as any).user = decoded; // Attach to request object
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Restricts access to specific roles
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Restricts access by permission names assigned to the user's current role.
 * This keeps authorization dynamic when roles/permissions are user-defined.
 */
export const authorizePermissions = (...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRoleId = (req as any).user?.role;
      if (!userRoleId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Read effective permissions from role-permission mapping at request time.
      const permResult = await pool.query(
        `SELECT p.name
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1`,
        [userRoleId]
      );

      const userPermissions = new Set<string>(permResult.rows.map((row: any) => row.name));
      const hasRequiredPermission = requiredPermissions.some((permission) =>
        userPermissions.has(permission)
      );

      if (!hasRequiredPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (err) {
      console.error('Permission authorization error:', err);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};
