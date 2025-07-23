-- Fix the handle_new_user function to properly create organizations
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
        new.raw_user_meta_data->>'business_name',
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

    -- Check if user already has an organization (in case this is a retry)
    IF EXISTS (
        SELECT 1 FROM public.organization_users 
        WHERE user_id = new.id
    ) THEN
        RETURN new;
    END IF;

    -- Create organization
    INSERT INTO public.organizations (name, slug, is_merchant, is_corporate)
    VALUES (org_name, org_slug, true, false)
    RETURNING id INTO org_id;

    -- Create organization user relationship
    INSERT INTO public.organization_users (organization_id, user_id, role, status, joined_at)
    VALUES (org_id, new.id, 'owner', 'active', NOW());

    -- Also create merchant record for backward compatibility
    INSERT INTO public.merchants (id, email, business_name)
    VALUES (new.id, new.email, org_name)
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail user creation
        RAISE LOG 'Error in handle_new_user for user %: %', new.id, SQLERRM;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Make sure the trigger is properly set
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();