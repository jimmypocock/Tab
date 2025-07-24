-- Transform hotel_folios into generalized billing_groups
-- This migration generalizes the hotel-specific folios concept into a flexible billing groups system

-- First, rename the table and update column names to be more generic
ALTER TABLE hotel_folios RENAME TO billing_groups;

-- Update column names for generalization
ALTER TABLE billing_groups 
  RENAME COLUMN folio_number TO group_number;

ALTER TABLE billing_groups 
  RENAME COLUMN folio_type TO group_type;

ALTER TABLE billing_groups 
  RENAME COLUMN parent_folio_id TO parent_group_id;

-- Drop hotel-specific columns temporarily (we'll add them to metadata)
ALTER TABLE billing_groups 
  ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES tabs(id),
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS payer_organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS payer_email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update the group_type check constraint to support more types
ALTER TABLE billing_groups 
  DROP CONSTRAINT IF EXISTS hotel_folios_folio_type_check;

ALTER TABLE billing_groups 
  ADD CONSTRAINT billing_groups_type_check 
  CHECK (group_type IN ('company', 'personal', 'department', 'insurance', 'grant', 'master', 'guest', 'group', 'project', 'split'));

-- Migrate hotel-specific data to metadata
UPDATE billing_groups 
SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{hotel_data}',
    jsonb_build_object(
      'guest_name', guest_name,
      'room_number', room_number,
      'check_in_date', check_in_date,
      'check_out_date', check_out_date
    )
  ),
  name = COALESCE(guest_name, 'Billing Group ' || group_number),
  payer_organization_id = direct_bill_company_id,
  payer_email = CASE 
    WHEN direct_bill_company_id IS NULL AND guest_name IS NOT NULL 
    THEN LOWER(REPLACE(guest_name, ' ', '.')) || '@example.com' -- Placeholder, should be updated
    ELSE NULL
  END,
  status = 'active';

-- Drop the now-redundant hotel-specific columns
ALTER TABLE billing_groups 
  DROP COLUMN IF EXISTS guest_name,
  DROP COLUMN IF EXISTS room_number,
  DROP COLUMN IF EXISTS check_in_date,
  DROP COLUMN IF EXISTS check_out_date,
  DROP COLUMN IF EXISTS direct_bill_company_id;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_groups_organization ON billing_groups(payer_organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_groups_status ON billing_groups(status);
CREATE INDEX IF NOT EXISTS idx_billing_groups_tab ON billing_groups(tab_id) WHERE tab_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_groups_parent ON billing_groups(parent_group_id) WHERE parent_group_id IS NOT NULL;

-- Create billing_group_rules table
CREATE TABLE billing_group_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  billing_group_id UUID REFERENCES billing_groups(id) ON DELETE CASCADE NOT NULL,
  
  -- Rule definition
  name TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  
  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '{}',
  -- Example conditions:
  -- {
  --   "category": ["dining", "bar"],
  --   "amount": { "min": 0, "max": 100 },
  --   "time": { "start": "18:00", "end": "22:00" },
  --   "day_of_week": [1, 2, 3, 4, 5],
  --   "metadata": { "department": "sales" }
  -- }
  
  -- Action to take when conditions match
  action TEXT NOT NULL DEFAULT 'auto_assign',
  -- Possible actions: auto_assign, require_approval, notify, reject
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for rules
CREATE INDEX idx_billing_group_rules_group ON billing_group_rules(billing_group_id);
CREATE INDEX idx_billing_group_rules_active ON billing_group_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_billing_group_rules_priority ON billing_group_rules(priority);

-- Add billing_group_id to line_items table
ALTER TABLE line_items 
  ADD COLUMN IF NOT EXISTS billing_group_id UUID REFERENCES billing_groups(id);

-- Add billing_group_id to invoice_line_items table for invoice-level tracking
ALTER TABLE invoice_line_items 
  ADD COLUMN IF NOT EXISTS billing_group_id UUID REFERENCES billing_groups(id);

-- Create rule override tracking table
CREATE TABLE billing_group_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_item_id UUID REFERENCES line_items(id) ON DELETE CASCADE NOT NULL,
  original_group_id UUID REFERENCES billing_groups(id),
  assigned_group_id UUID REFERENCES billing_groups(id) NOT NULL,
  rule_id UUID REFERENCES billing_group_rules(id),
  reason TEXT,
  overridden_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_billing_overrides_line_item ON billing_group_overrides(line_item_id);
CREATE INDEX idx_billing_overrides_assigned ON billing_group_overrides(assigned_group_id);

-- Update triggers for updated_at
CREATE TRIGGER update_billing_groups_updated_at BEFORE UPDATE ON billing_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_group_rules_updated_at BEFORE UPDATE ON billing_group_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for billing_groups
ALTER TABLE billing_groups ENABLE ROW LEVEL SECURITY;

-- Organizations can manage their own billing groups
CREATE POLICY "Organizations can view their billing groups" ON billing_groups
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = (SELECT auth.uid())
    )
    OR payer_organization_id = (SELECT auth.uid())
  );

CREATE POLICY "Organizations can create billing groups" ON billing_groups
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organizations can update their billing groups" ON billing_groups
  FOR UPDATE USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = (SELECT auth.uid())
    )
  );

-- Add RLS policies for billing_group_rules
ALTER TABLE billing_group_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations can manage billing group rules" ON billing_group_rules
  FOR ALL USING (
    billing_group_id IN (
      SELECT bg.id FROM billing_groups bg
      JOIN invoices i ON bg.invoice_id = i.id
      WHERE i.organization_id = (SELECT auth.uid())
    )
  );

-- Add RLS policies for billing_group_overrides
ALTER TABLE billing_group_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations can view overrides" ON billing_group_overrides
  FOR SELECT USING (
    line_item_id IN (
      SELECT li.id FROM line_items li
      JOIN tabs t ON li.tab_id = t.id
      WHERE t.organization_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organizations can create overrides" ON billing_group_overrides
  FOR INSERT WITH CHECK (
    line_item_id IN (
      SELECT li.id FROM line_items li
      JOIN tabs t ON li.tab_id = t.id
      WHERE t.organization_id = (SELECT auth.uid())
    )
  );

-- Add comment to track migration
COMMENT ON TABLE billing_groups IS 'Generalized billing groups (formerly hotel_folios) for splitting charges across multiple payers';