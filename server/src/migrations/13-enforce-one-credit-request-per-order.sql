CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_requests_one_per_order
ON credit_requests(order_id)
WHERE order_id IS NOT NULL;
