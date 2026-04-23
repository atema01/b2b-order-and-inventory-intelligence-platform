const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const migrationsDir = path.resolve(__dirname, '../src/migrations');

const buildClientConfig = () => {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const isProduction = process.env.NODE_ENV === 'production';

  if (hasDatabaseUrl) {
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

const getMigrationFiles = () =>
  fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const getAppliedMigrations = async (client) => {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC');
  return new Set(result.rows.map((row) => row.filename));
};

const applyMigration = async (client, file) => {
  const fullPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(fullPath, 'utf8').trim();

  if (!sql) {
    console.log(`Skipping empty migration: ${file}`);
    return;
  }

  console.log(`Applying ${file}...`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration failed for ${file}: ${error.message}`);
  }
};

const run = async () => {
  const client = new Client(buildClientConfig());

  try {
    await client.connect();
    console.log('Connected to database');

    await ensureMigrationTable(client);

    const migrationFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(client);
    const pendingMigrations = migrationFiles.filter((file) => !appliedMigrations.has(file));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s).`);
    for (const file of pendingMigrations) {
      await applyMigration(client, file);
    }

    console.log('All pending migrations applied successfully.');
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

run();
