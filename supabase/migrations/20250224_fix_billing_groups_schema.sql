-- Fix billing groups schema inconsistencies
-- This migration ensures the database schema matches our TypeScript types exactly

-- First, let's fix the billing groups table structure
ALTER TABLE billing_groups 
  -- Make invoiceId optional to support tab-level billing groups
  ALTER COLUMN invoice_id DROP NOT NULL;

-- Remove the unique constraint on invoice_id since multiple billing groups can belong to one invoice
ALTER TABLE billing_groups DROP CONSTRAINT IF EXISTS billing_groups_invoice_id_key;

-- Update the group type constraints to match our TypeScript enum
ALTER TABLE billing_groups 
  DROP CONSTRAINT IF EXISTS billing_groups_type_check;

ALTER TABLE billing_groups 
  ADD CONSTRAINT billing_groups_group_type_check 
  CHECK (group_type IN ('standard', 'corporate', 'deposit', 'credit'));

-- Ensure required fields are properly set
ALTER TABLE billing_groups 
  ALTER COLUMN current_balance SET DEFAULT '0.00';

-- Add missing indexes for better performance on tab-level operations
CREATE INDEX IF NOT EXISTS idx_billing_groups_tab_type ON billing_groups(tab_id, group_type) 
  WHERE tab_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_groups_payer_email ON billing_groups(payer_email) 
  WHERE payer_email IS NOT NULL;

-- Update the action constraint in billing_group_rules to match our TypeScript enum
ALTER TABLE billing_group_rules 
  DROP CONSTRAINT IF EXISTS billing_group_rules_action_check;

ALTER TABLE billing_group_rules 
  ADD CONSTRAINT billing_group_rules_action_check 
  CHECK (action IN ('auto_assign', 'require_approval', 'notify', 'reject'));

-- Add a constraint to ensure either invoiceId or tabId is set (but not both for simplicity)
ALTER TABLE billing_groups 
  ADD CONSTRAINT billing_groups_parent_check 
  CHECK (
    (invoice_id IS NOT NULL AND tab_id IS NULL) OR 
    (invoice_id IS NULL AND tab_id IS NOT NULL)
  );

-- Update RLS policies to work with both invoice and tab-level billing groups
DROP POLICY IF EXISTS "Organizations can view their billing groups" ON billing_groups;
DROP POLICY IF EXISTS "Organizations can create billing groups" ON billing_groups;
DROP POLICY IF EXISTS "Organizations can update their billing groups" ON billing_groups;

-- New RLS policies for billing groups that work with both tabs and invoices
CREATE POLICY "Organizations can view their billing groups" ON billing_groups
  FOR SELECT USING (
    -- Invoice-level billing groups
    (invoice_id IS NOT NULL AND invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = auth.uid()
    ))
    OR
    -- Tab-level billing groups
    (tab_id IS NOT NULL AND tab_id IN (
      SELECT id FROM tabs WHERE organization_id = auth.uid()
    ))
    OR
    -- Payer organization can view their billing groups
    payer_organization_id = auth.uid()
  );

CREATE POLICY "Organizations can create billing groups" ON billing_groups
  FOR INSERT WITH CHECK (
    -- Can create on own invoices
    (invoice_id IS NOT NULL AND invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = auth.uid()
    ))
    OR
    -- Can create on own tabs
    (tab_id IS NOT NULL AND tab_id IN (
      SELECT id FROM tabs WHERE organization_id = auth.uid()
    ))
  );

CREATE POLICY "Organizations can update their billing groups" ON billing_groups
  FOR UPDATE USING (
    -- Can update own invoice billing groups
    (invoice_id IS NOT NULL AND invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = auth.uid()
    ))
    OR
    -- Can update own tab billing groups
    (tab_id IS NOT NULL AND tab_id IN (
      SELECT id FROM tabs WHERE organization_id = auth.uid()
    ))
  );

-- Fix the billing group rules policies to work with tab-level groups
DROP POLICY IF EXISTS "Organizations can manage billing group rules" ON billing_group_rules;

CREATE POLICY "Organizations can manage billing group rules" ON billing_group_rules
  FOR ALL USING (
    billing_group_id IN (
      SELECT bg.id FROM billing_groups bg
      WHERE 
        -- Invoice-level groups
        (bg.invoice_id IS NOT NULL AND bg.invoice_id IN (
          SELECT id FROM invoices WHERE organization_id = auth.uid()
        ))
        OR
        -- Tab-level groups
        (bg.tab_id IS NOT NULL AND bg.tab_id IN (
          SELECT id FROM tabs WHERE organization_id = auth.uid()
        ))
    )
  );

-- Fix the billing group overrides policies
DROP POLICY IF EXISTS "Organizations can view overrides" ON billing_group_overrides;
DROP POLICY IF EXISTS "Organizations can create overrides" ON billing_group_overrides;

CREATE POLICY "Organizations can view overrides" ON billing_group_overrides
  FOR SELECT USING (
    line_item_id IN (
      SELECT li.id FROM line_items li
      JOIN tabs t ON li.tab_id = t.id
      WHERE t.organization_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can create overrides" ON billing_group_overrides
  FOR INSERT WITH CHECK (
    line_item_id IN (
      SELECT li.id FROM line_items li
      JOIN tabs t ON li.tab_id = t.id
      WHERE t.organization_id = auth.uid()
    )
  );

-- Create a function to automatically generate group numbers
CREATE OR REPLACE FUNCTION generate_billing_group_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number TEXT;
  parent_id UUID;
BEGIN
  -- Determine the parent context (invoice or tab)
  IF NEW.invoice_id IS NOT NULL THEN
    parent_id := NEW.invoice_id;
  ELSE
    parent_id := NEW.tab_id;
  END IF;

  -- Generate next group number for this parent
  SELECT COALESCE(MAX(CAST(group_number AS INTEGER)), 0) + 1
  INTO next_number
  FROM billing_groups 
  WHERE (invoice_id = NEW.invoice_id OR tab_id = NEW.tab_id);

  -- Set the group number if not already provided
  IF NEW.group_number IS NULL OR NEW.group_number = '' THEN
    NEW.group_number := next_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating group numbers
DROP TRIGGER IF EXISTS billing_groups_generate_number ON billing_groups;
CREATE TRIGGER billing_groups_generate_number
  BEFORE INSERT ON billing_groups
  FOR EACH ROW
  EXECUTE FUNCTION generate_billing_group_number();

-- Add indexes for the new constraint structure
CREATE INDEX IF NOT EXISTS idx_billing_groups_invoice_context ON billing_groups(invoice_id) 
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_groups_tab_context ON billing_groups(tab_id) 
  WHERE tab_id IS NOT NULL;

-- Ensure the line_items billing_group_id reference works properly
-- (This should already exist from the previous migration, but let's make sure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'line_items' AND column_name = 'billing_group_id'
  ) THEN
    ALTER TABLE line_items 
      ADD COLUMN billing_group_id UUID REFERENCES billing_groups(id);
    
    CREATE INDEX idx_line_items_billing_group ON line_items(billing_group_id);
  END IF;
END $$;

-- Add some sample data validation
-- Create a function to validate billing group data
CREATE OR REPLACE FUNCTION validate_billing_group_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate group types
  IF NEW.group_type NOT IN ('standard', 'corporate', 'deposit', 'credit') THEN
    RAISE EXCEPTION 'Invalid group_type: %', NEW.group_type;
  END IF;

  -- Validate credit limit for credit groups
  IF NEW.group_type = 'credit' AND (NEW.credit_limit IS NULL OR NEW.credit_limit <= 0) THEN
    RAISE EXCEPTION 'Credit groups must have a positive credit_limit';
  END IF;

  -- Validate deposit amount for deposit groups
  IF NEW.group_type = 'deposit' AND (NEW.deposit_amount IS NULL OR NEW.deposit_amount <= 0) THEN
    RAISE EXCEPTION 'Deposit groups must have a positive deposit_amount';
  END IF;

  -- Validate organization for corporate groups
  IF NEW.group_type = 'corporate' AND NEW.payer_organization_id IS NULL THEN
    RAISE EXCEPTION 'Corporate groups must have a payer_organization_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create validation trigger
DROP TRIGGER IF EXISTS billing_groups_validate_data ON billing_groups;
CREATE TRIGGER billing_groups_validate_data
  BEFORE INSERT OR UPDATE ON billing_groups
  FOR EACH ROW
  EXECUTE FUNCTION validate_billing_group_data();

-- Update table comments for documentation
COMMENT ON TABLE billing_groups IS 
'Billing groups for splitting charges across multiple payers. Can be associated with either tabs (for immediate splitting) or invoices (for invoice-level splitting)';

COMMENT ON COLUMN billing_groups.group_type IS 
'Type of billing group: standard (default), corporate (organization payer), deposit (prepaid), credit (credit limit)';

COMMENT ON COLUMN billing_groups.invoice_id IS 
'Reference to invoice for invoice-level billing groups (mutually exclusive with tab_id)';

COMMENT ON COLUMN billing_groups.tab_id IS 
'Reference to tab for tab-level billing groups (mutually exclusive with invoice_id)';

COMMENT ON TABLE billing_group_rules IS 
'Automation rules for automatically assigning line items to billing groups based on conditions';

COMMENT ON TABLE billing_group_overrides IS 
'Audit trail for manual overrides of automatic billing group assignments';

-- Add metadata for tracking migration version
INSERT INTO billing_groups (
  id, 
  invoice_id, 
  group_number, 
  name, 
  group_type, 
  status, 
  metadata, 
  created_at
) VALUES (
  'migration-marker-' || uuid_generate_v4()::text,
  (SELECT id FROM invoices LIMIT 1), -- Just for the constraint
  '0',
  'Migration Marker - Safe to Delete',
  'standard',
  'closed',
  jsonb_build_object(
    'migration_version', '20250224_fix_billing_groups_schema',
    'migration_date', NOW(),
    'description', 'Schema consistency fix migration marker'
  ),
  NOW()
) ON CONFLICT DO NOTHING;