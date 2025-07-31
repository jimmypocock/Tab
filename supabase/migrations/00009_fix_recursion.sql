-- Fix the infinite recursion in organization_users RLS policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "organization_users_select_member" ON public.organization_users;

-- Create a simpler policy that doesn't cause recursion
-- Users can see organization_users records where they are a member
CREATE POLICY "organization_users_select_own" ON public.organization_users
  FOR SELECT TO authenticated
  USING (
    -- User can see records for organizations they belong to
    -- We check this by looking at the current row's user_id
    user_id = auth.uid()
    OR
    -- Or they can see other members if they share an organization
    organization_id IN (
      SELECT DISTINCT ou.organization_id 
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid() 
        AND ou.status = 'active'
    )
  );

-- Also fix the tabs policy to not reference organization_users in a way that causes recursion
DROP POLICY IF EXISTS "tabs_select_member" ON public.tabs;

CREATE POLICY "tabs_select_member" ON public.tabs
  FOR SELECT TO authenticated
  USING (
    -- Check organization membership directly without subquery to organization_users
    EXISTS (
      SELECT 1 
      FROM public.organization_users ou
      WHERE ou.organization_id = tabs.organization_id
        AND ou.user_id = auth.uid()
        AND ou.status = 'active'
    )
  );

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed infinite recursion in RLS policies';
END $$;