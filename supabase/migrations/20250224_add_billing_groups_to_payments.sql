-- Add billing group support to payments table
-- This enables payments to be made for specific billing groups within a tab

-- Add billing_group_id column to payments table
ALTER TABLE payments 
  ADD COLUMN billing_group_id UUID REFERENCES billing_groups(id);

-- Add index for billing group payments
CREATE INDEX IF NOT EXISTS idx_payments_billing_group ON payments(billing_group_id) 
  WHERE billing_group_id IS NOT NULL;

-- Add compound index for tab and billing group queries
CREATE INDEX IF NOT EXISTS idx_payments_tab_billing_group ON payments(tab_id, billing_group_id);

-- Add a constraint to ensure billing group belongs to the same tab
ALTER TABLE payments 
  ADD CONSTRAINT payments_billing_group_tab_check 
  CHECK (
    billing_group_id IS NULL OR
    EXISTS (
      SELECT 1 FROM billing_groups bg 
      WHERE bg.id = billing_group_id 
      AND bg.tab_id = payments.tab_id
    )
  );

-- Update the payments table relations to include billing groups
-- This is handled in the schema file, but we add a comment for documentation
COMMENT ON COLUMN payments.billing_group_id IS 
'Optional reference to billing group for group-specific payments. If null, payment applies to entire tab.';

-- Create a function to calculate billing group balance
CREATE OR REPLACE FUNCTION calculate_billing_group_balance(group_id UUID)
RETURNS TABLE (
  total_amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  balance DECIMAL(10,2),
  deposit_available DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(li.total), 0) as total_amount,
    COALESCE((
      SELECT SUM(p.amount) 
      FROM payments p 
      WHERE p.billing_group_id = group_id 
      AND p.status = 'succeeded'
    ), 0) as paid_amount,
    COALESCE(SUM(li.total), 0) - COALESCE((
      SELECT SUM(p.amount) 
      FROM payments p 
      WHERE p.billing_group_id = group_id 
      AND p.status = 'succeeded'
    ), 0) as balance,
    COALESCE((
      SELECT bg.deposit_amount - bg.deposit_applied 
      FROM billing_groups bg 
      WHERE bg.id = group_id
    ), 0) as deposit_available
  FROM line_items li
  WHERE li.billing_group_id = group_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get tab payment summary including billing groups
CREATE OR REPLACE FUNCTION get_tab_payment_summary(p_tab_id UUID)
RETURNS TABLE (
  tab_total DECIMAL(10,2),
  tab_paid DECIMAL(10,2),
  tab_balance DECIMAL(10,2),
  unassigned_total DECIMAL(10,2),
  unassigned_paid DECIMAL(10,2),
  billing_groups JSONB
) AS $$
DECLARE
  tab_total_amount DECIMAL(10,2);
  tab_paid_amount DECIMAL(10,2);
  unassigned_total_amount DECIMAL(10,2);
  unassigned_paid_amount DECIMAL(10,2);
  groups_summary JSONB;
BEGIN
  -- Get tab totals
  SELECT t.total_amount, t.paid_amount 
  INTO tab_total_amount, tab_paid_amount
  FROM tabs t 
  WHERE t.id = p_tab_id;

  -- Get unassigned line items total
  SELECT COALESCE(SUM(li.total), 0)
  INTO unassigned_total_amount
  FROM line_items li
  WHERE li.tab_id = p_tab_id 
  AND li.billing_group_id IS NULL;

  -- Get unassigned payments total
  SELECT COALESCE(SUM(p.amount), 0)
  INTO unassigned_paid_amount
  FROM payments p
  WHERE p.tab_id = p_tab_id 
  AND p.billing_group_id IS NULL
  AND p.status = 'succeeded';

  -- Get billing groups summary
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', bg.id,
      'name', bg.name,
      'type', bg.group_type,
      'total', group_balance.total_amount,
      'paid', group_balance.paid_amount,
      'balance', group_balance.balance,
      'deposit_available', group_balance.deposit_available
    )
  ), '[]'::jsonb)
  INTO groups_summary
  FROM billing_groups bg
  CROSS JOIN LATERAL calculate_billing_group_balance(bg.id) AS group_balance
  WHERE bg.tab_id = p_tab_id;

  RETURN QUERY
  SELECT 
    tab_total_amount,
    tab_paid_amount,
    tab_total_amount - tab_paid_amount,
    unassigned_total_amount,
    unassigned_paid_amount,
    groups_summary;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update tab totals when billing group payments are made
CREATE OR REPLACE FUNCTION update_tab_totals_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if payment succeeded
  IF NEW.status = 'succeeded' AND (OLD.status IS NULL OR OLD.status != 'succeeded') THEN
    -- Update tab paid amount
    UPDATE tabs 
    SET 
      paid_amount = paid_amount + NEW.amount,
      updated_at = NOW()
    WHERE id = NEW.tab_id;
    
    -- If payment was for a billing group, update billing group balance
    IF NEW.billing_group_id IS NOT NULL THEN
      UPDATE billing_groups
      SET 
        current_balance = current_balance + NEW.amount,
        updated_at = NOW()
      WHERE id = NEW.billing_group_id;
    END IF;
  END IF;

  -- Handle payment failure or refund
  IF NEW.status IN ('failed', 'cancelled', 'refunded') AND OLD.status = 'succeeded' THEN
    -- Reverse the payment
    UPDATE tabs 
    SET 
      paid_amount = paid_amount - NEW.amount,
      updated_at = NOW()
    WHERE id = NEW.tab_id;
    
    -- If payment was for a billing group, reverse billing group balance
    IF NEW.billing_group_id IS NOT NULL THEN
      UPDATE billing_groups
      SET 
        current_balance = current_balance - NEW.amount,
        updated_at = NOW()
      WHERE id = NEW.billing_group_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic balance updates
DROP TRIGGER IF EXISTS payments_update_balances ON payments;
CREATE TRIGGER payments_update_balances
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_totals_on_payment();

-- Add RLS policies for billing group payments
-- Payments can be viewed if user has access to the tab or billing group
CREATE POLICY "Organizations can view billing group payments" ON payments
  FOR SELECT USING (
    -- Can view if tab belongs to organization
    tab_id IN (
      SELECT id FROM tabs WHERE organization_id = auth.uid()
    )
    OR
    -- Can view if billing group's payer organization matches
    billing_group_id IN (
      SELECT bg.id FROM billing_groups bg
      WHERE bg.payer_organization_id = auth.uid()
    )
  );

-- Update existing payment policies if they exist
DROP POLICY IF EXISTS "Users can view their payments" ON payments;
DROP POLICY IF EXISTS "Users can create payments" ON payments;

CREATE POLICY "Organizations can create billing group payments" ON payments
  FOR INSERT WITH CHECK (
    -- Can create payments for own tabs
    tab_id IN (
      SELECT id FROM tabs WHERE organization_id = auth.uid()
    )
    OR
    -- Can create payments if billing group allows it
    (billing_group_id IS NOT NULL AND billing_group_id IN (
      SELECT bg.id FROM billing_groups bg
      JOIN tabs t ON bg.tab_id = t.id
      WHERE t.organization_id = auth.uid()
    ))
  );

-- Add documentation
COMMENT ON FUNCTION calculate_billing_group_balance(UUID) IS 
'Calculates the total, paid, and remaining balance for a specific billing group, including available deposit amounts';

COMMENT ON FUNCTION get_tab_payment_summary(UUID) IS 
'Returns comprehensive payment summary for a tab including billing groups breakdown';

COMMENT ON FUNCTION update_tab_totals_on_payment() IS 
'Trigger function that automatically updates tab and billing group balances when payments succeed or fail';