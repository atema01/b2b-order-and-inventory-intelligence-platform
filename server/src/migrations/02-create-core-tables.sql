-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2),
  image TEXT,
  reorder_point INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Low', 'Empty', 'Discontinued')),
  supplier_name VARCHAR(255),
  supplier_phone VARCHAR(50),
  -- Stock levels (denormalized for simplicity)
  stock_main_warehouse INTEGER DEFAULT 0,
  stock_back_room INTEGER DEFAULT 0,
  stock_show_room INTEGER DEFAULT 0
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  tax NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'Unpaid',
  stock_deducted BOOLEAN DEFAULT false,
  created_by VARCHAR(20) DEFAULT 'seller',
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_order NUMERIC(12,2) NOT NULL,
  picked BOOLEAN DEFAULT false
);

-- Insert initial data (from your fake DB)
INSERT INTO categories (id, name) VALUES 
  ('CAT-1', 'Lips'),
  ('CAT-2', 'Face'),
  ('CAT-3', 'Eyes'),
  ('CAT-4', 'Skincare')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, sku, category, brand, description, price, cost_price, image, reorder_point, status, stock_main_warehouse, stock_back_room, stock_show_room) VALUES
  ('P1', 'Velvet Matte Lipstick', 'LP-00124', 'Lips', 'GLOW COSMETICS', 'A rich, highly pigmented crimson red lipstick...', 1250, 900, 'https://images.unsplash.com/.../photo-1586776977607-310e9c725c37...', 100, 'In Stock', 320, 45, 12),
  ('P2', 'HD Radiance Foundation', 'FD-88210', 'Face', 'DERMACARE', 'Breathable, medium-coverage foundation...', 2400, 1800, 'https://images.unsplash.com/.../photo-1631730486784-5456119f69ae...', 50, 'In Stock', 100, 8, 2),
  ('P3', 'Midnight Recovery Serum', 'SR-99210', 'Skincare', 'LUMIERE', 'Nighttime repair serum...', 3100, 2200, 'https://images.unsplash.com/.../photo-1620916566398-39f1143ab7be...', 20, 'In Stock', 50, 10, 5)
ON CONFLICT (id) DO NOTHING;

-- Insert sample order (linking to your admin user)
INSERT INTO orders (id, buyer_id, date, status, subtotal, tax, total, amount_paid, payment_status, created_by)
SELECT
  'ORD-2094',
  u.id,
  '2023-10-24',
  'Shipped',
  42500,
  0,
  42500,
  0,
  'Unpaid',
  'seller'
FROM users u
WHERE u.email = 'admin@maraki.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (order_id, product_id, quantity, price_at_order)
SELECT 'ORD-2094', 'P1', 14, 1250
WHERE EXISTS (SELECT 1 FROM orders WHERE id = 'ORD-2094')
ON CONFLICT DO NOTHING;
