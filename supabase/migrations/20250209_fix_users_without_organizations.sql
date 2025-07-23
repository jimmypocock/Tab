-- Fix users without organizations (from old registration flow)

-- First, create organizations for any users that don't have one
INSERT INTO public.organizations (id, name, slug, is_merchant, is_corporate, created_at, updated_at)
SELECT 
    gen_random_uuid() as id,
    COALESCE(u.raw_user_meta_data->>'businessName', u.email) as name,
    LOWER(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'businessName', SPLIT_PART(u.email, '@', 1)), '[^a-z0-9]+', '-', 'g')) as slug,
    true as is_merchant,
    false as is_corporate,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = u.id
)
AND u.email IS NOT NULL;

-- Then, create organization_user relationships for these users
INSERT INTO public.organization_users (id, organization_id, user_id, role, status, joined_at)
SELECT 
    gen_random_uuid() as id,
    o.id as organization_id,
    u.id as user_id,
    'owner' as role,
    'active' as status,
    NOW() as joined_at
FROM auth.users u
INNER JOIN public.organizations o ON (
    o.name = COALESCE(u.raw_user_meta_data->>'businessName', u.email)
    OR o.slug = LOWER(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'businessName', SPLIT_PART(u.email, '@', 1)), '[^a-z0-9]+', '-', 'g'))
)
WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = u.id
)
AND u.email IS NOT NULL;

-- Update the handle_new_user function to ensure it always creates an organization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    org_id uuid;
    org_name text;
    org_slug text;
BEGIN
    -- Get business name from metadata or use email
    org_name := COALESCE(
        new.raw_user_meta_data->>'businessName',
        new.raw_user_meta_data->>'full_name',
        SPLIT_PART(new.email, '@', 1)
    );
    
    -- Generate slug from name
    org_slug := LOWER(REGEXP_REPLACE(org_name, '[^a-z0-9]+', '-', 'g'));
    
    -- Ensure slug is unique by appending random suffix if needed
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
        org_slug := org_slug || '-' || SUBSTR(MD5(RANDOM()::text), 1, 6);
    END LOOP;

    -- Create user record in public schema FIRST
    INSERT INTO public.users (id, email)
    VALUES (
        new.id,
        new.email
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create organization
    INSERT INTO public.organizations (name, slug, is_merchant, is_corporate)
    VALUES (org_name, org_slug, true, false)
    RETURNING id INTO org_id;

    -- Create organization user relationship AFTER user exists
    INSERT INTO public.organization_users (organization_id, user_id, role, status, joined_at)
    VALUES (org_id, new.id, 'owner', 'active', NOW());

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Create a helper function to check if user has organization
CREATE OR REPLACE FUNCTION public.user_has_organization(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organization_users
        WHERE user_id = $1
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Add RLS policy for the setup organization page
CREATE POLICY "Users can create their own organization" ON public.organizations
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.organization_users
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Ensure users can read their own user record
CREATE POLICY "Users can read their own record" ON public.users
    FOR SELECT
    USING (id = auth.uid());