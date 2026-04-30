const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: node scripts/apply-single-migration.js <migration-file.sql>');
  process.exit(1);
}

const migrationPath = path.resolve(__dirname, `../src/migrations/${migrationName}`);
if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');
const isProduction = process.env.NODE_ENV === 'production';

const targets = [
  {
    name: 'local-postgres',
    config: {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'b2b_platform',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    },
  },
];

if (process.env.DATABASE_URL) {
  targets.push({
    name: 'supabase',
    config: {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    },
  });
}

const run = async () => {
  for (const target of targets) {
    const client = new Client(target.config);
    try {
      await client.connect();
      console.log(`Connected to ${target.name}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`Applied ${migrationName} on ${target.name}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      await client.end().catch(() => {});
    }
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
