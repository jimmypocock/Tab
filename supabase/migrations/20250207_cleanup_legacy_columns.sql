-- Clean up legacy columns to fully support organization architecture

-- Make merchant_id nullable in api_keys since we're using organization_id now
ALTER TABLE public.api_keys
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Make merchant_id nullable in tabs since we're using organization_id now  
ALTER TABLE public.tabs
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Make merchant_id nullable in merchant_processors since we're using organization_id now
ALTER TABLE public.merchant_processors
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Make merchant_id nullable in invoices since we're using organization_id now
ALTER TABLE public.invoices
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Make merchant_id nullable in project_milestones since we're using organization_id now
ALTER TABLE public.project_milestones
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Make merchant_id nullable in retainer_accounts since we're using organization_id now
ALTER TABLE public.retainer_accounts
  ALTER COLUMN merchant_id DROP NOT NULL;

-- Add NOT NULL constraint to organization columns where appropriate
-- (After ensuring all data has been migrated)

-- For new records, organization_id should be required
ALTER TABLE public.tabs
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.merchant_processors
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.invoices
  ALTER COLUMN organization_id SET NOT NULL;

-- Update default for tabs to use organization_id
ALTER TABLE public.tabs 
  ALTER COLUMN organization_id SET DEFAULT NULL,
  ALTER COLUMN organization_id DROP DEFAULT;

-- Add comments to clarify the migration
COMMENT ON COLUMN public.api_keys.merchant_id IS 'DEPRECATED: Use organization_id instead';
COMMENT ON COLUMN public.tabs.merchant_id IS 'DEPRECATED: Use organization_id instead';
COMMENT ON COLUMN public.tabs.corporate_account_id IS 'DEPRECATED: Use paid_by_org_id instead';
COMMENT ON COLUMN public.tabs.corporate_relationship_id IS 'DEPRECATED: Use relationship_id instead';
COMMENT ON COLUMN public.merchant_processors.merchant_id IS 'DEPRECATED: Use organization_id instead';
COMMENT ON COLUMN public.invoices.merchant_id IS 'DEPRECATED: Use organization_id instead';
COMMENT ON COLUMN public.project_milestones.merchant_id IS 'DEPRECATED: Use organization_id instead';
COMMENT ON COLUMN public.retainer_accounts.merchant_id IS 'DEPRECATED: Use organization_id instead';
COMMENT ON COLUMN public.retainer_accounts.customer_id IS 'DEPRECATED: Use customer_org_id instead';