// src/controllers/authController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';

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
    paymentTerms = 'Net 30'
  } = req.body;

  // Validate required fields
  if (!email || !password || !name || !role_id) {
    return res.status(400).json({ error: 'Email, password, name, and role_id are required' });
  }

  try {
    // Hash password
    const passwordHash = await hashPassword(password);

    // Build dynamic query based on role type
    let queryText = '';
    let values: any[] = [];

    // Determine if this is a buyer (check role_id)
    const isBuyer = role_id === 'R-BUYER';

    if (isBuyer) {
      queryText = `
        INSERT INTO users (
          email, password_hash, name, phone, company_name, address,
          credit_limit, available_credit, payment_terms, join_date, role_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, CURRENT_DATE, $9)
        RETURNING id, email, name, company_name, role_id;
      `;
      values = [
        email, passwordHash, name, phone, companyName, address,
        creditLimit, paymentTerms, role_id
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
      user: {
        id: user.id,
        email: user.email,
        role: roleName
      }
    });

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
      `SELECT u.id, u.email, u.name, u.role_id, u.company_name, u.tier,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
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
      role: user.role_name || 'Unknown',
      permissions,
      // Buyer-specific fields
      ...(user.role_name === 'Buyer' && {
        companyName: user.company_name,
        tier: user.tier
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