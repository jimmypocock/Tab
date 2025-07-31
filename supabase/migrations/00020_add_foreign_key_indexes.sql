-- Add missing foreign key indexes for performance optimization
-- These indexes improve JOIN performance and foreign key constraint checks

-- ============================================
-- API Keys foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_api_keys_created_by 
  ON public.api_keys(created_by);

-- ============================================
-- Billing Group Members foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_billing_group_members_added_by 
  ON public.billing_group_members(added_by);

-- ============================================
-- Billing Groups foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_billing_groups_corporate_org_id 
  ON public.billing_groups(corporate_org_id);

CREATE INDEX IF NOT EXISTS idx_billing_groups_created_by 
  ON public.billing_groups(created_by);

-- ============================================
-- Invitations foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invitations_accepted_by 
  ON public.invitations(accepted_by);

CREATE INDEX IF NOT EXISTS idx_invitations_invited_by 
  ON public.invitations(invited_by);

-- ============================================
-- Invoices foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invoices_created_by 
  ON public.invoices(created_by);

CREATE INDEX IF NOT EXISTS idx_invoices_tab_id 
  ON public.invoices(tab_id);

-- ============================================
-- Organization Relationships foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_organization_relationships_created_by 
  ON public.organization_relationships(created_by);

-- ============================================
-- Organization Users foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_organization_users_invited_by 
  ON public.organization_users(invited_by);

-- ============================================
-- Payments foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payments_billing_group_id 
  ON public.payments(billing_group_id);

-- ============================================
-- Tabs foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tabs_billing_group_id 
  ON public.tabs(billing_group_id);

CREATE INDEX IF NOT EXISTS idx_tabs_created_by 
  ON public.tabs(created_by);

-- ============================================
-- Verify indexes were created
-- ============================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count new indexes created
  SELECT COUNT(*)
  INTO v_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_api_keys_created_by',
      'idx_billing_group_members_added_by',
      'idx_billing_groups_corporate_org_id',
      'idx_billing_groups_created_by',
      'idx_invitations_accepted_by',
      'idx_invitations_invited_by',
      'idx_invoices_created_by',
      'idx_invoices_tab_id',
      'idx_organization_relationships_created_by',
      'idx_organization_users_invited_by',
      'idx_payments_billing_group_id',
      'idx_tabs_billing_group_id',
      'idx_tabs_created_by'
    );
  
  RAISE NOTICE 'Created % foreign key indexes for performance optimization', v_count;
  RAISE NOTICE 'These indexes will improve:';
  RAISE NOTICE '- JOIN query performance';
  RAISE NOTICE '- Foreign key constraint checks';
  RAISE NOTICE '- User and organization relationship queries';
  RAISE NOTICE '- Billing group and payment queries';
END $$;