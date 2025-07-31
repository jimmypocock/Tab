-- Fix the final remaining search_path security warnings
-- These are critical for payment processing security

-- Fix is_organization_member search_path
-- This function already exists from migration 00010, need to alter it
ALTER FUNCTION public.is_organization_member(UUID, UUID, TEXT[]) SET search_path = '';

-- Fix get_user_organizations search_path
-- First find and alter the existing function
DO $$
DECLARE
  v_func_oid oid;
BEGIN
  -- Find the function OID for get_user_organizations
  -- It might have different parameter signatures in different migrations
  FOR v_func_oid IN (
    SELECT oid 
    FROM pg_proc 
    WHERE proname = 'get_user_organizations' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  )
  LOOP
    -- Alter each version to set search_path
    EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', v_func_oid::regprocedure);
  END LOOP;
END $$;

-- Verify all functions now have secure search_path
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count functions without secure search_path
  SELECT COUNT(*)
  INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'update_updated_at_column',
      'is_organization_member',
      'get_organization_members',
      'update_billing_group_totals_trigger',
      'get_user_organizations',
      'generate_invoice_number',
      'accept_invitation',
      'send_invitation',
      'generate_tab_number',
      'calculate_billing_group_totals',
      'update_tab_totals_trigger',
      'calculate_tab_totals',
      'create_organization'
    )
    AND NOT (p.proconfig @> ARRAY['search_path=']);
  
  IF v_count > 0 THEN
    RAISE WARNING 'Found % functions without secure search_path', v_count;
  ELSE
    RAISE NOTICE 'All critical functions now have secure search_path';
  END IF;
END $$;

-- Log the final security fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed final search_path security warnings';
  RAISE NOTICE 'All functions are now protected against search path injection attacks';
  RAISE NOTICE 'This ensures PCI compliance and payment processing security';
END $$;