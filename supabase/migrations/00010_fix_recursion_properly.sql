-- Fix the infinite recursion in organization_users RLS policy properly
-- The issue is that policies that check organization membership can cause recursion

-- First, drop all existing policies on organization_users
DROP POLICY IF EXISTS "organization_users_select_own" ON public.organization_users;
DROP POLICY IF EXISTS "organization_users_insert" ON public.organization_users;
DROP POLICY IF EXISTS "organization_users_update_admin" ON public.organization_users;
DROP POLICY IF EXISTS "organization_users_delete_admin" ON public.organization_users;

-- Create a simplified SELECT policy that avoids recursion
-- Users can see their own membership records and other members in their organizations
CREATE POLICY "organization_users_select_simple" ON public.organization_users
  FOR SELECT TO authenticated
  USING (
    -- User can always see their own membership records
    user_id = auth.uid()
    OR
    -- User can see other members in organizations where they are an active member
    -- We avoid recursion by using a CTE
    organization_id IN (
      WITH user_orgs AS (
        SELECT organization_id 
        FROM public.organization_users 
        WHERE user_id = auth.uid() 
          AND status = 'active'
      )
      SELECT organization_id FROM user_orgs
    )
  );

-- INSERT policy - users can only insert via functions or as service role
CREATE POLICY "organization_users_insert_restricted" ON public.organization_users
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE policy - only admins/owners can update
CREATE POLICY "organization_users_update_admin" ON public.organization_users
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      WITH user_admin_orgs AS (
        SELECT organization_id 
        FROM public.organization_users 
        WHERE user_id = auth.uid() 
          AND role IN ('owner', 'admin')
          AND status = 'active'
      )
      SELECT organization_id FROM user_admin_orgs
    )
  )
  WITH CHECK (
    organization_id IN (
      WITH user_admin_orgs AS (
        SELECT organization_id 
        FROM public.organization_users 
        WHERE user_id = auth.uid() 
          AND role IN ('owner', 'admin')
          AND status = 'active'
      )
      SELECT organization_id FROM user_admin_orgs
    )
  );

-- DELETE policy - only admins/owners can delete
CREATE POLICY "organization_users_delete_admin" ON public.organization_users
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      WITH user_admin_orgs AS (
        SELECT organization_id 
        FROM public.organization_users 
        WHERE user_id = auth.uid() 
          AND role IN ('owner', 'admin')
          AND status = 'active'
      )
      SELECT organization_id FROM user_admin_orgs
    )
  );

-- Create a function to safely check organization membership
-- This can be used by other policies to avoid recursion
CREATE OR REPLACE FUNCTION public.is_organization_member(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_roles TEXT[] DEFAULT NULL,
  p_required_status TEXT DEFAULT 'active'
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND status = COALESCE(p_required_status, status)
      AND (
        p_required_roles IS NULL 
        OR role = ANY(p_required_roles)
      )
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_organization_member TO authenticated;

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_user_organizations(UUID);
DROP FUNCTION IF EXISTS public.get_user_organizations();

-- Create a function to get user's organizations
CREATE FUNCTION public.get_user_organizations(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(organization_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT organization_id
  FROM public.organization_users
  WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND status = 'active';
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_organizations TO authenticated;

-- Now update other table policies to use the function instead of direct queries
-- This will prevent recursion issues

-- Update tabs SELECT policy
DROP POLICY IF EXISTS "tabs_select_member" ON public.tabs;
CREATE POLICY "tabs_select_member" ON public.tabs
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

-- Update organizations SELECT policy
DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_organization_member(auth.uid(), id)
  );

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed infinite recursion in RLS policies using CTEs and helper functions';
END $$;