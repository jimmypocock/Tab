'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestQueryPage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const runTests = async () => {
      const tests: any = {}

      // Test 1: Get current user
      const { data: { user } } = await supabase.auth.getUser()
      tests.currentUser = user ? { id: user.id, email: user.email } : 'Not logged in'

      if (user) {
        // Test 2: Direct query to organization_users
        const { data: orgUsers, error: orgUsersError } = await supabase
          .from('organization_users')
          .select('*')
          .eq('user_id', user.id)

        tests.organizationUsers = {
          data: orgUsers,
          error: orgUsersError?.message,
          count: orgUsers?.length || 0
        }

        // Test 3: Query with join (same as dashboard)
        const { data: orgUsersWithJoin, error: joinError } = await supabase
          .from('organization_users')
          .select(`
            role,
            status,
            organizations (
              id,
              name,
              slug,
              is_merchant,
              is_corporate
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')

        tests.organizationUsersWithJoin = {
          data: orgUsersWithJoin,
          error: joinError?.message,
          count: orgUsersWithJoin?.length || 0
        }

        // Test 4: Direct query to organizations
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')

        tests.organizations = {
          data: orgs,
          error: orgsError?.message,
          count: orgs?.length || 0
        }

        // Test 5: RPC call to test auth context
        const { data: authContext, error: authError } = await supabase
          .rpc('test_auth_context')

        tests.authContext = {
          data: authContext,
          error: authError?.message
        }
      }

      setResults(tests)
      setLoading(false)
    }

    runTests()
  }, [supabase])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Query Test Results</h1>
      
      <div className="space-y-6">
        {Object.entries(results).map(([testName, result]) => (
          <div key={testName} className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">{testName}</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}