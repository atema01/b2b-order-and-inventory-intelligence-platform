-- Align admin user with Admin role if present
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE r.name = 'Admin'
  AND u.email = 'admin@maraki.com';
