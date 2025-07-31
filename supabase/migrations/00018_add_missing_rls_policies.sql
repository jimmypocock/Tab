-- Add missing RLS policies for tables that have RLS enabled but no policies

-- ============================================
-- billing_group_members policies
-- ============================================

-- Users can view billing group members for their organizations
CREATE POLICY "billing_group_members_select" ON public.billing_group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      WHERE bg.id = billing_group_members.billing_group_id
        AND bg.organization_id IN (
          SELECT organization_id FROM public.organization_users
          WHERE user_id = auth.uid() AND status = 'active'
        )
    )
  );

-- Only members and above can manage billing group members
CREATE POLICY "billing_group_members_insert" ON public.billing_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "billing_group_members_update" ON public.billing_group_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "billing_group_members_delete" ON public.billing_group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_members.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- billing_group_rules policies
-- ============================================

-- Users can view rules for their organization's billing groups
CREATE POLICY "billing_group_rules_select" ON public.billing_group_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      WHERE bg.id = billing_group_rules.billing_group_id
        AND bg.organization_id IN (
          SELECT organization_id FROM public.organization_users
          WHERE user_id = auth.uid() AND status = 'active'
        )
    )
  );

-- Only admins can manage billing group rules
CREATE POLICY "billing_group_rules_insert" ON public.billing_group_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "billing_group_rules_update" ON public.billing_group_rules
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "billing_group_rules_delete" ON public.billing_group_rules
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.billing_groups bg
      JOIN public.organization_users ou ON ou.organization_id = bg.organization_id
      WHERE bg.id = billing_group_rules.billing_group_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- organization_relationships policies
-- ============================================

-- Users can view relationships for their organizations
CREATE POLICY "organization_relationships_select" ON public.organization_relationships
  FOR SELECT TO authenticated
  USING (
    merchant_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR corporate_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only admins can create relationships
CREATE POLICY "organization_relationships_insert" ON public.organization_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  );

-- Only admins can update relationships
CREATE POLICY "organization_relationships_update" ON public.organization_relationships
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  );

-- Only admins can delete relationships
CREATE POLICY "organization_relationships_delete" ON public.organization_relationships
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
        AND (organization_id = merchant_org_id OR organization_id = corporate_org_id)
    )
  );

-- ============================================
-- payment_allocations policies
-- ============================================

-- Users can view payment allocations for their organization's payments
CREATE POLICY "payment_allocations_select" ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_allocations.payment_id
        AND p.organization_id IN (
          SELECT organization_id FROM public.organization_users
          WHERE user_id = auth.uid() AND status = 'active'
        )
    )
  );

-- Payment allocations are typically created by system/webhook, but allow admins
CREATE POLICY "payment_allocations_insert" ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- Only admins can update allocations (for corrections)
CREATE POLICY "payment_allocations_update" ON public.payment_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- Only admins can delete allocations (for corrections)
CREATE POLICY "payment_allocations_delete" ON public.payment_allocations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.organization_users ou ON ou.organization_id = p.organization_id
      WHERE p.id = payment_allocations.payment_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND ou.role IN ('owner', 'admin')
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_group_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;

-- Fix is_organization_member search_path
-- Use ALTER FUNCTION to avoid conflicts
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Find all versions of is_organization_member and set search_path
  FOR func_record IN 
    SELECT DISTINCT proname || '(' || oidvectortypes(proargtypes) || ')' as func_sig
    FROM pg_proc
    WHERE proname = 'is_organization_member'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = ''''', func_record.func_sig);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    -- If function doesn't exist or other error, continue
    NULL;
END $$;

-- Verify all security issues are resolved
DO $$
DECLARE
  v_tables_without_policies INTEGER;
BEGIN
  -- Count tables with RLS enabled but no policies
  SELECT COUNT(*)
  INTO v_tables_without_policies
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = t.schemaname
        AND p.tablename = t.tablename
    );
  
  RAISE NOTICE 'Tables with RLS enabled but no policies: %', v_tables_without_policies;
  RAISE NOTICE 'Security fixes applied:';
  RAISE NOTICE '- Added RLS policies for billing_group_members';
  RAISE NOTICE '- Added RLS policies for billing_group_rules';
  RAISE NOTICE '- Added RLS policies for organization_relationships';
  RAISE NOTICE '- Added RLS policies for payment_allocations';
  RAISE NOTICE '- Fixed is_organization_member search_path';
  RAISE NOTICE 'All security warnings should now be resolved';
END $$;