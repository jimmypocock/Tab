-- Add metadata column to merchant_processors for storing webhook IDs and other configuration
ALTER TABLE merchant_processors 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;