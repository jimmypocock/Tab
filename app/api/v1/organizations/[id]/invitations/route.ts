/**
 * Organization Invitations Route
 * 
 * Manages invitations for an organization
 */

import { NextRequest } from 'next/server'
import { withAdminDI } from '@/lib/api/di-middleware'
import { validateInput } from '@/lib/api/validation'
import { ApiResponseBuilder } from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Validation schema
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
  message: z.string().optional(),
})

/**
 * GET /api/v1/organizations/[id]/invitations - Get pending invitations
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  return withAdminDI(async (context) => {
    // Verify the organization matches
    if (context.organizationId !== id) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only view invitations for your own organization'])
        .build()
    }

    // Get pending invitations using repository
    const pendingInvitations = await context.organizationRepository.getPendingInvitations(id)

    return new ApiResponseBuilder()
      .setData(pendingInvitations)
      .setMeta({ total: pendingInvitations.length })
      .setCache(CacheConfigs.shortPrivate)
      .build()
  })(request)
}

/**
 * POST /api/v1/organizations/[id]/invitations - Create new invitation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  return withAdminDI(async (context) => {
    // Verify the organization matches
    if (context.organizationId !== id) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only send invitations for your own organization'])
        .build()
    }

    // Parse and validate request body
    const body = await context.request.json()
    const validation = validateInput(createInvitationSchema, body)
    
    if (!validation.success) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError('Invalid request data', validation.errors)
        .build()
    }

    // Create invitation using service
    const invitation = await context.organizationService.inviteMember(
      id,
      context.user?.id || '',
      validation.data
    )

    return new ApiResponseBuilder()
      .setData({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })
      .setMessage('Invitation sent successfully')
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