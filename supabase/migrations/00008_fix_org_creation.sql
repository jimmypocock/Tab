-- Fix organization creation by creating a proper function
-- This avoids the RLS recursion issue

-- Create organization creation function
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name TEXT,
  p_type TEXT DEFAULT 'business',
  p_is_merchant BOOLEAN DEFAULT true,
  p_is_corporate BOOLEAN DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;
  
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Generate slug
  v_slug := lower(p_name);
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
  v_slug := v_slug || '-' || extract(epoch from now())::text;
  
  -- Create organization
  INSERT INTO public.organizations (
    name,
    slug,
    type,
    is_merchant,
    is_corporate,
    primary_email,
    created_by
  ) VALUES (
    p_name,
    v_slug,
    p_type,
    p_is_merchant,
    p_is_corporate,
    v_user_email,
    v_user_id
  ) RETURNING id INTO v_org_id;
  
  -- Add user as owner
  INSERT INTO public.organization_users (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  ) VALUES (
    v_org_id,
    v_user_id,
    'owner',
    'active',
    now()
  );
  
  -- Return success with organization data
  RETURN json_build_object(
    'success', true,
    'organization', json_build_object(
      'id', v_org_id,
      'name', p_name,
      'slug', v_slug,
      'type', p_type,
      'is_merchant', p_is_merchant,
      'is_corporate', p_is_corporate
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_organization TO authenticated;

COMMENT ON FUNCTION public.create_organization IS 'Creates a new organization for the authenticated user, avoiding RLS recursion issues';