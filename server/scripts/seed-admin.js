const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SALT_ROUNDS = 12;

const buildClientConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldUseDatabaseUrl = !isDevelopment && Boolean(process.env.DATABASE_URL);

  if (shouldUseDatabaseUrl) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false
    };
  }

  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'b2b_platform',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10)
  };
};

const getConfig = () => {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'System Admin';
  const phone = process.env.ADMIN_PHONE?.trim() || null;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env or the current shell.');
  }

  return { email, password, name, phone };
};

const ensureAdminRole = async (client) => {
  await client.query(
    `INSERT INTO roles (id, name, description, access_level)
     VALUES ('R-ADMIN', 'Admin', 'System administrator with full access.', 'Owner')
     ON CONFLICT (id) DO NOTHING`
  );
};

const upsertAdminUser = async (client, { email, password, name, phone }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await client.query(
    `INSERT INTO users (email, password_hash, name, phone, role_id, status)
     VALUES ($1, $2, $3, $4, 'R-ADMIN', 'Active')
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       role_id = 'R-ADMIN',
       status = 'Active',
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, email, name, role_id`,
    [email, passwordHash, name, phone]
  );

  return result.rows[0];
};

const run = async () => {
  const client = new Client(buildClientConfig());

  try {
    const config = getConfig();
    await client.connect();
    console.log('Connected to database');

    await client.query('BEGIN');
    await ensureAdminRole(client);
    const user = await upsertAdminUser(client, config);
    await client.query('COMMIT');

    console.log(`Admin user is ready: ${user.email} (${user.role_id})`);
    console.log('You can now log in with the seeded admin credentials.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

run();
