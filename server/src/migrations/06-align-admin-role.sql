-- Bootstrap RBAC schema expected by the current backend.

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  access_level VARCHAR(50) NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(50) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role_id VARCHAR(50);

INSERT INTO permissions (id, name) VALUES
  ('PERM-ORDERS', 'Orders'),
  ('PERM-PRODUCTS', 'Products'),
  ('PERM-RETURNS', 'Returns'),
  ('PERM-BUYERS', 'Buyers'),
  ('PERM-PAYMENTS', 'Payments'),
  ('PERM-CREDITS', 'Credits'),
  ('PERM-PRICING', 'Pricing'),
  ('PERM-STAFF', 'Staff'),
  ('PERM-ROLES', 'Roles'),
  ('PERM-REPORTS', 'Reports'),
  ('PERM-LOGS', 'Logs'),
  ('PERM-SETTINGS', 'Settings')
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, name, description, access_level) VALUES
  ('R-ADMIN', 'Admin', 'System administrator with full access.', 'Owner'),
  ('R-STAFF', 'Staff', 'Default operational staff role.', 'Staff'),
  ('R-BUYER', 'Buyer', 'Wholesale buyer account role.', 'Staff')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'R-ADMIN', p.id
FROM permissions p
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'R-STAFF', p.id
FROM permissions p
WHERE p.name IN ('Orders', 'Products', 'Returns', 'Buyers', 'Payments', 'Credits', 'Reports')
ON CONFLICT DO NOTHING;

UPDATE users
SET role_id = CASE LOWER(role)
  WHEN 'admin' THEN 'R-ADMIN'
  WHEN 'buyer' THEN 'R-BUYER'
  ELSE 'R-STAFF'
END
WHERE role_id IS NULL;

-- Align admin user with Admin role if present.
UPDATE users
SET role_id = 'R-ADMIN'
WHERE email = 'admin@maraki.com';
