// src/utils/auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Salt rounds for bcrypt (12 is secure & standard)
const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password securely
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares a plain-text password with a hashed one
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generates a JWT token containing user identity
 * Stored in HttpOnly cookie (never in localStorage!)
 */
export const generateToken = (userId: string, role: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in .env');
  }

  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // Token valid for 7 days
  );
};