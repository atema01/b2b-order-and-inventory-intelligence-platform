// src/config/db.ts
// Purpose: Centralized DB connection pool for reuse across the app
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const shouldUseDatabaseUrl = !isDevelopment && Boolean(process.env.DATABASE_URL);

// Create a connection pool to PostgreSQL.
// In development, always use the local DB_* settings.
// In non-development environments, prefer DATABASE_URL for hosted databases.
const pool = shouldUseDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'b2b_platform',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });

// Test the connection on startup (optional but helpful for debugging)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
  } else {
    console.log('Database connected successfully');
  }
});

export default pool;
