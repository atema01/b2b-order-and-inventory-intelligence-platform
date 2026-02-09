-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(100) NOT NULL,
  reference_id VARCHAR(100),
  date_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  proof_image TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending Review',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_buyer ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
