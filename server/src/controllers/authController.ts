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
    role,
    companyName,
    address,
    creditLimit = 0,
    paymentTerms = 'Net 30'
  } = req.body;

  // Validate required fields
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Email, password, name, and role are required' });
  }

  if (!['admin', 'staff', 'buyer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Hash password
    const passwordHash = await hashPassword(password);

    // Build dynamic query based on role
    let queryText = '';
    let values: any[] = [];

    if (role === 'buyer') {
      queryText = `
        INSERT INTO users (
          email, password_hash, role, name, phone, company_name, address,
          credit_limit, available_credit, payment_terms, join_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, CURRENT_DATE)
        RETURNING id, email, role, name, company_name, status;
      `;
      values = [
        email, passwordHash, role, name, phone, companyName, address,
        creditLimit, paymentTerms
      ];
    } else {
      // staff or admin
      queryText = `
        INSERT INTO users (email, password_hash, role, name, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, role, name, status;
      `;
      values = [email, passwordHash, role, name, phone];
    }

    const result = await pool.query(queryText, values);
    const newUser = result.rows[0];

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        ...(newUser.company_name && { companyName: newUser.company_name }),
        status: newUser.status
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
      'SELECT id, email, role, password_hash, status FROM users WHERE email = $1',
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
    const token = generateToken(user.id, user.role);

    // Set HttpOnly cookie (secure, not accessible via JS)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/auth/me
 * Returns current user info (used on app load to hydrate context)
 */
export const getMe = async (req: Request, res: Response) => {
  // Middleware will attach user to req
  const userId = (req as any).user.userId;

  try {
    const result = await pool.query(
      `SELECT id, email, role, name, phone, company_name, credit_limit, 
              available_credit, outstanding_balance, tier, join_date
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
      ...(user.role === 'buyer' && {
        companyName: user.company_name,
        creditLimit: user.credit_limit,
        availableCredit: user.available_credit,
        outstandingBalance: user.outstanding_balance,
        tier: user.tier,
        joinDate: user.join_date
      })
    });

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