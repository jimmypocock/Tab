'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, Mail, ArrowRight, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast/toast-context'
import Link from 'next/link'

type PendingInvitation = {
  id: string
  organization: {
    id: string
    name: string
    slug: string
  }
  role: string
  expires_at: string
  invited_by: {
    email: string
  }
}

export default function OrganizationSelectionPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [existingOrganizations, setExistingOrganizations] = useState<any[]>([])
  const [acceptingInvitation, setAcceptingInvitation] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check if user already has organizations
      const { data: userOrgs } = await supabase
        .from('organization_users')
        .select(`
          organization:organizations (
            id,
            name,
            slug,
            type
          ),
          role
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (userOrgs && userOrgs.length > 0) {
        setExistingOrganizations(userOrgs)
      }

      // Get pending invitations
      const { data: invitations } = await supabase
        .from('invitation_tokens')
        .select(`
          id,
          organization:organizations (
            id,
            name,
            slug
          ),
          role,
          expires_at,
          invited_by:users!invited_by (
            email
          )
        `)
        .eq('email', user.email!)
        .is('accepted_at', null)
        .gte('expires_at', new Date().toISOString())

      if (invitations) {
        setPendingInvitations(invitations as any)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    setAcceptingInvitation(invitation.id)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Get the invitation token
      const { data: invitationData } = await supabase
        .from('invitation_tokens')
        .select('token')
        .eq('id', invitation.id)
        .single()

      if (!invitationData) {
        throw new Error('Invitation not found')
      }

      const response = await fetch(`/api/v1/auth/accept-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: invitationData.token,
          userId: user.id 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      showToast({
        type: 'success',
        title: 'Invitation accepted!',
        description: 'You\'ve been added to the organization.'
      })

      // Reload the page to update the UI
      await loadData()
      
      // If this was their first org, redirect to dashboard
      if (existingOrganizations.length === 0) {
        router.push('/dashboard')
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to accept invitation',
        description: error.message
      })
    } finally {
      setAcceptingInvitation(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">
            {existingOrganizations.length > 0 
              ? 'Your Organizations' 
              : 'Welcome! Let\'s get you set up.'}
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            {existingOrganizations.length > 0 
              ? 'Select an organization or create a new one.' 
              : 'Create your first organization or join an existing one.'}
          </p>
        </div>

        {/* Existing Organizations */}
        {existingOrganizations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Organizations</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {existingOrganizations.map((org) => (
                <Link
                  key={org.organization.id}
                  href={`/dashboard?org=${org.organization.id}`}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {org.organization.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {org.role} • {org.organization.type}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Invitations</h2>
            <div className="space-y-4">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="bg-white rounded-lg shadow p-6 border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-indigo-100 rounded-full p-3">
                        <Mail className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {invitation.organization.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Invited by {invitation.invited_by?.email || 'a team member'} as {invitation.role}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcceptInvitation(invitation)}
                      disabled={acceptingInvitation === invitation.id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {acceptingInvitation === invitation.id ? 'Accepting...' : 'Accept Invitation'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Organization */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/organizations/new"
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-8 border border-gray-200 text-center group"
          >
            <div className="bg-indigo-100 rounded-full p-4 inline-flex mb-4 group-hover:bg-indigo-200 transition-colors">
              <Building2 className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Create a new organization
            </h3>
            <p className="text-sm text-gray-600">
              Start accepting payments for your business
            </p>
            <div className="mt-4 inline-flex items-center text-indigo-600 font-medium">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </Link>

          <div className="bg-gray-100 rounded-lg p-8 border border-gray-200 text-center">
            <div className="bg-gray-200 rounded-full p-4 inline-flex mb-4">
              <Users className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Join an existing organization
            </h3>
            <p className="text-sm text-gray-600">
              Ask your administrator to send you an invitation to collaborate
            </p>
          </div>
        </div>

        {/* Sign out option */}
        <div className="mt-12 text-center">
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}