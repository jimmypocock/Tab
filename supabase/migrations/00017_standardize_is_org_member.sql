-- Standardize is_organization_member function to avoid conflicts
-- Drop the 4-parameter version and use only the 3-parameter version

-- First drop all policies that use is_organization_member to avoid dependency issues
DROP POLICY IF EXISTS "tabs_select_member" ON public.tabs;
DROP POLICY IF EXISTS "tabs_insert_member" ON public.tabs;
DROP POLICY IF EXISTS "tabs_update_member" ON public.tabs;
DROP POLICY IF EXISTS "tabs_delete_admin" ON public.tabs;

DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_owner" ON public.organizations;

DROP POLICY IF EXISTS "api_keys_select_admin" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_insert_admin" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_update_admin" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_delete_admin" ON public.api_keys;

DROP POLICY IF EXISTS "billing_groups_select_member" ON public.billing_groups;
DROP POLICY IF EXISTS "billing_groups_insert_admin" ON public.billing_groups;
DROP POLICY IF EXISTS "billing_groups_update_admin" ON public.billing_groups;
DROP POLICY IF EXISTS "billing_groups_delete_admin" ON public.billing_groups;

DROP POLICY IF EXISTS "payments_select_member" ON public.payments;
DROP POLICY IF EXISTS "payments_update_member" ON public.payments;

DROP POLICY IF EXISTS "invoices_select_member" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_member" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_member" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;

DROP POLICY IF EXISTS "invitations_select_member" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_admin" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_admin" ON public.invitations;

DROP POLICY IF EXISTS "organization_activity_select_member" ON public.organization_activity;
DROP POLICY IF EXISTS "organization_activity_insert_system" ON public.organization_activity;

DROP POLICY IF EXISTS "line_items_select" ON public.line_items;
DROP POLICY IF EXISTS "line_items_insert" ON public.line_items;
DROP POLICY IF EXISTS "line_items_update" ON public.line_items;
DROP POLICY IF EXISTS "line_items_delete" ON public.line_items;

-- Now we can safely drop the 4-parameter version
DROP FUNCTION IF EXISTS public.is_organization_member(UUID, UUID, TEXT[], TEXT);

-- Recreate all the policies using the 3-parameter function consistently
-- Organizations
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = auth.uid()
        AND organization_users.status = 'active'
    )
  );

CREATE POLICY "organizations_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "organizations_delete_owner" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), id, ARRAY['owner'])
  );

-- API Keys
CREATE POLICY "api_keys_select_admin" ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "api_keys_insert_admin" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "api_keys_update_admin" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "api_keys_delete_admin" ON public.api_keys
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Tabs
CREATE POLICY "tabs_select_member" ON public.tabs
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "tabs_insert_member" ON public.tabs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

CREATE POLICY "tabs_update_member" ON public.tabs
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

CREATE POLICY "tabs_delete_admin" ON public.tabs
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Line Items
CREATE POLICY "line_items_select" ON public.line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id)
    )
  );

CREATE POLICY "line_items_insert" ON public.line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

CREATE POLICY "line_items_update" ON public.line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

CREATE POLICY "line_items_delete" ON public.line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

-- Payments
CREATE POLICY "payments_select_member" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "payments_update_member" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Invoices
CREATE POLICY "invoices_select_member" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "invoices_insert_member" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

CREATE POLICY "invoices_update_member" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

CREATE POLICY "invoices_delete_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Billing Groups
CREATE POLICY "billing_groups_select_member" ON public.billing_groups
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "billing_groups_insert_admin" ON public.billing_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "billing_groups_update_admin" ON public.billing_groups
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "billing_groups_delete_admin" ON public.billing_groups
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Invitations
CREATE POLICY "invitations_select_member" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
    OR email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "invitations_insert_admin" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "invitations_update_admin" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Organization Activity
CREATE POLICY "organization_activity_select_member" ON public.organization_activity
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "organization_activity_insert_system" ON public.organization_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

-- Verify standardization
DO $$
BEGIN
  RAISE NOTICE 'Standardized is_organization_member function to 3-parameter version';
  RAISE NOTICE 'Recreated all dependent RLS policies';
  RAISE NOTICE 'Ready for performance optimization';
END $$;