// src/config/db.ts
// Purpose: Centralized DB connection pool for reuse across the app
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Create a connection pool to PostgreSQL
// A "pool" manages multiple DB connections efficiently
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'b2b_platform',
  password: process.env.DB_PASSWORD || 'postgres', // ⚠️ Change in production!
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Test the connection on startup (optional but helpful for debugging)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
  }
});

export default pool;