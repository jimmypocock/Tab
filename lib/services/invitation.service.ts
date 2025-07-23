import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { logger } from '@/lib/logger'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export class InvitationService {
  /**
   * Generate a secure invitation token
   */
  static generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Create an invitation for a new team member
   */
  static async createInvitation({
    organizationId,
    email,
    role,
    invitedBy,
    department,
    title,
    customMessage,
    expiresInDays = 7,
  }: {
    organizationId: string
    email: string
    role: 'admin' | 'member' | 'viewer'
    invitedBy: string
    department?: string
    title?: string
    customMessage?: string
    expiresInDays?: number
  }) {
    const supabase = createAdminClient()
    const token = this.generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Create the invitation record
    const { data: invitation, error } = await supabase
      .from('invitation_tokens')
      .insert({
        organization_id: organizationId,
        email,
        role,
        invited_by: invitedBy,
        token,
        expires_at: expiresAt.toISOString(),
        department,
        title,
        custom_message: customMessage,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating invitation:', error)
      throw error
    }

    return { invitation, token }
  }

  /**
   * Send invitation email
   */
  static async sendInvitationEmail({
    email,
    inviterName,
    organizationName,
    token,
    customMessage,
  }: {
    email: string
    inviterName: string
    organizationName: string
    token: string
    customMessage?: string
  }) {
    if (!resend) {
      logger.debug('Email service not configured', {
        email,
        token,
        action: 'sendInvitation'
      })
      return { success: true, mockMode: true }
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${token}`

    try {
      const { data, error } = await resend.emails.send({
        from: 'Tab <noreply@tab-api.com>',
        to: email,
        subject: `You've been invited to join ${organizationName} on Tab`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to join ${organizationName}</h2>
            <p>${inviterName} has invited you to join their organization on Tab.</p>
            ${customMessage ? `<p><strong>Message from ${inviterName}:</strong><br/>${customMessage}</p>` : ''}
            <p>Click the button below to accept the invitation and create your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              Tab - Payment Collection API Platform
            </p>
          </div>
        `,
      })

      if (error) {
        console.error('Error sending invitation email:', error)
        throw error
      }

      return { success: true, data }
    } catch (error) {
      console.error('Failed to send invitation email:', error)
      throw error
    }
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(token: string, userId: string) {
    const supabase = createAdminClient()

    // Call the database function to accept the invitation
    const { data, error } = await supabase
      .rpc('accept_invitation', {
        p_token: token,
        p_user_id: userId,
      })
      .single()

    if (error) {
      console.error('Error accepting invitation:', error)
      throw error
    }

    return data
  }

  /**
   * Get pending invitations for an organization
   */
  static async getPendingInvitations(organizationId: string) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('pending_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending invitations:', error)
      throw error
    }

    return data
  }

  /**
   * Cancel an invitation
   */
  static async cancelInvitation(invitationId: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('invitation_tokens')
      .delete()
      .eq('id', invitationId)
      .is('accepted_at', null)

    if (error) {
      console.error('Error canceling invitation:', error)
      throw error
    }

    return { success: true }
  }

  /**
   * Resend an invitation
   */
  static async resendInvitation(invitationId: string) {
    const supabase = createAdminClient()

    // Get the invitation details
    const { data: invitation, error: fetchError } = await supabase
      .from('invitation_tokens')
      .select(`
        *,
        organizations (name),
        users!invitation_tokens_invited_by_fkey (email, raw_user_meta_data)
      `)
      .eq('id', invitationId)
      .is('accepted_at', null)
      .single()

    if (fetchError || !invitation) {
      console.error('Error fetching invitation:', fetchError)
      throw fetchError || new Error('Invitation not found')
    }

    // Generate a new token and update expiry
    const newToken = this.generateToken()
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    const { error: updateError } = await supabase
      .from('invitation_tokens')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      throw updateError
    }

    // Send the new invitation email
    const inviterName = invitation.users?.raw_user_meta_data?.full_name || invitation.users?.email || 'A team member'
    await this.sendInvitationEmail({
      email: invitation.email,
      inviterName,
      organizationName: invitation.organizations?.name || 'the organization',
      token: newToken,
      customMessage: invitation.custom_message,
    })

    return { success: true }
  }

  /**
   * Clean up expired invitations (should be called periodically)
   */
  static async cleanupExpiredInvitations() {
    const supabase = createAdminClient()

    const { error } = await supabase.rpc('cleanup_expired_invitations')

    if (error) {
      console.error('Error cleaning up expired invitations:', error)
      throw error
    }

    return { success: true }
  }
}