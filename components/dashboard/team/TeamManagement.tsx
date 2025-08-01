'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/lib/toast/toast-context'
import { 
  Users, 
  UserPlus, 
  Mail, 
  MoreVertical,
  ChevronDown,
  Crown,
  Shield,
  Eye,
  UserCircle,
  Send,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'

interface TeamMember {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'inactive'
  department: string | null
  title: string | null
  joined_at: string
  invited_by: string | null
}

interface Invitation {
  id: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  status: string
  message: string | null
  expires_at: string
  created_at: string
  invited_by: {
    id: string
    email: string
    name: string
  }
}

interface TeamManagementProps {
  organizationId: string
  currentUserId: string
  currentUserRole: 'owner' | 'admin' | 'member' | 'viewer'
}

const roleIcons = {
  owner: <Crown className="h-4 w-4" />,
  admin: <Shield className="h-4 w-4" />,
  member: <UserCircle className="h-4 w-4" />,
  viewer: <Eye className="h-4 w-4" />
}

const roleColors = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800'
}

export function TeamManagement({ organizationId, currentUserId, currentUserRole }: TeamManagementProps) {
  const { showToast } = useToast()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviting, setInviting] = useState(false)

  const canManageTeam = ['owner', 'admin'].includes(currentUserRole)

  useEffect(() => {
    fetchTeamData()
  }, [organizationId])

  const fetchTeamData = async () => {
    try {
      // Fetch team members
      const membersResponse = await fetch(`/api/v1/organizations/${organizationId}/team`)
      if (!membersResponse.ok) throw new Error('Failed to fetch team members')
      const membersData = await membersResponse.json()
      setMembers(membersData.data)

      // Fetch pending invitations
      if (canManageTeam) {
        const invitationsResponse = await fetch(`/api/v1/organizations/${organizationId}/invitations`)
        if (!invitationsResponse.ok) throw new Error('Failed to fetch invitations')
        const invitationsData = await invitationsResponse.json()
        setInvitations(invitationsData.data)
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to load team data',
        description: 'Please try again later'
      })
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async () => {
    setInviting(true)
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          message: inviteMessage
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to send invitation')
      }

      showToast({
        type: 'success',
        title: 'Invitation sent',
        description: 'The invitation has been sent successfully'
      })
      setInviteDialogOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      setInviteMessage('')
      fetchTeamData()
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to send invitation',
        description: error.message
      })
    } finally {
      setInviting(false)
    }
  }

  const updateMemberRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/team/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to update role')
      }

      showToast({
        type: 'success',
        title: 'Role updated',
        description: 'Member role has been updated successfully'
      })
      fetchTeamData()
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to update role',
        description: error.message
      })
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return

    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/team/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to remove member')
      }

      showToast({
        type: 'success',
        title: 'Member removed',
        description: 'Team member has been removed successfully'
      })
      fetchTeamData()
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to remove member',
        description: error.message
      })
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/invitations/${invitationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to cancel invitation')
      }

      showToast({
        type: 'success',
        title: 'Invitation cancelled',
        description: 'The invitation has been cancelled'
      })
      fetchTeamData()
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to cancel invitation',
        description: error.message
      })
    }
  }

  const resendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/invitations/${invitationId}/resend`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to resend invitation')
      }

      showToast({
        type: 'success',
        title: 'Invitation resent',
        description: 'The invitation has been resent successfully'
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to resend invitation',
        description: error.message
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            Manage your organization&apos;s team members and their permissions
          </p>
        </div>
        {canManageTeam && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          {roleIcons.admin}
                          <span>Admin</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex items-center gap-2">
                          {roleIcons.member}
                          <span>Member</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          {roleIcons.viewer}
                          <span>Viewer</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Add a personal message to the invitation..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={sendInvitation}
                  disabled={!inviteEmail || inviting}
                >
                  {inviting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Team Members List */}
      <div className="rounded-md border">
        <div className="p-4">
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {member.full_name || member.email}
                      </p>
                      <Badge className={roleColors[member.role]}>
                        <span className="flex items-center gap-1">
                          {roleIcons[member.role]}
                          {member.role}
                        </span>
                      </Badge>
                      {member.user_id === currentUserId && (
                        <Badge variant="secondary">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    {(member.department || member.title) && (
                      <p className="text-sm text-muted-foreground">
                        {[member.title, member.department].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                  </span>
                  {canManageTeam && member.user_id !== currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => updateMemberRole(member.user_id, 'admin')}
                          disabled={member.role === 'admin'}
                        >
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateMemberRole(member.user_id, 'member')}
                          disabled={member.role === 'member'}
                        >
                          Make Member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateMemberRole(member.user_id, 'viewer')}
                          disabled={member.role === 'viewer'}
                        >
                          Make Viewer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => removeMember(member.user_id)}
                          className="text-destructive"
                        >
                          Remove from Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Invitations */}
      {canManageTeam && invitations.length > 0 && (
        <>
          <div>
            <h3 className="text-lg font-medium">Pending Invitations</h3>
            <p className="text-sm text-muted-foreground">
              Invitations that haven&apos;t been accepted yet
            </p>
          </div>
          <div className="rounded-md border">
            <div className="p-4">
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{invitation.email}</p>
                          <Badge className={roleColors[invitation.role]}>
                            <span className="flex items-center gap-1">
                              {roleIcons[invitation.role]}
                              {invitation.role}
                            </span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Invited by {invitation.invited_by.name} • Expires {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendInvitation(invitation.id)}
                      >
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelInvitation(invitation.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}