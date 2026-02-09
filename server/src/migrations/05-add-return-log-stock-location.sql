-- Add stock location for return logs (used when stock is adjusted)
ALTER TABLE return_logs
ADD COLUMN IF NOT EXISTS stock_location VARCHAR(20);
