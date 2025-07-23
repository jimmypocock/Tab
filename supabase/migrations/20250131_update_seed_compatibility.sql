-- Update seed data to be compatible with new schema
-- This ensures the seed.sql file will work with our updated schema

-- Update api_keys to include new required columns
UPDATE api_keys 
SET 
  key_prefix = SUBSTRING(key_hash, 1, 8),
  is_active = true
WHERE key_prefix IS NULL;

-- Update tabs to include new columns with proper values
UPDATE tabs 
SET 
  subtotal = total_amount,
  tax_amount = 0,
  external_reference = NULL,
  metadata = NULL
WHERE subtotal IS NULL;

-- Recalculate total_amount to be subtotal + tax_amount
UPDATE tabs 
SET total_amount = subtotal + tax_amount;