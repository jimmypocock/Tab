-- Debug function to check organization access issues
CREATE OR REPLACE FUNCTION public.debug_user_organization_access(test_user_id uuid)
RETURNS TABLE (
    step text,
    result text,
    details jsonb
) AS $$
BEGIN
    -- Check if user exists in auth.users
    RETURN QUERY
    SELECT 
        'Auth user exists'::text,
        CASE WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = test_user_id) 
             THEN 'YES' ELSE 'NO' END,
        (SELECT jsonb_build_object(
            'email', email,
            'created_at', created_at,
            'email_confirmed_at', email_confirmed_at
        ) FROM auth.users WHERE id = test_user_id);

    -- Check if user exists in public.users
    RETURN QUERY
    SELECT 
        'Public user exists'::text,
        CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = test_user_id) 
             THEN 'YES' ELSE 'NO' END,
        (SELECT jsonb_build_object(
            'email', email,
            'created_at', created_at
        ) FROM public.users WHERE id = test_user_id);

    -- Check organization_users entries
    RETURN QUERY
    SELECT 
        'Organization_users entries'::text,
        COALESCE(COUNT(*)::text, '0'),
        jsonb_agg(jsonb_build_object(
            'org_id', organization_id,
            'role', role,
            'status', status,
            'joined_at', joined_at
        ))
    FROM public.organization_users 
    WHERE user_id = test_user_id;

    -- Check organizations linked to user
    RETURN QUERY
    SELECT 
        'Organizations'::text,
        COALESCE(COUNT(*)::text, '0'),
        jsonb_agg(jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'slug', o.slug,
            'is_merchant', o.is_merchant,
            'created_by', o.created_by
        ))
    FROM public.organizations o
    JOIN public.organization_users ou ON ou.organization_id = o.id
    WHERE ou.user_id = test_user_id;

    -- Check RLS visibility
    RETURN QUERY
    SELECT 
        'RLS visibility (as user)'::text,
        COALESCE(COUNT(*)::text, '0'),
        jsonb_agg(jsonb_build_object(
            'org_id', organization_id,
            'can_see', true
        ))
    FROM public.organization_users
    WHERE user_id = test_user_id
    AND organization_id IN (
        SELECT organization_id 
        FROM public.organization_users 
        WHERE user_id = test_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix function to ensure user has proper access
CREATE OR REPLACE FUNCTION public.fix_user_organization_access(test_user_id uuid)
RETURNS void AS $$
DECLARE
    user_email text;
    org_count int;
BEGIN
    -- Get user email
    SELECT email INTO user_email FROM auth.users WHERE id = test_user_id;
    
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'User not found in auth.users: %', test_user_id;
    END IF;

    -- Ensure user exists in public.users
    INSERT INTO public.users (id, email)
    VALUES (test_user_id, user_email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Count organizations
    SELECT COUNT(*) INTO org_count 
    FROM public.organization_users 
    WHERE user_id = test_user_id;

    -- If no organizations, create one
    IF org_count = 0 THEN
        -- Call the ensure function from the trigger
        PERFORM public.handle_new_user() FROM auth.users WHERE id = test_user_id;
    END IF;

    RAISE NOTICE 'Fixed user % with email %', test_user_id, user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Also update the trigger to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    org_id uuid;
    org_name text;
    org_slug text;
    base_slug text;
    counter int := 0;
BEGIN
    -- IMPORTANT: Log the incoming data for debugging
    RAISE LOG 'handle_new_user triggered for user %, email: %, metadata: %', 
        new.id, new.email, new.raw_user_meta_data;

    -- Ensure user exists in public.users first
    INSERT INTO public.users (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Check if user already has an organization
    IF EXISTS (
        SELECT 1 FROM public.organization_users 
        WHERE user_id = new.id
        AND status = 'active'
    ) THEN
        RAISE LOG 'User % already has an organization, skipping', new.id;
        RETURN new;
    END IF;

    -- Get business name from metadata or use email
    org_name := COALESCE(
        new.raw_user_meta_data->>'businessName',
        new.raw_user_meta_data->>'business_name',
        new.raw_user_meta_data->>'full_name',
        SPLIT_PART(new.email, '@', 1)
    );
    
    -- Generate base slug from name
    base_slug := LOWER(REGEXP_REPLACE(org_name, '[^a-z0-9]+', '-', 'g'));
    org_slug := base_slug;
    
    -- Ensure slug is unique with a counter approach
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
        counter := counter + 1;
        org_slug := base_slug || '-' || counter;
    END LOOP;

    -- Create organization with all required fields
    INSERT INTO public.organizations (
        name, 
        slug, 
        is_merchant, 
        is_corporate,
        created_by,
        primary_email,
        type
    )
    VALUES (
        org_name, 
        org_slug, 
        true,           -- All new signups are merchants by default
        false,          -- Not corporate by default
        new.id,         -- Set created_by to avoid constraint issues
        new.email,      -- Set primary email
        'business'      -- Default type
    )
    RETURNING id INTO org_id;

    -- Create organization user relationship
    INSERT INTO public.organization_users (
        organization_id, 
        user_id, 
        role, 
        status, 
        joined_at
    )
    VALUES (
        org_id, 
        new.id, 
        'owner', 
        'active', 
        NOW()
    );

    -- Log success
    RAISE LOG 'Successfully created organization % for user %', org_id, new.id;

    RETURN new;
EXCEPTION
    WHEN others THEN
        -- Log the actual error details
        RAISE LOG 'ERROR in handle_new_user for user %: % - %', 
            new.id, SQLERRM, SQLSTATE;
        RAISE LOG 'Error detail: %', SQLERRM;
        
        -- Re-raise the error so we can see it in development
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Quick test/fix for the specific user
DO $$
BEGIN
    -- Fix the specific user mentioned in the error
    PERFORM public.fix_user_organization_access('c2f554b3-f25c-4fb0-bf6f-9268d8a22db0'::uuid);
END $$;