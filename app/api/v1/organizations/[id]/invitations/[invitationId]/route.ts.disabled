import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OrganizationService } from '@/lib/services/organization.service'
import { ApiError, UnauthorizedError } from '@/lib/api/errors'

// DELETE /api/v1/organizations/[id]/invitations/[invitationId] - Cancel invitation
export async function DELETE(
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
      throw new UnauthorizedError('You must be an admin to cancel invitations')
    }

    // Check invitation exists and is pending
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id')
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .single()

    if (!invitation) {
      throw new ApiError('Invitation not found or already processed', 404)
    }

    // Update invitation status to cancelled
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', invitationId)

    if (error) {
      throw new ApiError(`Failed to cancel invitation: ${error.message}`, 500)
    }

    return NextResponse.json({ success: true })
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