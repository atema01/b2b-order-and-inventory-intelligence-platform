// src/controllers/authController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { logActivity } from '../utils/activityLog';

/**
 * POST /api/auth/register
 * Only admins can register new users (staff or buyers)
 */
export const register = async (req: Request, res: Response) => {
  const { 
    email, 
    password, 
    name, 
    phone, 
    role_id, // ← Use role_id, not role string
    companyName,
    address,
    creditLimit = 0,
    paymentTerms = 'Net 30',
    tier = 'Bronze'
  } = req.body;

  // Validate required fields
  if (!email || !password || !name || !role_id) {
    return res.status(400).json({ error: 'Email, password, name, and role_id are required' });
  }

  try {
    const actorRoleId = (req as any).user?.role;
    if (!actorRoleId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Enforce dynamic RBAC based on the target account type being created.
    const actorPermResult = await pool.query(
      `SELECT p.name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [actorRoleId]
    );
    const actorPermissions = new Set<string>(actorPermResult.rows.map((row: any) => row.name));

    const isBuyer = role_id === 'R-BUYER';
    const requiredPermission = isBuyer ? 'Buyers' : 'Staff';
    if (!actorPermissions.has(requiredPermission) && !actorPermissions.has('Roles')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Build dynamic query based on role type
    let queryText = '';
    let values: any[] = [];

    // Determine if this is a buyer (check role_id)
    // Reuse the already computed role classification.

    if (isBuyer) {
      let discountRate = 0;
      let tierName: string | null = null;
      const desiredTier = typeof tier === 'string' ? tier.trim() : '';

      if (desiredTier) {
        const tierResult = await pool.query(
          'SELECT name, discount_percentage FROM pricing_rules WHERE name = $1',
          [desiredTier]
        );
        if (tierResult.rows.length > 0) {
          tierName = tierResult.rows[0].name;
          discountRate = Number(tierResult.rows[0].discount_percentage || 0) / 100;
        }
      }

      queryText = `
        INSERT INTO users (
          email, password_hash, name, phone, company_name, address,
          credit_limit, available_credit, payment_terms, tier, discount_rate, join_date, role_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, CURRENT_DATE, $11)
        RETURNING id, email, name, company_name, role_id;
      `;
      values = [
        email, passwordHash, name, phone, companyName, address,
        creditLimit, paymentTerms, tierName, discountRate, role_id
      ];
    } else {
      // staff or admin
      queryText = `
        INSERT INTO users (email, password_hash, name, phone, role_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, role_id;
      `;
      values = [email, passwordHash, name, phone, role_id];
    }

    const result = await pool.query(queryText, values);
    const newUser = result.rows[0];

    if (isBuyer) {
      await logActivity(
        req,
        'Register Buyer',
        'Users',
        `Registered buyer ${companyName || name} (${newUser.id}).`
      );
    } else {
      await logActivity(
        req,
        'Register Staff',
        'Users',
        `Registered staff ${name} (${newUser.id}).`
      );
    }

    // Fetch role name for response
    const roleResult = await pool.query(
      'SELECT name FROM roles WHERE id = $1',
      [newUser.role_id]
    );
    const roleName = roleResult.rows[0]?.name || 'Unknown';

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: roleName,
        ...(newUser.company_name && { companyName: newUser.company_name })
      }
    });

  } catch (err: any) {
    if (err.code === '23505') { // Unique violation (email exists)
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/auth/login
 * Authenticates user and sets HttpOnly cookie with JWT
 */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, role_id, password_hash, status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (user.status !== 'Active') {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = generateToken(user.id, user.role_id);

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Fetch role name for response
    const roleResult = await pool.query(
      'SELECT name FROM roles WHERE id = $1',
      [user.role_id]
    );
    const roleName = roleResult.rows[0]?.name || 'Unknown';

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: roleName
      }
    });

    await logActivity(
      req,
      'Login',
      'Users',
      `User ${user.email} logged in.`
    );

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/auth/me
 * Returns current user info with resolved permissions
 */
export const getMe = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    // Fetch user + role
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone, u.role_id, u.company_name, u.tier,
              r.name AS role_name,
              COALESCE(pr.name, '') AS tier_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN pricing_rules pr ON pr.name = u.tier
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Fetch permissions for this role
    let permissions: Record<string, boolean> = {};
    if (user.role_id) {
      const permResult = await pool.query(
        `SELECT p.name
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1`,
        [user.role_id]
      );
      permissions = permResult.rows.reduce((acc, p) => {
        acc[p.name] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Build response matching your frontend's expected shape
    const response = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role_name || 'Unknown',
      permissions,
      // Buyer-specific fields
      ...(user.role_name === 'Buyer' && {
        companyName: user.company_name,
        tier: user.tier_name || ''
      })
    };

    res.json(response);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/auth/logout
 * Clears the token cookie
 */
export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

/**
 * POST /api/auth/change-password
 * Change current user's password
 */
export const changePassword = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash, email FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, email } = result.rows[0];
    const isValid = await comparePassword(currentPassword, password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, userId]
    );

    await logActivity(
      req,
      'Change Password',
      'Users',
      `User ${email} changed password.`
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

/**
 * PUT /api/auth/me
 * Update current user's profile
 */
export const updateMe = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { name, email, phone, companyName } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const userResult = await pool.query('SELECT role_id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isBuyer = userResult.rows[0].role_id === 'R-BUYER';

    if (isBuyer) {
      await pool.query(
        `UPDATE users SET
           name = $1,
           email = $2,
           phone = $3,
           company_name = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [name, email, phone || null, companyName || null, userId]
      );
    } else {
      await pool.query(
        `UPDATE users SET
           name = $1,
           email = $2,
           phone = $3,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [name, email, phone || null, userId]
      );
    }

    await logActivity(
      req,
      'Update Profile',
      'Users',
      `User ${email} updated profile.`
    );

    return getMe(req, res);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
