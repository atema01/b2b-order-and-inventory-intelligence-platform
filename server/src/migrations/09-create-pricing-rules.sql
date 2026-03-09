-- Create pricing rules tables (tiers and bulk discounts)
CREATE TABLE IF NOT EXISTS pricing_rules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_years INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_name ON pricing_rules(name);

CREATE TABLE IF NOT EXISTS bulk_discount_rules (
  id VARCHAR(50) PRIMARY KEY,
  unit_threshold INT NOT NULL,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
