-- Schema Update: Add password_hash column and make cognito_sub nullable
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ALTER COLUMN cognito_sub DROP NOT NULL;
