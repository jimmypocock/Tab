'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugUserPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [orgInfo, setOrgInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchUserData = async () => {
      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setUserInfo({ error: userError?.message || 'No user found' })
        setLoading(false)
        return
      }

      setUserInfo({
        id: user.id,
        email: user.email,
        emailConfirmed: !!user.email_confirmed_at,
        createdAt: user.created_at,
        metadata: user.user_metadata
      })

      // Get organizations
      const { data: orgs, error: orgError } = await supabase
        .from('organization_users')
        .select(`
          *,
          organizations (*)
        `)
        .eq('user_id', user.id)

      setOrgInfo({
        error: orgError?.message,
        organizations: orgs || [],
        count: orgs?.length || 0
      })

      setLoading(false)
    }

    fetchUserData()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">User Debug Information</h1>
        
        <div className="space-y-6">
          {/* User Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </div>

          {/* Organization Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Organization Information</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(orgInfo, null, 2)}
            </pre>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-x-4">
              <a 
                href="/dashboard" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Try Dashboard
              </a>
              <a 
                href="/login" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Login Page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}