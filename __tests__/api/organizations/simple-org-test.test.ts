import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

describe('Simple Organization Creation Test', () => {
  it('should test organization creation directly', async () => {
    // Use the test user from our seed data
    const testEmail = 'solo@example.com' // User with no org
    const testPassword = 'password123'

    // Create a browser client and sign in
    const supabase = createBrowserClient()
    
    // Sign in as test user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    console.log('Sign in result:', { signInData, signInError })

    if (signInError) {
      throw new Error(`Sign in failed: ${signInError.message}`)
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Current user:', { user, userError })

    if (!user) {
      throw new Error('No user found after sign in')
    }

    // Check if user exists in public.users
    const { data: publicUser, error: publicUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('Public user:', { publicUser, publicUserError })

    // Try to create an organization
    const orgData = {
      name: 'Test Organization',
      slug: `test-org-${Date.now()}`,
      type: 'business',
      is_merchant: true,
      is_corporate: false,
      primary_email: user.email,
      created_by: user.id,
    }

    console.log('Creating organization with data:', orgData)

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert(orgData)
      .select()
      .single()

    console.log('Organization creation result:', { org, orgError })

    // If there's an error, let's debug more
    if (orgError) {
      // Check all INSERT policies on organizations table
      const { data: policies, error: policiesError } = await supabase
        .rpc('get_policies_for_table', { table_name: 'organizations' })

      console.log('All policies for organizations table:', { policies, policiesError })

      // Check if RLS is enabled
      const { data: rlsStatus } = await supabase
        .rpc('get_table_rls_status', { table_name: 'organizations' })

      console.log('RLS status for organizations:', rlsStatus)

      // Check current auth context
      const { data: authContext } = await supabase
        .rpc('get_current_user_id')

      console.log('Current auth.uid() from database:', authContext)
    }

    expect(orgError).toBeNull()
    expect(org).toBeDefined()
  })
})

// Add this SQL function to get all policies for a table
const GET_POLICIES_SQL = `
CREATE OR REPLACE FUNCTION get_policies_for_table(table_name text)
RETURNS TABLE(
  policyname name,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual::text,
    p.with_check::text
  FROM pg_policies p
  WHERE p.tablename = table_name
  AND p.schemaname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`