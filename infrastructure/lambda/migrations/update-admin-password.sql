-- Update admin password hash
-- Email: admin@prance.com
-- Password: Admin2026!Prance
UPDATE users
SET password_hash = '$2b$10$2hz6MNbWV2h7H.DyzFR5yemwkt79oG6Fn/vObCk8/jK874.40M90q'
WHERE email = 'admin@prance.com';

-- Verify update
SELECT email, role, LEFT(password_hash, 20) as hash_prefix, LENGTH(password_hash) as hash_length
FROM users
WHERE email = 'admin@prance.com';
