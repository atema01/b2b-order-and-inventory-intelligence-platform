-- Returns & Damages (Return Logs)
CREATE TABLE IF NOT EXISTS return_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(50) NOT NULL REFERENCES products(id),
  order_id VARCHAR(50) REFERENCES orders(id),
  buyer_id UUID REFERENCES users(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('Return', 'Damage')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('Damaged in Transit', 'Expired', 'Faulty Packaging', 'Customer Return', 'Wrong Item')),
  action VARCHAR(30) NOT NULL CHECK (action IN ('Restocked', 'Disposed', 'Returned to Supplier')),
  date DATE NOT NULL,
  note TEXT,
  loss_value NUMERIC(12,2) DEFAULT 0,
  brand VARCHAR(100),
  product_name VARCHAR(255),
  supplier_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    (type = 'Return' AND order_id IS NOT NULL AND buyer_id IS NOT NULL)
    OR (type = 'Damage')
  )
);

CREATE INDEX IF NOT EXISTS idx_return_logs_product_id ON return_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_return_logs_order_id ON return_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_return_logs_buyer_id ON return_logs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_return_logs_date ON return_logs(date);
