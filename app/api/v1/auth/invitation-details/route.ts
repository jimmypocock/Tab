/**
 * Invitation Details Endpoint
 * 
 * Retrieves details about an invitation token
 */

import { NextRequest } from 'next/server'
import { withPublicAccess } from '@/lib/api/di-middleware'
import { ApiResponseBuilder } from '@/lib/api/response'
import { NotFoundError } from '@/lib/errors'
import { z } from 'zod'

// Validation schema
const invitationDetailsSchema = z.object({
  token: z.string().min(1, 'Token is required')
})

/**
 * GET /api/v1/auth/invitation-details
 * Get invitation details by token
 */
export const GET = withPublicAccess(async (context) => {
  try {
    // Parse and validate query parameters
    const searchParams = context.request.nextUrl.searchParams
    const token = searchParams.get('token')
    
    const validation = invitationDetailsSchema.safeParse({ token })
    
    if (!validation.success) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError('Invalid request parameters', validation.error.errors.map(e => e.message))
        .build()
    }

    // Get invitation service from DI container
    const invitationService = context.invitationService

    // Get invitation details
    const details = await invitationService.getInvitationDetails(validation.data.token)

    return new ApiResponseBuilder()
      .setData(details)
      .build()

  } catch (error) {
    if (error instanceof NotFoundError) {
      return new ApiResponseBuilder()
        .setStatus(404)
        .setError(error.message)
        .build()
    }

    // Log unexpected errors
    const logger = context.logger
    logger.error('Error fetching invitation details', error as Error, {
      endpoint: '/api/v1/auth/invitation-details'
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