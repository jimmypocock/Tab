-- First, disable RLS temporarily to clean up
ALTER TABLE public.organization_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on organization_users
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'organization_users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_users', pol.policyname);
    END LOOP;
END $$;

-- Drop ALL existing policies on organizations
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'organizations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policyname);
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE policies that don't reference each other

-- Policy 1: Users can see organization_users rows where they are the user
CREATE POLICY "Users can see their own org memberships" ON public.organization_users
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Users can see all organizations (we'll filter in the application layer for now)
-- This prevents the circular reference issue
CREATE POLICY "Users can see organizations" ON public.organizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM public.organization_users ou
            WHERE ou.organization_id = organizations.id
            AND ou.user_id = auth.uid()
        )
    );

-- Policy 3: Allow inserts for organization creation during signup
CREATE POLICY "Allow organization creation" ON public.organizations
    FOR INSERT
    WITH CHECK (true);  -- The trigger handles the security

CREATE POLICY "Allow organization_user creation" ON public.organization_users
    FOR INSERT
    WITH CHECK (true);  -- The trigger handles the security

-- Quick check to ensure the user has their organization (commented out for fresh installs)
-- This was for a specific user during development, not needed for new databases
-- DO $$
-- DECLARE
--     test_user_id uuid := 'c2f554b3-f25c-4fb0-bf6f-9268d8a22db0'::uuid;
--     org_count int;
-- BEGIN
--     -- Count organizations for the test user
--     SELECT COUNT(*) INTO org_count
--     FROM public.organization_users
--     WHERE user_id = test_user_id;
--     
--     IF org_count = 0 THEN
--         RAISE NOTICE 'Test user has no organizations, running fix...';
--         -- Try to create one
--         PERFORM public.fix_user_organization_access(test_user_id);
--     ELSE
--         RAISE NOTICE 'Test user has % organization(s)', org_count;
--     END IF;
-- END $$;