import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const buildLocalPool = () =>
  new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'b2b_platform',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

const buildSupabasePool = () => {
  if (!process.env.DATABASE_URL) return null;
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  });
};

export const localPool = buildLocalPool();
export const supabasePool = buildSupabasePool();

const primaryPool = isDevelopment || !supabasePool ? localPool : supabasePool;

export const getMirrorPools = (): Pool[] => {
  const mirrors: Pool[] = [];
  if (primaryPool !== localPool) {
    mirrors.push(localPool);
  }
  if (supabasePool && primaryPool !== supabasePool) {
    mirrors.push(supabasePool);
  }
  return mirrors;
};

primaryPool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
  } else {
    console.log('Database connected successfully');
  }
});

export default primaryPool;
