-- Add support for flexible customer targeting in tabs
-- This migration adds customerOrganizationId and makes customerEmail optional when targeting organizations

BEGIN;

-- Add customer organization targeting support
ALTER TABLE tabs 
ADD COLUMN customer_organization_id UUID REFERENCES organizations(id);

-- Make customerEmail nullable for organization targeting
-- Note: customerEmail is now optional when customerOrganizationId is present
ALTER TABLE tabs 
ALTER COLUMN customer_email DROP NOT NULL;

-- Add constraint to ensure either individual or organization customer is specified
ALTER TABLE tabs
ADD CONSTRAINT check_customer_targeting 
CHECK (
  (customer_email IS NOT NULL AND customer_organization_id IS NULL) OR  -- Individual customer
  (customer_organization_id IS NOT NULL)  -- Organization customer (email optional)
);

-- Add index for organization customer lookups
CREATE INDEX idx_tabs_customer_organization ON tabs(customer_organization_id) WHERE customer_organization_id IS NOT NULL;

-- Add comment explaining the new flexible customer targeting
COMMENT ON COLUMN tabs.customer_email IS 'Required for individual customers. Optional override for organization customers (uses org billing email if not provided).';
COMMENT ON COLUMN tabs.customer_organization_id IS 'UUID of target organization for B2B invoicing. Null for individual customers.';

-- Update RLS policies to handle organization customers
-- The existing organization-based RLS should already cover this, but we'll ensure proper access

COMMIT;