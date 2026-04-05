CREATE TABLE IF NOT EXISTS credit_repayments (
  id VARCHAR(50) PRIMARY KEY,
  credit_request_id VARCHAR(50) NOT NULL REFERENCES credit_requests(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  reference_id VARCHAR(100),
  proof_image TEXT,
  repaid_at DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_repayments_credit_request
ON credit_repayments(credit_request_id, repaid_at DESC, created_at DESC);
