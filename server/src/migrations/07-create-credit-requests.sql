-- Create credit_requests table
CREATE TABLE IF NOT EXISTS credit_requests (
  id VARCHAR(50) PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users(id),
  order_id VARCHAR(50) REFERENCES orders(id),
  amount NUMERIC(12,2) NOT NULL,
  approved_amount NUMERIC(12,2),
  reason VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  action_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_buyer ON credit_requests(buyer_id);
