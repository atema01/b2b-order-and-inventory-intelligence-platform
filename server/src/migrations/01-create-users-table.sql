-- server/src/migrations/01-create-users-table.sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'buyer')),
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  
  -- Shared fields
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Buyer-specific (nullable for non-buyers)
  company_name VARCHAR(255),
  address TEXT,
  available_credit NUMERIC(12,2) DEFAULT 0,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  payment_terms VARCHAR(100),
  tier VARCHAR(50) DEFAULT 'Bronze',
  discount_rate NUMERIC(5,2) DEFAULT 0,
  join_date DATE DEFAULT CURRENT_DATE,
  
  -- Staff/Admin-specific
  permissions JSONB, -- e.g., { "manage_products": true, "view_finances": false }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
