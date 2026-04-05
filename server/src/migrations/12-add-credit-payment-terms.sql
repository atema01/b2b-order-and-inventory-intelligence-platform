ALTER TABLE credit_requests
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);
