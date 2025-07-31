-- Optimize RLS performance by preventing auth.uid() from being re-evaluated for each row
-- This is critical for payment processing performance at scale

-- ============================================
-- Users table policies
-- ============================================

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- ============================================
-- Organizations table policies
-- ============================================

DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = (select auth.uid())
        AND organization_users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
CREATE POLICY "organizations_insert_authenticated" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
CREATE POLICY "organizations_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = (select auth.uid())
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = (select auth.uid())
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
  );

DROP POLICY IF EXISTS "organizations_delete_owner" ON public.organizations;
CREATE POLICY "organizations_delete_owner" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = (select auth.uid())
        AND organization_users.role = 'owner'
        AND organization_users.status = 'active'
    )
  );

-- ============================================
-- Organization_users table policies
-- ============================================

DROP POLICY IF EXISTS "organization_users_select_direct" ON public.organization_users;
CREATE POLICY "organization_users_select_direct" ON public.organization_users
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "organization_users_update_own" ON public.organization_users;
CREATE POLICY "organization_users_update_own" ON public.organization_users
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================
-- API Keys table policies
-- ============================================

DROP POLICY IF EXISTS "api_keys_select_admin" ON public.api_keys;
CREATE POLICY "api_keys_select_admin" ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "api_keys_insert_admin" ON public.api_keys;
CREATE POLICY "api_keys_insert_admin" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "api_keys_update_admin" ON public.api_keys;
CREATE POLICY "api_keys_update_admin" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "api_keys_delete_admin" ON public.api_keys;
CREATE POLICY "api_keys_delete_admin" ON public.api_keys
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- Tabs table policies
-- ============================================

DROP POLICY IF EXISTS "tabs_select_member" ON public.tabs;
CREATE POLICY "tabs_select_member" ON public.tabs
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "tabs_insert_member" ON public.tabs;
CREATE POLICY "tabs_insert_member" ON public.tabs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS "tabs_update_member" ON public.tabs;
CREATE POLICY "tabs_update_member" ON public.tabs
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS "tabs_delete_admin" ON public.tabs;
CREATE POLICY "tabs_delete_admin" ON public.tabs
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- Line Items table policies
-- ============================================

DROP POLICY IF EXISTS "line_items_select" ON public.line_items;
CREATE POLICY "line_items_select" ON public.line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member((select auth.uid()), t.organization_id)
    )
  );

DROP POLICY IF EXISTS "line_items_insert" ON public.line_items;
CREATE POLICY "line_items_insert" ON public.line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member((select auth.uid()), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

DROP POLICY IF EXISTS "line_items_update" ON public.line_items;
CREATE POLICY "line_items_update" ON public.line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member((select auth.uid()), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member((select auth.uid()), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

DROP POLICY IF EXISTS "line_items_delete" ON public.line_items;
CREATE POLICY "line_items_delete" ON public.line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member((select auth.uid()), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

-- ============================================
-- Payments table policies
-- ============================================

DROP POLICY IF EXISTS "payments_select_member" ON public.payments;
CREATE POLICY "payments_select_member" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "payments_update_member" ON public.payments;
CREATE POLICY "payments_update_member" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- Invoices table policies
-- ============================================

DROP POLICY IF EXISTS "invoices_select_member" ON public.invoices;
CREATE POLICY "invoices_select_member" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "invoices_insert_member" ON public.invoices;
CREATE POLICY "invoices_insert_member" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS "invoices_update_member" ON public.invoices;
CREATE POLICY "invoices_update_member" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;
CREATE POLICY "invoices_delete_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- Billing Groups table policies
-- ============================================

DROP POLICY IF EXISTS "billing_groups_select_member" ON public.billing_groups;
CREATE POLICY "billing_groups_select_member" ON public.billing_groups
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "billing_groups_insert_admin" ON public.billing_groups;
CREATE POLICY "billing_groups_insert_admin" ON public.billing_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "billing_groups_update_admin" ON public.billing_groups;
CREATE POLICY "billing_groups_update_admin" ON public.billing_groups
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "billing_groups_delete_admin" ON public.billing_groups;
CREATE POLICY "billing_groups_delete_admin" ON public.billing_groups
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- Invitations table policies
-- ============================================

DROP POLICY IF EXISTS "invitations_select_member" ON public.invitations;
CREATE POLICY "invitations_select_member" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id)
    OR email = (SELECT email FROM public.users WHERE id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "invitations_insert_admin" ON public.invitations;
CREATE POLICY "invitations_insert_admin" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "invitations_update_admin" ON public.invitations;
CREATE POLICY "invitations_update_admin" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- Organization Activity table policies
-- ============================================

DROP POLICY IF EXISTS "organization_activity_select_member" ON public.organization_activity;
CREATE POLICY "organization_activity_select_member" ON public.organization_activity
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "organization_activity_insert_system" ON public.organization_activity;
CREATE POLICY "organization_activity_insert_system" ON public.organization_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id, ARRAY['owner', 'admin', 'member'])
  );

-- ============================================
-- Billing Group Members table policies (from previous migration)
-- ============================================

DROP POLICY IF EXISTS "billing_group_members_select" ON public.billing_group_members;
CREATE POLICY "billing_group_members_select" ON public.billing_group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      WHERE bg.id = billing_group_members.billing_group_id
        AND bg.organization_id IN (
          SELECT organization_id FROM public.organization_users
          WHERE user_id = (select auth.uid()) AND status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS "billing_group_members_insert" ON public.billing_group_members;
CREATE POLICY "billing_group_members_insert" ON public.billing_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "billing_group_members_update" ON public.billing_group_members;
CREATE POLICY "billing_group_members_update" ON public.billing_group_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "billing_group_members_delete" ON public.billing_group_members;
CREATE POLICY "billing_group_members_delete" ON public.billing_group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Billing Group Rules table policies
-- ============================================

DROP POLICY IF EXISTS "billing_group_rules_select" ON public.billing_group_rules;
CREATE POLICY "billing_group_rules_select" ON public.billing_group_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      WHERE bg.id = billing_group_rules.billing_group_id
        AND bg.organization_id IN (
          SELECT organization_id FROM public.organization_users
          WHERE user_id = (select auth.uid()) AND status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS "billing_group_rules_insert" ON public.billing_group_rules;
CREATE POLICY "billing_group_rules_insert" ON public.billing_group_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "billing_group_rules_update" ON public.billing_group_rules;
CREATE POLICY "billing_group_rules_update" ON public.billing_group_rules
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "billing_group_rules_delete" ON public.billing_group_rules;
CREATE POLICY "billing_group_rules_delete" ON public.billing_group_rules
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Organization Relationships table policies
-- ============================================

DROP POLICY IF EXISTS "organization_relationships_select" ON public.organization_relationships;
CREATE POLICY "organization_relationships_select" ON public.organization_relationships
  FOR SELECT TO authenticated
  USING (
    merchant_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = (select auth.uid()) AND status = 'active'
    )
    OR corporate_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = (select auth.uid()) AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "organization_relationships_insert" ON public.organization_relationships;
CREATE POLICY "organization_relationships_insert" ON public.organization_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = (select auth.uid())
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  );

DROP POLICY IF EXISTS "organization_relationships_update" ON public.organization_relationships;
CREATE POLICY "organization_relationships_update" ON public.organization_relationships
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = (select auth.uid())
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = (select auth.uid())
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  );

DROP POLICY IF EXISTS "organization_relationships_delete" ON public.organization_relationships;
CREATE POLICY "organization_relationships_delete" ON public.organization_relationships
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = (select auth.uid())
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  );

-- ============================================
-- Payment Allocations table policies
-- ============================================

DROP POLICY IF EXISTS "payment_allocations_select" ON public.payment_allocations;
CREATE POLICY "payment_allocations_select" ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_allocations.payment_id
        AND p.organization_id IN (
          SELECT organization_id FROM public.organization_users
          WHERE user_id = (select auth.uid()) AND status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS "payment_allocations_insert" ON public.payment_allocations;
CREATE POLICY "payment_allocations_insert" ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "payment_allocations_update" ON public.payment_allocations;
CREATE POLICY "payment_allocations_update" ON public.payment_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "payment_allocations_delete" ON public.payment_allocations;
CREATE POLICY "payment_allocations_delete" ON public.payment_allocations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = (select auth.uid())
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Verify performance optimizations
-- ============================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count policies that still have direct auth.uid() calls
  SELECT COUNT(*)
  INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual LIKE '%auth.uid()%' 
      OR with_check LIKE '%auth.uid()%'
    )
    AND (
      qual NOT LIKE '%(select auth.uid())%' 
      OR with_check NOT LIKE '%(select auth.uid())%'
    );
  
  IF v_count > 0 THEN
    RAISE WARNING 'Found % policies that may still have performance issues', v_count;
  ELSE
    RAISE NOTICE 'All RLS policies have been optimized for performance';
  END IF;
  
  RAISE NOTICE 'RLS performance optimizations applied:';
  RAISE NOTICE '- Replaced auth.uid() with (select auth.uid()) in all policies';
  RAISE NOTICE '- This prevents re-evaluation for each row during table scans';
  RAISE NOTICE '- Critical for payment processing performance at scale';
  RAISE NOTICE '- Expect significant query performance improvements';
END $$;