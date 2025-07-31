-- Final fix for the infinite recursion in organization_users
-- The problem is that any self-referencing query on organization_users causes recursion
-- We need to use a different approach

-- First, drop all policies on organization_users
DROP POLICY IF EXISTS "organization_users_select_simple" ON public.organization_users;
DROP POLICY IF EXISTS "organization_users_insert_restricted" ON public.organization_users;
DROP POLICY IF EXISTS "organization_users_update_admin" ON public.organization_users;
DROP POLICY IF EXISTS "organization_users_delete_admin" ON public.organization_users;

-- Create a materialized view or use a different approach
-- For now, let's use a simpler policy that doesn't self-reference

-- SELECT policy - users can see records where they are directly involved
CREATE POLICY "organization_users_select_direct" ON public.organization_users
  FOR SELECT TO authenticated
  USING (
    -- User can see their own membership records
    user_id = auth.uid()
  );

-- To allow users to see other members in their organizations, 
-- we'll need to query organization_users from the application level
-- or use a stored function that bypasses RLS

-- Function to get organization members (bypasses RLS)
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
      -- Check if the calling user is a member of this organization
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_organization_members TO authenticated;

-- INSERT policy - only via functions
CREATE POLICY "organization_users_insert_none" ON public.organization_users
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE policy - users can update their own status (for leaving orgs)
-- Admins update via functions
CREATE POLICY "organization_users_update_own" ON public.organization_users
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE policy - only via functions
CREATE POLICY "organization_users_delete_none" ON public.organization_users
  FOR DELETE TO authenticated
  USING (false);

-- Now we need to update other policies to not directly query organization_users
-- Instead, they should use the is_organization_member function we created earlier

-- Update all policies that reference organization_users
-- Start with api_keys
DROP POLICY IF EXISTS "api_keys_select_admin" ON public.api_keys;
CREATE POLICY "api_keys_select_admin" ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "api_keys_update_admin" ON public.api_keys;
CREATE POLICY "api_keys_update_admin" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "api_keys_delete_admin" ON public.api_keys;
CREATE POLICY "api_keys_delete_admin" ON public.api_keys
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Update billing_groups policies
DROP POLICY IF EXISTS "billing_groups_select_member" ON public.billing_groups;
CREATE POLICY "billing_groups_select_member" ON public.billing_groups
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "billing_groups_update_admin" ON public.billing_groups;
CREATE POLICY "billing_groups_update_admin" ON public.billing_groups
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "billing_groups_delete_admin" ON public.billing_groups;
CREATE POLICY "billing_groups_delete_admin" ON public.billing_groups
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Update tabs policies
DROP POLICY IF EXISTS "tabs_update_member" ON public.tabs;
CREATE POLICY "tabs_update_member" ON public.tabs
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS "tabs_delete_admin" ON public.tabs;
CREATE POLICY "tabs_delete_admin" ON public.tabs
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Update payments policies
DROP POLICY IF EXISTS "payments_select_member" ON public.payments;
CREATE POLICY "payments_select_member" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "payments_update_member" ON public.payments;
CREATE POLICY "payments_update_member" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Update invoices policies
DROP POLICY IF EXISTS "invoices_select_member" ON public.invoices;
CREATE POLICY "invoices_select_member" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "invoices_update_member" ON public.invoices;
CREATE POLICY "invoices_update_member" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;
CREATE POLICY "invoices_delete_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Update invitations policies
DROP POLICY IF EXISTS "invitations_select_member" ON public.invitations;
CREATE POLICY "invitations_select_member" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
    OR email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "invitations_update_admin" ON public.invitations;
CREATE POLICY "invitations_update_admin" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    public.is_organization_member(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Update organization_activity policies
DROP POLICY IF EXISTS "organization_activity_select_member" ON public.organization_activity;
CREATE POLICY "organization_activity_select_member" ON public.organization_activity
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

-- Update line_items policies (these reference tabs, which reference organization_users)
DROP POLICY IF EXISTS "line_items_select" ON public.line_items;
CREATE POLICY "line_items_select" ON public.line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id)
    )
  );

DROP POLICY IF EXISTS "line_items_update" ON public.line_items;
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

DROP POLICY IF EXISTS "line_items_delete" ON public.line_items;
CREATE POLICY "line_items_delete" ON public.line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = line_items.tab_id
        AND public.is_organization_member(auth.uid(), t.organization_id, ARRAY['owner', 'admin', 'member'])
    )
  );

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed infinite recursion by avoiding self-referencing queries in organization_users policies';
END $$;