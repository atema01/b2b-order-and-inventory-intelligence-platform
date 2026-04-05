import pool from '../config/db';

export const ensureFinanceSchema = async () => {
  await pool.query(`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS credit_request_id VARCHAR(50) REFERENCES credit_requests(id) ON DELETE SET NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_credit_request
    ON payments(credit_request_id, date_time DESC)
  `);
};
