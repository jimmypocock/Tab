import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OrganizationService } from '@/lib/services/organization.service'
import { InvitationService } from '@/lib/services/invitation.service'
import { ApiError, UnauthorizedError } from '@/lib/api/errors'

// POST /api/v1/organizations/[id]/invitations/[invitationId]/resend - Resend invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    if (!params?.id || !params?.invitationId) {
      throw new ApiError('Organization ID and Invitation ID are required', 400)
    }

    const organizationId = params.id
    const invitationId = params.invitationId
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Check if user has admin access to this organization
    const userRole = await OrganizationService.getUserRole(user.id, organizationId)
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new UnauthorizedError('You must be an admin to resend invitations')
    }

    // Get invitation details
    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .single()

    if (!invitation) {
      throw new ApiError('Invitation not found or already processed', 404)
    }

    // Get organization details for email
    const { data: organization } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    // Get current user details as the new inviter
    const { data: inviter } = await supabase
      .from('users')
      .select('email, raw_user_meta_data')
      .eq('id', user.id)
      .single()

    const inviterName = inviter?.raw_user_meta_data?.full_name || inviter?.email || 'A team member'

    // Resend invitation email
    await InvitationService.sendInvitationEmail({
      email: invitation.email,
      inviterName,
      organizationName: organization?.name || 'the organization',
      token: invitation.token,
      customMessage: invitation.message
    })

    return NextResponse.json({ 
      success: true,
      message: 'Invitation resent successfully'
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: error.statusCode }
      )
    }
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}