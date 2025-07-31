'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast/toast-context'
import Link from 'next/link'

export default function NewOrganizationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'business',
    is_merchant: true,
    is_corporate: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      showToast({
        type: 'error',
        title: 'Organization name is required',
        description: 'Please enter a name for your organization'
      })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Create organization with proper RLS
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .concat('-', Date.now().toString())

      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.name,
          slug,
          type: formData.type,
          is_merchant: formData.is_merchant,
          is_corporate: formData.is_corporate,
          primary_email: user.email,
          created_by: user.id, // This matches auth.uid() due to our trigger
        })
        .select()
        .single()

      if (orgError) {
        console.error('Error creating organization:', orgError)
        throw new Error(orgError.message || 'Failed to create organization')
      }

      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: organization.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        })

      if (memberError) {
        console.error('Error adding user to organization:', memberError)
        // Try to clean up the organization
        await supabase.from('organizations').delete().eq('id', organization.id)
        throw new Error('Failed to add you to the organization')
      }

      showToast({
        type: 'success',
        title: 'Organization created!',
        description: 'Taking you to your dashboard...'
      })

      // Redirect to dashboard
      router.push(`/dashboard?org=${organization.id}`)
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to create organization',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/organizations"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to organizations
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center mb-6">
            <div className="bg-indigo-100 rounded-full p-3 mr-4">
              <Building2 className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Create your organization
              </h1>
              <p className="text-gray-600">
                Set up your business to start accepting payments
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Acme Corporation"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                This is how your business will appear to customers
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Organization Type
              </label>
              <div className="space-y-4">
                <label className="relative flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="orgType"
                    value="merchant"
                    checked={formData.is_merchant && !formData.is_corporate}
                    onChange={() => setFormData({ 
                      ...formData, 
                      is_merchant: true, 
                      is_corporate: false 
                    })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Merchant</span>
                    <p className="text-sm text-gray-500">
                      Accept payments from customers, create tabs and invoices
                    </p>
                  </div>
                </label>

                <label className="relative flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="orgType"
                    value="corporate"
                    checked={!formData.is_merchant && formData.is_corporate}
                    onChange={() => setFormData({ 
                      ...formData, 
                      is_merchant: false, 
                      is_corporate: true 
                    })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Corporate Account</span>
                    <p className="text-sm text-gray-500">
                      Manage employee expenses and pay merchant tabs centrally
                    </p>
                  </div>
                </label>

                <label className="relative flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="orgType"
                    value="both"
                    checked={formData.is_merchant && formData.is_corporate}
                    onChange={() => setFormData({ 
                      ...formData, 
                      is_merchant: true, 
                      is_corporate: true 
                    })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Both</span>
                    <p className="text-sm text-gray-500">
                      Accept payments and manage corporate expenses
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Link
                href="/organizations"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}