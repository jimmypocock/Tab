-- Fix schema mismatches between code and database
-- This migration aligns the database with schema.ts definitions

-- 1. Fix merchants table
ALTER TABLE merchants 
ADD CONSTRAINT merchants_email_unique UNIQUE (email);

-- 2. Fix tabs table
ALTER TABLE tabs 
ADD COLUMN IF NOT EXISTS external_reference text,
ADD COLUMN IF NOT EXISTS subtotal decimal(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount decimal(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata json;

-- Update status CHECK constraint to match schema
ALTER TABLE tabs 
DROP CONSTRAINT IF EXISTS tabs_status_check;

ALTER TABLE tabs 
ADD CONSTRAINT tabs_status_check 
CHECK (status IN ('open', 'partial', 'paid', 'void'));

-- 3. Fix line_items table
ALTER TABLE line_items 
ADD COLUMN IF NOT EXISTS metadata json;

-- 4. Fix payments table
-- Update status CHECK constraint to include all statuses
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'));

-- Make processor_payment_id nullable to match schema
ALTER TABLE payments 
ALTER COLUMN processor_payment_id DROP NOT NULL;

-- Note: We'll keep metadata as jsonb (better than json) - no change needed

-- 5. Fix invoices table - most columns are missing
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS amount_due decimal(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS due_date timestamp NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS paid_at timestamp,
ADD COLUMN IF NOT EXISTS public_url text,
ADD COLUMN IF NOT EXISTS metadata json;

-- Add UNIQUE constraint on invoice_number
ALTER TABLE invoices 
ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);

-- Add CHECK constraint for invoice status
ALTER TABLE invoices
ADD CONSTRAINT invoices_status_check
CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue'));

-- 6. merchant_processors table - no changes needed
-- The existing structure is fine, jsonb is better than json

-- 7. Add any missing indexes that weren't created
CREATE INDEX IF NOT EXISTS idx_tabs_external_reference ON tabs(external_reference);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 8. Update tabs to recalculate total_amount based on subtotal + tax_amount
UPDATE tabs 
SET total_amount = subtotal + tax_amount 
WHERE subtotal IS NOT NULL AND tax_amount IS NOT NULL;