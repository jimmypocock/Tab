-- Drop all existing policies on organization_users to start fresh
DROP POLICY IF EXISTS "Users can view their organization relationships" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view organization members if they belong" ON public.organization_users;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view organization members" ON public.organization_users;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON public.organization_users;

-- Create a simple, clear policy for viewing organization_users
CREATE POLICY "Users can view their own organization memberships" ON public.organization_users
  FOR SELECT
  USING (user_id = auth.uid());

-- Create policy for viewing other members in same org
CREATE POLICY "Users can view members in their organizations" ON public.organization_users
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_users 
      WHERE user_id = auth.uid()
    )
  );

-- Create policy for managing organization members (owners/admins only)
CREATE POLICY "Owners and admins can manage organization members" ON public.organization_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 
      FROM public.organization_users 
      WHERE organization_id = organization_users.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Also check organizations table policies
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can manage their own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Owners and admins can update their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create their own organization" ON public.organizations;

-- Simple policy for organizations
CREATE POLICY "Users can view organizations they belong to" ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_users 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for updating organizations
CREATE POLICY "Owners and admins can update their organizations" ON public.organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_users 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Test function to check what auth.uid() returns
CREATE OR REPLACE FUNCTION public.test_auth_context()
RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'auth_uid', auth.uid(),
    'current_user', current_user,
    'session_user', session_user
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;