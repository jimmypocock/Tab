/**
 * Organization Invitation Management Route
 * 
 * Manages individual invitations
 */

import { NextRequest } from 'next/server'
import { withAdminDI } from '@/lib/api/di-middleware'
import { ApiResponseBuilder } from '@/lib/api/response'

interface RouteParams {
  params: Promise<{ id: string; invitationId: string }>
}

/**
 * DELETE /api/v1/organizations/[id]/invitations/[invitationId] - Cancel invitation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, invitationId } = await params
  
  return withAdminDI(async (context) => {
    // Verify the organization matches
    if (context.organizationId !== id) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only manage invitations for your own organization'])
        .build()
    }

    // Cancel invitation using service
    await context.invitationService.cancelInvitation(invitationId)

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