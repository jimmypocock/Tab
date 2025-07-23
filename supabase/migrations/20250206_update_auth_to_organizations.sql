-- Update auth flow to create organizations instead of merchants

-- Drop the old merchant creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update handle_new_user function to create users and organizations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Only create organization for actual user signups (not for service accounts)
  IF NEW.raw_user_meta_data->>'business_name' IS NOT NULL THEN
    -- Generate slug from business name
    org_slug := lower(regexp_replace(
      COALESCE(NEW.raw_user_meta_data->>'business_name', 'Unnamed Business'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    
    -- Ensure slug is unique
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
      org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    END LOOP;

    -- Create organization
    INSERT INTO public.organizations (
      name,
      slug,
      type,
      is_merchant,
      is_corporate,
      primary_email,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'business_name', 'Unnamed Business'),
      org_slug,
      'business',
      true,  -- Default new signups to merchant capability
      false, -- Can be enabled later if needed
      NEW.email,
      NEW.id,
      NOW(),
      NOW()
    )
    RETURNING id INTO new_org_id;

    -- Add user as owner of the organization
    INSERT INTO public.organization_users (
      organization_id,
      user_id,
      role,
      status,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      new_org_id,
      NEW.id,
      'owner',
      'active',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remove the email column from merchants since we're not using it anymore
ALTER TABLE public.merchants 
ALTER COLUMN email DROP NOT NULL;

-- Add helpful comment
COMMENT ON TABLE public.merchants IS 'DEPRECATED: Use organizations table instead. This table is kept for historical data only.';
COMMENT ON TABLE public.organizations IS 'Unified table for all business entities. Replaces both merchants and corporate_accounts tables.';

-- Create function to get user's default organization (for dashboard)
CREATE OR REPLACE FUNCTION public.get_user_default_organization(p_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get the first organization where user is active
  -- Prioritize owned organizations, then by role hierarchy
  SELECT organization_id INTO v_org_id
  FROM public.organization_users
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY 
    CASE role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      WHEN 'viewer' THEN 4
    END,
    joined_at ASC
  LIMIT 1;
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies for new tables
-- Organizations table: Users can only see organizations they belong to
CREATE POLICY "Users can view their organizations" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_users 
      WHERE user_id = (SELECT auth.uid()) 
        AND status = 'active'
    )
  );

-- Organization users table: Users can see members of their organizations
CREATE POLICY "Users can view organization members" ON public.organization_users
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_users 
      WHERE user_id = (SELECT auth.uid()) 
        AND status = 'active'
    )
  );

-- Only organization owners and admins can manage members
CREATE POLICY "Owners and admins can manage members" ON public.organization_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 
      FROM public.organization_users ou
      WHERE ou.organization_id = organization_users.organization_id
        AND ou.user_id = (SELECT auth.uid())
        AND ou.role IN ('owner', 'admin')
        AND ou.status = 'active'
    )
  );

-- Grant necessary permissions
GRANT SELECT ON public.organizations TO authenticated;
GRANT INSERT ON public.organizations TO authenticated;
GRANT UPDATE ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_users TO authenticated;
GRANT INSERT ON public.organization_users TO authenticated;
GRANT UPDATE ON public.organization_users TO authenticated;
GRANT DELETE ON public.organization_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_default_organization TO authenticated;