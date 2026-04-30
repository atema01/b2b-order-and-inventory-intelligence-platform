CREATE TABLE IF NOT EXISTS product_batches (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number VARCHAR(120) NOT NULL,
  manufacture_date DATE,
  expiry_date DATE,
  stock_location VARCHAR(20) NOT NULL CHECK (stock_location IN ('mainWarehouse', 'backRoom', 'showRoom')),
  quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_product_id
  ON product_batches(product_id);

CREATE INDEX IF NOT EXISTS idx_product_batches_product_expiry
  ON product_batches(product_id, expiry_date, created_at);

CREATE TABLE IF NOT EXISTS order_batch_allocations (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_batch_allocations_order_product
  ON order_batch_allocations(order_id, product_id);

INSERT INTO product_batches (
  product_id,
  batch_number,
  manufacture_date,
  expiry_date,
  stock_location,
  quantity_available
)
SELECT
  p.id,
  'LEGACY-' || p.id,
  NULL,
  NULL,
  'mainWarehouse',
  COALESCE(p.stock_main_warehouse, 0)
FROM products p
WHERE COALESCE(p.stock_main_warehouse, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM product_batches pb
    WHERE pb.product_id = p.id
      AND pb.stock_location = 'mainWarehouse'
  );

INSERT INTO product_batches (
  product_id,
  batch_number,
  manufacture_date,
  expiry_date,
  stock_location,
  quantity_available
)
SELECT
  p.id,
  'LEGACY-' || p.id,
  NULL,
  NULL,
  'backRoom',
  COALESCE(p.stock_back_room, 0)
FROM products p
WHERE COALESCE(p.stock_back_room, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM product_batches pb
    WHERE pb.product_id = p.id
      AND pb.stock_location = 'backRoom'
  );

INSERT INTO product_batches (
  product_id,
  batch_number,
  manufacture_date,
  expiry_date,
  stock_location,
  quantity_available
)
SELECT
  p.id,
  'LEGACY-' || p.id,
  NULL,
  NULL,
  'showRoom',
  COALESCE(p.stock_show_room, 0)
FROM products p
WHERE COALESCE(p.stock_show_room, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM product_batches pb
    WHERE pb.product_id = p.id
      AND pb.stock_location = 'showRoom'
  );
