'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupOrganizationPage() {
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('No user found. Please log in again.')
        return
      }

      // Create organization
      const orgSlug = businessName.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-')
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: businessName,
          slug: orgSlug,
          is_merchant: true,
          is_corporate: false,
        })
        .select()
        .single()

      if (orgError) {
        // If slug already exists, try with a random suffix
        const uniqueSlug = `${orgSlug}-${Math.random().toString(36).substr(2, 4)}`
        const { data: orgRetry, error: retryError } = await supabase
          .from('organizations')
          .insert({
            name: businessName,
            slug: uniqueSlug,
            is_merchant: true,
            is_corporate: false,
          })
          .select()
          .single()

        if (retryError) {
          setError('Failed to create organization. Please try again.')
          return
        }

        // Add user to organization
        const { error: memberError } = await supabase
          .from('organization_users')
          .insert({
            organization_id: orgRetry.id,
            user_id: user.id,
            role: 'owner',
            status: 'active',
            joined_at: new Date().toISOString(),
          })

        if (memberError) {
          setError('Failed to add user to organization. Please contact support.')
          return
        }
      } else {
        // Add user to organization
        const { error: memberError } = await supabase
          .from('organization_users')
          .insert({
            organization_id: org.id,
            user_id: user.id,
            role: 'owner',
            status: 'active',
            joined_at: new Date().toISOString(),
          })

        if (memberError) {
          setError('Failed to add user to organization. Please contact support.')
          return
        }
      }

      // Create merchant record for backward compatibility
      await supabase
        .from('merchants')
        .insert({
          id: user.id,
          email: user.email,
          business_name: businessName,
        })
        .single()
      
      // Don't worry if merchant creation fails - it might already exist

      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Setup
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We need to set up your organization to get started
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSetup}>
          <div>
            <label htmlFor="business-name" className="block text-sm font-medium text-gray-700">
              Business Name
            </label>
            <input
              id="business-name"
              name="business-name"
              type="text"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Your Business Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}