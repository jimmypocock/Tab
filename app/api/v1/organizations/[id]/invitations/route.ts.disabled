import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { OrganizationService } from '@/lib/services/organization.service'
import { InvitationService } from '@/lib/services/invitation.service'
import { ApiError, UnauthorizedError } from '@/lib/api/errors'

// GET /api/v1/organizations/[id]/invitations - Get pending invitations
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      throw new ApiError('Organization ID is required', 400)
    }

    const organizationId = params.id
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Check if user has admin access to this organization
    const userRole = await OrganizationService.getUserRole(user.id, organizationId)
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new UnauthorizedError('You must be an admin to view invitations')
    }

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        role,
        status,
        message,
        expires_at,
        created_at,
        invited_by,
        users!invitations_invited_by_fkey (
          email,
          raw_user_meta_data
        )
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      throw new ApiError(`Failed to fetch invitations: ${error.message}`, 500)
    }

    // Transform the data
    const transformedInvitations = invitations?.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      message: inv.message,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
      invited_by: {
        id: inv.invited_by,
        email: inv.users?.email || 'Unknown',
        name: inv.users?.raw_user_meta_data?.full_name || inv.users?.email || 'Unknown'
      }
    })) || []

    return NextResponse.json({
      data: transformedInvitations,
      meta: {
        total: transformedInvitations.length,
      },
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

// POST /api/v1/organizations/[id]/invitations - Create new invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      throw new ApiError('Organization ID is required', 400)
    }

    const organizationId = params.id
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Check if user has admin access to this organization
    const userRole = await OrganizationService.getUserRole(user.id, organizationId)
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new UnauthorizedError('You must be an admin to send invitations')
    }

    // Parse request body
    const body = await request.json()
    const inviteSchema = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'member', 'viewer']),
      message: z.string().optional(),
    })

    const validatedData = inviteSchema.parse(body)

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validatedData.email)
      .single()

    if (existingUser) {
      // Check if already a member
      const { data: existingOrgMember } = await supabase
        .from('organization_users')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingUser.id)
        .single()

      if (existingOrgMember) {
        throw new ApiError('This user is already a member of the organization', 400)
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', validatedData.email)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (existingInvitation) {
      throw new ApiError('An invitation has already been sent to this email', 400)
    }

    // Create invitation
    const { invitation, token } = await InvitationService.createInvitation({
      organizationId,
      email: validatedData.email,
      role: validatedData.role,
      invitedBy: user.id,
      message: validatedData.message
    })

    // Get organization details for email
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

    // Send invitation email
    try {
      await InvitationService.sendInvitationEmail({
        email: validatedData.email,
        inviterName,
        organizationName: organization?.name || 'the organization',
        token,
        customMessage: validatedData.message
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the whole operation if email fails
    }

    return NextResponse.json({
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expiresAt,
        created_at: invitation.createdAt,
      },
      message: 'Invitation sent successfully'
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