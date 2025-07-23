-- Fix the handle_new_user function to actually work correctly
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

    -- Create user record in public schema FIRST (required for foreign keys)
    INSERT INTO public.users (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO NOTHING;

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
        RAISE LOG 'Error hint: %', SQLERRM;
        
        -- Re-raise the error so we can see it in development
        -- In production, you might want to handle this differently
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Add a function to manually fix users without organizations (for testing)
CREATE OR REPLACE FUNCTION public.fix_user_without_organization(user_email text)
RETURNS void AS $$
DECLARE
    user_record record;
    org_id uuid;
BEGIN
    -- Get the user
    SELECT * INTO user_record 
    FROM auth.users 
    WHERE email = user_email
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Check if they already have an org
    IF EXISTS (
        SELECT 1 FROM public.organization_users 
        WHERE user_id = user_record.id
    ) THEN
        RAISE NOTICE 'User % already has an organization', user_email;
        RETURN;
    END IF;
    
    -- Create org for them
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
        COALESCE(
            user_record.raw_user_meta_data->>'businessName',
            SPLIT_PART(user_email, '@', 1)
        ),
        LOWER(REGEXP_REPLACE(
            COALESCE(
                user_record.raw_user_meta_data->>'businessName',
                SPLIT_PART(user_email, '@', 1)
            ), 
            '[^a-z0-9]+', '-', 'g'
        )) || '-' || SUBSTR(MD5(RANDOM()::text), 1, 6),
        true,
        false,
        user_record.id,
        user_email,
        'business'
    )
    RETURNING id INTO org_id;
    
    -- Create relationship
    INSERT INTO public.organization_users (
        organization_id,
        user_id,
        role,
        status,
        joined_at
    )
    VALUES (
        org_id,
        user_record.id,
        'owner',
        'active',
        NOW()
    );
    
    RAISE NOTICE 'Created organization % for user %', org_id, user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';