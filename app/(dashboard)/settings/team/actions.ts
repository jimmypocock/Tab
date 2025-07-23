'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { InvitationService } from '@/lib/services/invitation.service'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
})

export async function getTeamMembers(organizationId: string) {
  const supabase = await createClient()
  
  // Get current user to check permissions
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get team members with user details
  const { data: members, error } = await supabase
    .from('organization_users')
    .select(`
      id,
      role,
      status,
      department,
      title,
      joined_at,
      invited_at,
      users!organization_users_user_id_fkey (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('organization_id', organizationId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching team members:', error)
    throw error
  }
  
  // Transform the data to match our component's expected structure
  return members.map(member => ({
    id: member.id,
    user: member.users ? {
      id: member.users.id,
      email: member.users.email,
      full_name: member.users.raw_user_meta_data?.full_name
    } : null,
    role: member.role,
    status: member.status,
    department: member.department,
    title: member.title,
    joinedAt: member.joined_at,
    invitedAt: member.invited_at,
  }))
}

export async function inviteTeamMember(
  organizationId: string, 
  email: string, 
  role: 'admin' | 'member' | 'viewer'
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    
    // Check if user has permission to invite (must be owner or admin)
    const { data: currentUserMembership } = await supabase
      .from('organization_users')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()
    
    if (!currentUserMembership || !['owner', 'admin'].includes(currentUserMembership.role)) {
      return { error: 'You do not have permission to invite team members' }
    }
    
    // Validate input
    const validation = inviteSchema.safeParse({ email, role })
    if (!validation.success) {
      return { error: 'Invalid email or role' }
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    
    if (existingUser) {
      // Check if already a member
      const { data: existingMembership } = await supabase
        .from('organization_users')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingUser.id)
        .single()
      
      if (existingMembership) {
        return { error: 'User is already a member of this organization' }
      }
      
      // Add existing user to organization
      const { error: addError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: organizationId,
          user_id: existingUser.id,
          role,
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          status: 'active',
        })
      
      if (addError) {
        console.error('Error adding user to organization:', addError)
        return { error: 'Failed to add user to organization' }
      }
    } else {
      // User doesn't exist - create invitation
      try {
        // Get organization details for the email
        const { data: organization } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single()
        
        // Get inviter details
        const { data: inviter } = await supabase
          .from('users')
          .select('email, raw_user_meta_data')
          .eq('id', user.id)
          .single()
        
        const inviterName = inviter?.raw_user_meta_data?.full_name || inviter?.email || 'A team member'
        
        // Create invitation with token
        const { invitation, token } = await InvitationService.createInvitation({
          organizationId,
          email,
          role,
          invitedBy: user.id,
        })
        
        // Send invitation email
        await InvitationService.sendInvitationEmail({
          email,
          inviterName,
          organizationName: organization?.name || 'the organization',
          token,
        })
        
        // Create a pending organization_users record
        const { error: placeholderError } = await supabase
          .from('organization_users')
          .insert({
            organization_id: organizationId,
            user_id: user.id, // Temporary - will be updated when invitation is accepted
            role,
            invited_by: user.id,
            invited_at: new Date().toISOString(),
            invitation_token_id: invitation.id,
            status: 'pending_invitation',
          })
        
        if (placeholderError) {
          console.error('Error creating placeholder record:', placeholderError)
          // Don't return error as invitation was created successfully
        }
      } catch (error) {
        console.error('Error creating invitation:', error)
        return { error: 'Failed to create and send invitation' }
      }
    }
    
    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error inviting team member:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  newRole: 'admin' | 'member' | 'viewer'
) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    
    // Check if user has permission (must be owner or admin)
    const { data: currentUserMembership } = await supabase
      .from('organization_users')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()
    
    if (!currentUserMembership || !['owner', 'admin'].includes(currentUserMembership.role)) {
      return { error: 'You do not have permission to update member roles' }
    }
    
    // Can't change owner role
    const { data: targetMember } = await supabase
      .from('organization_users')
      .select('role')
      .eq('id', memberId)
      .single()
    
    if (targetMember?.role === 'owner') {
      return { error: 'Cannot change the role of the organization owner' }
    }
    
    // Update the role
    const { error: updateError } = await supabase
      .from('organization_users')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
    
    if (updateError) {
      console.error('Error updating member role:', updateError)
      return { error: 'Failed to update member role' }
    }
    
    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error updating member role:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function removeMember(organizationId: string, memberId: string) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    
    // Check if user has permission (must be owner or admin)
    const { data: currentUserMembership } = await supabase
      .from('organization_users')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()
    
    if (!currentUserMembership || !['owner', 'admin'].includes(currentUserMembership.role)) {
      return { error: 'You do not have permission to remove team members' }
    }
    
    // Can't remove owner
    const { data: targetMember } = await supabase
      .from('organization_users')
      .select('role')
      .eq('id', memberId)
      .single()
    
    if (targetMember?.role === 'owner') {
      return { error: 'Cannot remove the organization owner' }
    }
    
    // Remove the member
    const { error: deleteError } = await supabase
      .from('organization_users')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organizationId)
    
    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return { error: 'Failed to remove member' }
    }
    
    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error removing member:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function cancelInvitation(organizationId: string, memberId: string) {
  // For now, this is the same as removing a member
  // In a real implementation, you'd cancel the invitation token
  return removeMember(organizationId, memberId)
}

export async function resendInvitation(organizationId: string, memberId: string) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    
    // Check if user has permission
    const { data: currentUserMembership } = await supabase
      .from('organization_users')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()
    
    if (!currentUserMembership || !['owner', 'admin'].includes(currentUserMembership.role)) {
      return { error: 'You do not have permission to resend invitations' }
    }
    
    // Get the invitation details
    const { data: member } = await supabase
      .from('organization_users')
      .select('*, invitation_token_id')
      .eq('id', memberId)
      .eq('status', 'pending_invitation')
      .single()
    
    if (!member || !member.invitation_token_id) {
      return { error: 'Invitation not found' }
    }
    
    // Resend the invitation using the service
    await InvitationService.resendInvitation(member.invitation_token_id)
    
    return { success: true }
  } catch (error) {
    console.error('Error resending invitation:', error)
    return { error: 'An unexpected error occurred' }
  }
}