/**
 * Accept Invitation Endpoint
 * 
 * Allows users to accept team invitations using the DI pattern
 */

import { NextRequest } from 'next/server'
import { withSessionAuth } from '@/lib/api/di-middleware'
import { validateInput } from '@/lib/api/validation'
import { ApiResponseBuilder } from '@/lib/api/response'
import { ValidationError, NotFoundError, BusinessRuleError } from '@/lib/errors'
import { z } from 'zod'

// Validation schema
const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  userId: z.string().uuid('Invalid user ID format')
})

/**
 * POST /api/v1/auth/accept-invitation
 * Accept a team invitation
 */
export const POST = withSessionAuth(async (context) => {
  try {
    // Parse and validate request body
    const body = await context.request.json()
    const validation = validateInput(acceptInvitationSchema, body)
    
    if (!validation.success) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError('Invalid request data', validation.errors)
        .build()
    }

    const { token, userId } = validation.data

    // Verify the authenticated user matches the userId
    if (context.user.id !== userId) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only accept invitations for your own account'])
        .build()
    }

    // Get invitation service from DI container
    const invitationService = context.invitationService

    // Accept the invitation
    const result = await invitationService.acceptInvitation(token, userId)

    // Get organization details
    const organizationRepo = context.organizationRepository
    const organization = await organizationRepo.findById(result.organizationId)

    if (!organization) {
      throw new NotFoundError('Organization not found')
    }

    return new ApiResponseBuilder()
      .setData({
        organizationId: result.organizationId,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        role: result.role,
        message: 'Invitation accepted successfully'
      })
      .build()

  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof BusinessRuleError) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError(error.message)
        .build()
    }

    // Log unexpected errors
    const logger = context.logger
    logger.error('Error accepting invitation', error as Error, {
      endpoint: '/api/v1/auth/accept-invitation',
      userId: context.user?.id
    })

    return new ApiResponseBuilder()
      .setStatus(500)
      .setError('Internal server error')
      .build()
  }
})

/**
 * OPTIONS - Handle CORS
 */
export async function OPTIONS(_request: NextRequest) {
  return new ApiResponseBuilder()
    .setStatus(204)
    .build()
}