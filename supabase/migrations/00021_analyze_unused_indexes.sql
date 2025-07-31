-- Analyze unused indexes and document their purpose
-- NOTE: These indexes show as unused because the system is new with minimal query activity
-- They should NOT be removed as they serve important purposes

-- ============================================
-- Document purpose of key indexes
-- ============================================

COMMENT ON INDEX public.idx_users_email IS 
  'Critical for user authentication and lookup by email. Keep even if unused.';

COMMENT ON INDEX public.idx_organizations_slug IS 
  'Used for URL routing and organization lookup by slug. Keep for future use.';

COMMENT ON INDEX public.idx_tabs_tab_number IS 
  'Essential for tab lookups by number in payment links. Keep even if unused.';

COMMENT ON INDEX public.idx_tabs_organization_id IS 
  'Critical for merchant dashboard queries filtering tabs by organization.';

COMMENT ON INDEX public.idx_tabs_status IS 
  'Important for filtering tabs by status (open, paid, void, etc).';

COMMENT ON INDEX public.idx_tabs_customer_email IS 
  'Used for customer lookups and payment history queries.';

COMMENT ON INDEX public.idx_line_items_tab_id IS 
  'Essential for retrieving line items for a tab. High-frequency query.';

COMMENT ON INDEX public.idx_payments_tab_id IS 
  'Critical for payment history and reconciliation queries.';

COMMENT ON INDEX public.idx_payments_organization_id IS 
  'Used for merchant payment reporting and analytics.';

COMMENT ON INDEX public.idx_payments_status IS 
  'Important for payment status filtering and reconciliation.';

COMMENT ON INDEX public.idx_api_keys_organization_id IS 
  'Used for API key management in merchant dashboard.';

COMMENT ON INDEX public.idx_api_keys_key_prefix IS 
  'Critical for API authentication - fast lookup by key prefix.';

COMMENT ON INDEX public.idx_invoices_organization_id IS 
  'Used for invoice listing and filtering in merchant dashboard.';

COMMENT ON INDEX public.idx_invoices_invoice_number IS 
  'Essential for invoice lookups by number.';

COMMENT ON INDEX public.idx_billing_groups_organization_id IS 
  'Used for corporate billing group management.';

COMMENT ON INDEX public.idx_invitations_email IS 
  'Critical for invitation lookups during user signup.';

COMMENT ON INDEX public.idx_invitations_token IS 
  'Essential for secure invitation acceptance flow.';

-- ============================================
-- Log analysis results
-- ============================================

DO $$
DECLARE
  v_total_indexes INTEGER;
  v_commented_indexes INTEGER;
BEGIN
  -- Count total indexes
  SELECT COUNT(*)
  INTO v_total_indexes
  FROM pg_indexes
  WHERE schemaname = 'public';
  
  -- Count indexes with comments
  SELECT COUNT(*)
  INTO v_commented_indexes
  FROM pg_indexes i
  JOIN pg_description d ON d.objoid = (i.schemaname||'.'||i.indexname)::regclass
  WHERE i.schemaname = 'public';
  
  RAISE NOTICE 'Index Analysis Complete:';
  RAISE NOTICE '- Total indexes: %', v_total_indexes;
  RAISE NOTICE '- Documented critical indexes: %', v_commented_indexes;
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Indexes showing as "unused" are expected in a new system.';
  RAISE NOTICE 'These indexes support critical query patterns that will emerge with usage:';
  RAISE NOTICE '- User authentication and lookup';
  RAISE NOTICE '- Payment processing and reconciliation';
  RAISE NOTICE '- API authentication';
  RAISE NOTICE '- Dashboard queries and filtering';
  RAISE NOTICE '- Corporate billing management';
  RAISE NOTICE '';
  RAISE NOTICE 'Do NOT remove these indexes without production query analysis.';
END $$;