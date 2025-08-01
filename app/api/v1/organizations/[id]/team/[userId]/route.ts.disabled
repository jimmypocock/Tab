import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { OrganizationService } from '@/lib/services/organization.service'
import { ApiError, NotFoundError, UnauthorizedError } from '@/lib/api/errors'

// PUT /api/v1/organizations/[id]/team/[userId] - Update team member
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    if (!params?.id || !params?.userId) {
      throw new ApiError('Organization ID and User ID are required', 400)
    }

    const organizationId = params.id
    const targetUserId = params.userId
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Check if user has admin access to this organization
    const userRole = await OrganizationService.getUserRole(user.id, organizationId)
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new UnauthorizedError('You must be an admin to update team members')
    }

    // Parse request body
    const body = await request.json()
    const updateSchema = z.object({
      role: z.enum(['admin', 'member', 'viewer']).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      department: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
    })

    const validatedData = updateSchema.parse(body)

    // Prevent demoting the last owner
    if (validatedData.role && validatedData.role !== 'owner') {
      const { data: targetMember } = await supabase
        .from('organization_users')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', targetUserId)
        .single()

      if (targetMember?.role === 'owner') {
        const { data: owners } = await supabase
          .from('organization_users')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('role', 'owner')
          .eq('status', 'active')

        if (owners?.length === 1 && owners[0].user_id === targetUserId) {
          throw new ApiError('Cannot demote the last owner of the organization', 400)
        }
      }
    }

    // Update the team member
    const { data: updatedMember, error } = await supabase
      .from('organization_users')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('user_id', targetUserId)
      .select()
      .single()

    if (error) {
      throw new ApiError(`Failed to update team member: ${error.message}`, 500)
    }

    if (!updatedMember) {
      throw new NotFoundError('Team member')
    }

    return NextResponse.json({ data: updatedMember })
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

// DELETE /api/v1/organizations/[id]/team/[userId] - Remove team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    if (!params?.id || !params?.userId) {
      throw new ApiError('Organization ID and User ID are required', 400)
    }

    const organizationId = params.id
    const targetUserId = params.userId
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Check if user has admin access to this organization
    const userRole = await OrganizationService.getUserRole(user.id, organizationId)
    if (!userRole || !['owner', 'admin'].includes(userRole)) {
      throw new UnauthorizedError('You must be an admin to remove team members')
    }

    // Prevent removing yourself
    if (targetUserId === user.id) {
      throw new ApiError('You cannot remove yourself from the organization', 400)
    }

    // Prevent removing the last owner
    const { data: member } = await supabase
      .from('organization_users')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', targetUserId)
      .single()

    if (member?.role === 'owner') {
      const { data: owners } = await supabase
        .from('organization_users')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .eq('status', 'active')

      if (owners?.length === 1) {
        throw new ApiError('Cannot remove the last owner of the organization', 400)
      }
    }

    // Remove the team member
    const { error } = await supabase
      .from('organization_users')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', targetUserId)

    if (error) {
      throw new ApiError(`Failed to remove team member: ${error.message}`, 500)
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