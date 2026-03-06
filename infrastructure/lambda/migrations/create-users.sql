-- Create organizations for users
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES 
  ('8d4cab88-ab01-41e0-a59c-b93aeabfdbe6', 'Platform Administration', NOW(), NOW()),
  ('c3c1336a-ebb8-4536-8396-2ac24bda3c1e', 'Test Organization', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create super admin user
-- Email: admin@prance.com
-- Password: Admin2026!Prance
INSERT INTO users (id, email, name, password_hash, cognito_sub, role, org_id, created_at)
VALUES (
  'd40e4a34-c04f-48b5-9985-9b4863fb7b19',
  'admin@prance.com',
  'Platform Administrator',
  '$2b$10$GUCdUBUcf3q1pGUa7lqrVe.5r/x7nP5vgF8xQiXXvRPmqxJ1iZPYS',
  'super-admin-1709732401000',
  'SUPER_ADMIN',
  '8d4cab88-ab01-41e0-a59c-b93aeabfdbe6',
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Create test user
-- Email: test@example.com
-- Password: Test2026!
INSERT INTO users (id, email, name, password_hash, cognito_sub, role, org_id, created_at)
VALUES (
  '4df59eb9-061c-4bff-92dc-f0a018706142',
  'test@example.com',
  'Test User',
  '$2b$10$qY/H6hKqys534kbJq1Qd0OYl2o4hMYxLqU2.W8n3iNm5vFwW0pBmW',
  'test-user-1709732401000',
  'CLIENT_ADMIN',
  'c3c1336a-ebb8-4536-8396-2ac24bda3c1e',
  NOW()
)
ON CONFLICT (email) DO NOTHING;
