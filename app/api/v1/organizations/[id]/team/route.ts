import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OrganizationService } from '@/lib/services/organization.service'
import { ApiError, NotFoundError, UnauthorizedError } from '@/lib/api/errors'

// GET /api/v1/organizations/[id]/team - Get team members
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

    // Check if user has access to this organization
    const { hasAccess } = await OrganizationService.checkUserAccess(user.id, organizationId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this organization')
    }

    // Get team members with user details
    const { data: members, error } = await supabase
      .from('organization_users')
      .select(`
        id,
        user_id,
        role,
        status,
        department,
        title,
        joined_at,
        invited_by,
        users!inner (
          email,
          raw_user_meta_data
        )
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false })

    if (error) {
      throw new ApiError(`Failed to fetch team members: ${error.message}`, 500)
    }

    // Transform the data to include user info at top level
    const transformedMembers = members?.map(member => ({
      id: member.id,
      user_id: member.user_id,
      email: member.users.email,
      full_name: member.users.raw_user_meta_data?.full_name || null,
      role: member.role,
      status: member.status,
      department: member.department,
      title: member.title,
      joined_at: member.joined_at,
      invited_by: member.invited_by,
    })) || []

    return NextResponse.json({
      data: transformedMembers,
      meta: {
        total: transformedMembers.length,
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