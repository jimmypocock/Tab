-- Utility Functions and Helpers
-- Common functions used throughout the application

-- ============================================
-- Tab number generation
-- ============================================

CREATE OR REPLACE FUNCTION generate_tab_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_sequence INTEGER;
  v_tab_number TEXT;
BEGIN
  -- Get organization prefix (first 3 letters of name, uppercase)
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
  INTO v_prefix
  FROM organizations
  WHERE id = p_organization_id;
  
  -- If no letters in name, use 'TAB'
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'TAB';
  END IF;
  
  -- Get next sequence number
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(tab_number, '^[A-Z]+-', '') AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM tabs
  WHERE organization_id = p_organization_id
    AND tab_number ~ ('^' || v_prefix || '-[0-9]+$');
  
  -- Generate tab number
  v_tab_number := v_prefix || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_tab_number;
END;
$$;

-- ============================================
-- Invoice number generation
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_sequence INTEGER;
  v_invoice_number TEXT;
BEGIN
  -- Get organization invoice prefix or use default
  SELECT COALESCE(
    billing_groups.invoice_prefix,
    'INV'
  )
  INTO v_prefix
  FROM organizations
  LEFT JOIN billing_groups ON billing_groups.organization_id = organizations.id
  WHERE organizations.id = p_organization_id
  LIMIT 1;
  
  -- Get current year
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(invoice_number, '^[A-Z]+-' || v_year || '-', '') AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM invoices
  WHERE organization_id = p_organization_id
    AND invoice_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');
  
  -- Generate invoice number
  v_invoice_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_invoice_number;
END;
$$;

-- ============================================
-- Tab totals calculation
-- ============================================

CREATE OR REPLACE FUNCTION calculate_tab_totals(p_tab_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_tax_rate DECIMAL(5,2);
  v_tax_amount DECIMAL(10,2);
  v_discount_amount DECIMAL(10,2);
  v_total_amount DECIMAL(10,2);
  v_amount_paid DECIMAL(10,2);
BEGIN
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(amount), 0)
  INTO v_subtotal
  FROM line_items
  WHERE tab_id = p_tab_id;
  
  -- Get tax rate and discount
  SELECT tax_rate, discount_amount
  INTO v_tax_rate, v_discount_amount
  FROM tabs
  WHERE id = p_tab_id;
  
  -- Calculate tax
  v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
  
  -- Calculate total
  v_total_amount := v_subtotal + v_tax_amount - COALESCE(v_discount_amount, 0);
  
  -- Get amount paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_amount_paid
  FROM payments
  WHERE tab_id = p_tab_id
    AND status = 'succeeded';
  
  -- Update tab
  UPDATE tabs
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    amount_paid = v_amount_paid,
    amount_due = v_total_amount - v_amount_paid,
    status = CASE
      WHEN v_amount_paid >= v_total_amount THEN 'paid'
      WHEN v_amount_paid > 0 THEN 'partial'
      WHEN due_date < CURRENT_DATE THEN 'overdue'
      ELSE status
    END
  WHERE id = p_tab_id;
END;
$$;

-- ============================================
-- Billing group totals calculation
-- ============================================

CREATE OR REPLACE FUNCTION calculate_billing_group_totals(p_billing_group_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_amount DECIMAL(10,2);
  v_paid_amount DECIMAL(10,2);
BEGIN
  -- Calculate total from member tabs
  SELECT COALESCE(SUM(t.total_amount), 0)
  INTO v_total_amount
  FROM tabs t
  JOIN billing_group_members bgm ON bgm.tab_id = t.id
  WHERE bgm.billing_group_id = p_billing_group_id;
  
  -- Calculate paid amount
  SELECT COALESCE(SUM(pa.allocated_amount), 0)
  INTO v_paid_amount
  FROM payment_allocations pa
  WHERE pa.billing_group_id = p_billing_group_id;
  
  -- Update billing group
  UPDATE billing_groups
  SET 
    total_amount = v_total_amount,
    paid_amount = v_paid_amount,
    balance_due = v_total_amount - v_paid_amount
  WHERE id = p_billing_group_id;
END;
$$;

-- ============================================
-- Get user's organizations
-- ============================================

CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  user_role TEXT,
  is_merchant BOOLEAN,
  is_corporate BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT 
    o.id AS organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    ou.role AS user_role,
    o.is_merchant,
    o.is_corporate
  FROM public.organizations o
  JOIN public.organization_users ou ON ou.organization_id = o.id
  WHERE ou.user_id = p_user_id
    AND ou.status = 'active'
  ORDER BY o.created_at;
$$;

-- ============================================
-- Get merchant stats
-- ============================================

CREATE OR REPLACE FUNCTION get_merchant_stats(p_organization_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stats json;
BEGIN
  -- Check access
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;
  
  -- Get stats
  SELECT json_build_object(
    'total_tabs', COUNT(DISTINCT t.id),
    'open_tabs', COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'sent', 'viewed')),
    'paid_tabs', COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'paid'),
    'total_revenue', COALESCE(SUM(DISTINCT t.total_amount) FILTER (WHERE t.status = 'paid'), 0),
    'pending_revenue', COALESCE(SUM(DISTINCT t.amount_due) FILTER (WHERE t.status IN ('open', 'sent', 'viewed', 'partial')), 0),
    'total_customers', COUNT(DISTINCT t.customer_email)
  )
  INTO v_stats
  FROM public.tabs t
  WHERE t.organization_id = p_organization_id;
  
  RETURN v_stats;
END;
$$;

-- ============================================
-- Triggers for automatic calculations
-- ============================================

-- Trigger to update tab totals when line items change
CREATE OR REPLACE FUNCTION update_tab_totals_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_tab_totals(OLD.tab_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_tab_totals(NEW.tab_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tab_totals_on_line_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.line_items
FOR EACH ROW EXECUTE FUNCTION update_tab_totals_trigger();

-- Trigger to update billing group totals
CREATE OR REPLACE FUNCTION update_billing_group_totals_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_billing_group_totals(OLD.billing_group_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_billing_group_totals(NEW.billing_group_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_group_totals_on_member_change
AFTER INSERT OR UPDATE OR DELETE ON public.billing_group_members
FOR EACH ROW EXECUTE FUNCTION update_billing_group_totals_trigger();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_tab_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tab_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_billing_group_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organizations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_stats(UUID) TO authenticated;