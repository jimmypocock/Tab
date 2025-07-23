'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Mail, MoreVertical, Shield, Clock, X } from 'lucide-react'
import { useOrganization } from '@/components/dashboard/organization-context'
import { getTeamMembers, inviteTeamMember, updateMemberRole, removeMember, cancelInvitation, resendInvitation } from './actions'
import { useToast } from '@/lib/toast/toast-context'

type TeamMember = {
  id: string
  user: {
    id: string
    email: string
    full_name?: string
  } | null
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'pending_invitation' | 'suspended'
  department?: string
  title?: string
  joinedAt?: string
  invitedAt?: string
}

const roleDescriptions = {
  owner: 'Full access, can delete organization',
  admin: 'Full access except delete organization',
  member: 'Create/edit tabs, invoices, view reports',
  viewer: 'Read-only access to data'
}

const roleColors = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800'
}

export default function TeamSettingsPage() {
  const { currentOrganization, userRole } = useOrganization()
  const { showToast } = useToast()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)

  const canManageTeam = userRole === 'owner' || userRole === 'admin'

  useEffect(() => {
    loadTeamMembers()
  }, [currentOrganization?.id])

  const loadTeamMembers = async () => {
    if (!currentOrganization?.id) return
    
    setLoading(true)
    try {
      const members = await getTeamMembers(currentOrganization.id)
      setTeamMembers(members)
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to load team members',
        description: 'Please try again later'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!currentOrganization?.id || !inviteEmail) return
    
    setInviting(true)
    try {
      const result = await inviteTeamMember(currentOrganization.id, inviteEmail, inviteRole)
      if (result.error) {
        showToast({
          type: 'error',
          title: 'Failed to send invitation',
          description: result.error
        })
      } else {
        showToast({
          type: 'success',
          title: 'Invitation sent',
          description: `Invitation sent to ${inviteEmail}`
        })
        setShowInviteForm(false)
        setInviteEmail('')
        setInviteRole('member')
        await loadTeamMembers()
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to send invitation',
        description: 'An unexpected error occurred'
      })
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member' | 'viewer') => {
    if (!currentOrganization?.id) return
    
    try {
      const result = await updateMemberRole(currentOrganization.id, memberId, newRole)
      if (result.error) {
        showToast({
          type: 'error',
          title: 'Failed to update role',
          description: result.error
        })
      } else {
        showToast({
          type: 'success',
          title: 'Role updated',
          description: 'Member role has been updated successfully'
        })
        await loadTeamMembers()
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to update role',
        description: 'An unexpected error occurred'
      })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!currentOrganization?.id) return
    
    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return
    }
    
    try {
      const result = await removeMember(currentOrganization.id, memberId)
      if (result.error) {
        showToast({
          type: 'error',
          title: 'Failed to remove member',
          description: result.error
        })
      } else {
        showToast({
          type: 'success',
          title: 'Member removed',
          description: 'Member has been removed from the organization'
        })
        await loadTeamMembers()
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to remove member',
        description: 'An unexpected error occurred'
      })
    }
  }

  const handleCancelInvitation = async (memberId: string) => {
    if (!currentOrganization?.id) return
    
    try {
      const result = await cancelInvitation(currentOrganization.id, memberId)
      if (result.error) {
        showToast({
          type: 'error',
          title: 'Failed to cancel invitation',
          description: result.error
        })
      } else {
        showToast({
          type: 'success',
          title: 'Invitation cancelled',
          description: 'The invitation has been cancelled'
        })
        await loadTeamMembers()
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to cancel invitation',
        description: 'An unexpected error occurred'
      })
    }
  }

  const handleResendInvitation = async (memberId: string) => {
    if (!currentOrganization?.id) return
    
    try {
      const result = await resendInvitation(currentOrganization.id, memberId)
      if (result.error) {
        showToast({
          type: 'error',
          title: 'Failed to resend invitation',
          description: result.error
        })
      } else {
        showToast({
          type: 'success',
          title: 'Invitation resent',
          description: 'The invitation has been resent successfully'
        })
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to resend invitation',
        description: 'An unexpected error occurred'
      })
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
        {canManageTeam && (
          <div className="mt-3 sm:mt-0">
            <button
              onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </button>
          </div>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Team Member</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="admin">Admin - {roleDescriptions.admin}</option>
                <option value="member">Member - {roleDescriptions.member}</option>
                <option value="viewer">Viewer - {roleDescriptions.viewer}</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowInviteForm(false)
                  setInviteEmail('')
                  setInviteRole('member')
                }}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail || inviting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {teamMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No team members</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by inviting team members to your organization.</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {teamMembers.map((member) => (
                  <li key={member.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="h-5 w-5 text-gray-500" />
                          </div>
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.user?.email || 'Pending invitation'}
                            </p>
                            {member.status === 'pending_invitation' && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColors[member.role]}`}>
                              <Shield className="h-3 w-3 mr-1" />
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </span>
                            {member.department && (
                              <span className="ml-2 text-xs text-gray-500">{member.department}</span>
                            )}
                            {member.title && (
                              <span className="ml-2 text-xs text-gray-500">• {member.title}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {canManageTeam && member.role !== 'owner' && (
                        <div className="flex items-center space-x-2">
                          {member.status === 'pending_invitation' ? (
                            <>
                              <button
                                onClick={() => handleResendInvitation(member.id)}
                                className="text-sm text-indigo-600 hover:text-indigo-900"
                              >
                                Resend
                              </button>
                              <button
                                onClick={() => handleCancelInvitation(member.id)}
                                className="text-sm text-red-600 hover:text-red-900"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <div className="relative">
                              <button
                                onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                                className="p-1 rounded-full hover:bg-gray-100"
                              >
                                <MoreVertical className="h-5 w-5 text-gray-400" />
                              </button>
                              {selectedMember === member.id && (
                                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        setSelectedMember(null)
                                        // Open role change dialog
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      Change Role
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedMember(null)
                                        handleRemoveMember(member.id)
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    >
                                      Remove Member
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Role Permissions</h3>
        <dl className="space-y-3">
          {Object.entries(roleDescriptions).map(([role, description]) => (
            <div key={role} className="flex items-start">
              <dt className="flex-shrink-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColors[role as keyof typeof roleColors]}`}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              </dt>
              <dd className="ml-3 text-sm text-gray-600">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}