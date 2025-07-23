-- Check if RLS is enabled on users table and fix policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on users table
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- Create simple policy for users table
-- Users can see all user records (we'll filter sensitive data in the query)
CREATE POLICY "Users can see user records" ON public.users
    FOR SELECT
    USING (true);

-- Users can only update their own record
CREATE POLICY "Users can update own record" ON public.users
    FOR UPDATE
    USING (id = auth.uid());

-- Users can insert their own record (for signup)
CREATE POLICY "Users can insert own record" ON public.users
    FOR INSERT
    WITH CHECK (id = auth.uid());