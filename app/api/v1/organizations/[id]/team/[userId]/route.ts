/**
 * Organization Team Member Route
 * 
 * Manages individual team members within an organization
 */

import { NextRequest } from 'next/server'
import { withAdminDI } from '@/lib/api/di-middleware'
import { validateInput } from '@/lib/api/validation'
import { ApiResponseBuilder } from '@/lib/api/response'
import { ValidationError, BusinessRuleError } from '@/lib/errors'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string; userId: string }>
}

// Validation schemas
const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  department: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
})

/**
 * PUT /api/v1/organizations/[id]/team/[userId] - Update team member
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, userId } = await params
  
  return withAdminDI(async (context) => {
    // Verify the organization matches
    if (context.organizationId !== id) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only manage your own organization'])
        .build()
    }

    // Parse and validate request body
    const body = await context.request.json()
    const validation = validateInput(updateMemberSchema, body)
    
    if (!validation.success) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError('Invalid request data', validation.errors)
        .build()
    }

    // Update team member using service
    const updatedMember = await context.organizationService.updateTeamMember(
      id,
      userId,
      validation.data,
      context.user?.id || ''
    )

    return new ApiResponseBuilder()
      .setData(updatedMember)
      .build()
  })(request)
}

/**
 * DELETE /api/v1/organizations/[id]/team/[userId] - Remove team member
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, userId } = await params
  
  return withAdminDI(async (context) => {
    // Verify the organization matches
    if (context.organizationId !== id) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only manage your own organization'])
        .build()
    }

    // Remove team member using service
    await context.organizationService.removeTeamMember(
      id,
      userId,
      context.user?.id || ''
    )

    return new ApiResponseBuilder()
      .setStatus(204)
      .build()
  })(request)
}

/**
 * OPTIONS - Handle CORS
 */
export async function OPTIONS(_request: NextRequest) {
  return new ApiResponseBuilder()
    .setStatus(204)
    .build()
}