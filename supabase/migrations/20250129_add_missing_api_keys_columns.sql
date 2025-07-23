-- Add missing columns to api_keys table
-- These columns are defined in the schema but missing from the database

-- Add is_active column
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add key_prefix column (first 8 chars for identification)
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS key_prefix text;

-- Update existing records to have a key_prefix based on their key_hash
-- (Using first 8 chars of key_hash as a fallback)
UPDATE api_keys 
SET key_prefix = SUBSTRING(key_hash, 1, 8)
WHERE key_prefix IS NULL;

-- Make key_prefix NOT NULL after populating it
ALTER TABLE api_keys 
ALTER COLUMN key_prefix SET NOT NULL;

-- Also make name nullable to match the schema
ALTER TABLE api_keys 
ALTER COLUMN name DROP NOT NULL;