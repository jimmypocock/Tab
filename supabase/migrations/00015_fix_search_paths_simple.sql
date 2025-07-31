-- Fix search_path security warnings for critical functions
-- These functions don't have parameter or return type conflicts

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- is_organization_member
CREATE OR REPLACE FUNCTION public.is_organization_member(
  p_user_id UUID,
  p_organization_id UUID,
  p_allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'member', 'viewer']
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND role = ANY(p_allowed_roles)
      AND status = 'active'
  );
$$;

-- get_organization_members
CREATE OR REPLACE FUNCTION public.get_organization_members(
  p_organization_id UUID
)
RETURNS TABLE(
  id UUID,
  organization_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ,
  user_email TEXT,
  user_first_name TEXT,
  user_last_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT 
    ou.id,
    ou.organization_id,
    ou.user_id,
    ou.role,
    ou.status,
    ou.joined_at,
    u.email as user_email,
    u.first_name as user_first_name,
    u.last_name as user_last_name
  FROM public.organization_users ou
  JOIN public.users u ON u.id = ou.user_id
  WHERE ou.organization_id = p_organization_id
    AND EXISTS (
      SELECT 1
      FROM public.organization_users check_ou
      WHERE check_ou.organization_id = p_organization_id
        AND check_ou.user_id = auth.uid()
        AND check_ou.status = 'active'
    )
  ORDER BY 
    CASE ou.role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      WHEN 'viewer' THEN 4
    END,
    ou.joined_at;
$$;

-- update_billing_group_totals_trigger
CREATE OR REPLACE FUNCTION public.update_billing_group_totals_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.billing_groups
  SET current_balance = (
    SELECT COALESCE(SUM(total_amount), 0)
    FROM public.line_items
    WHERE billing_group_id = NEW.billing_group_id
  )
  WHERE id = NEW.billing_group_id;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate functions with signature conflicts

-- generate_invoice_number
DROP FUNCTION IF EXISTS public.generate_invoice_number(UUID);
CREATE FUNCTION public.generate_invoice_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_sequence INTEGER;
  v_invoice_number TEXT;
BEGIN
  SELECT COALESCE(
    bg.invoice_prefix,
    'INV'
  )
  INTO v_prefix
  FROM public.organizations o
  LEFT JOIN public.billing_groups bg ON bg.organization_id = o.id
  WHERE o.id = p_organization_id
  LIMIT 1;
  
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(invoice_number, '^[A-Z]+-' || v_year || '-', '') AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.invoices
  WHERE organization_id = p_organization_id
    AND invoice_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');
  
  v_invoice_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_invoice_number;
END;
$$;

-- generate_tab_number
DROP FUNCTION IF EXISTS public.generate_tab_number(UUID);
CREATE FUNCTION public.generate_tab_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_prefix TEXT;
  v_sequence INTEGER;
  v_tab_number TEXT;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
  INTO v_prefix
  FROM public.organizations
  WHERE id = p_organization_id;
  
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'TAB';
  END IF;
  
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(tab_number, '^[A-Z]+-', '') AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.tabs
  WHERE organization_id = p_organization_id
    AND tab_number ~ ('^' || v_prefix || '-[0-9]+$');
  
  v_tab_number := v_prefix || '-' || LPAD(v_sequence::TEXT, 5, '0');
  
  RETURN v_tab_number;
END;
$$;

-- update_tab_totals_trigger
-- Drop triggers that depend on this function first
DROP TRIGGER IF EXISTS update_tab_totals_on_line_item_change ON public.line_items;
DROP FUNCTION IF EXISTS public.update_tab_totals_trigger();
CREATE FUNCTION public.update_tab_totals_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_tab_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'line_items' THEN
    v_tab_id := COALESCE(NEW.tab_id, OLD.tab_id);
  ELSIF TG_TABLE_NAME = 'invoice_line_items' THEN
    SELECT tab_id INTO v_tab_id
    FROM public.invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  END IF;
  
  IF v_tab_id IS NOT NULL THEN
    UPDATE public.tabs
    SET 
      total_amount = (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.line_items
        WHERE tab_id = v_tab_id
      ),
      tax_amount = (
        SELECT COALESCE(SUM(tax_amount), 0)
        FROM public.line_items
        WHERE tab_id = v_tab_id
      )
    WHERE id = v_tab_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_tab_totals_on_line_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.line_items
FOR EACH ROW EXECUTE FUNCTION public.update_tab_totals_trigger();

-- Fix accept_invitation search_path without changing parameters
-- Using ALTER FUNCTION to just add search_path
ALTER FUNCTION public.accept_invitation(TEXT, UUID) SET search_path = '';

-- Fix send_invitation search_path
-- Find the exact signature first
DO $$
DECLARE
  v_func_oid oid;
BEGIN
  -- Find the function OID
  SELECT oid INTO v_func_oid
  FROM pg_proc
  WHERE proname = 'send_invitation'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LIMIT 1;
  
  -- If found, alter it
  IF v_func_oid IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', v_func_oid::regprocedure);
  END IF;
END $$;

-- Fix calculate_tab_totals search_path
ALTER FUNCTION public.calculate_tab_totals(UUID) SET search_path = '';

-- Fix calculate_billing_group_totals search_path
ALTER FUNCTION public.calculate_billing_group_totals(UUID) SET search_path = '';

-- Log the security fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed search_path security warnings for payment processing security';
  RAISE NOTICE 'Functions now protected against search path injection attacks';
  RAISE NOTICE 'This is critical for PCI compliance and payment security';
END $$;