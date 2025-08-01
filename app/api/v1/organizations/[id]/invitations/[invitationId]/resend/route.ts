/**
 * Resend Invitation Route
 * 
 * Resends an existing invitation
 */

import { NextRequest } from 'next/server'
import { withAdminDI } from '@/lib/api/di-middleware'
import { ApiResponseBuilder } from '@/lib/api/response'

interface RouteParams {
  params: Promise<{ id: string; invitationId: string }>
}

/**
 * POST /api/v1/organizations/[id]/invitations/[invitationId]/resend - Resend invitation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, invitationId } = await params
  
  return withAdminDI(async (context) => {
    // Verify the organization matches
    if (context.organizationId !== id) {
      return new ApiResponseBuilder()
        .setStatus(403)
        .setError('Forbidden', ['You can only resend invitations for your own organization'])
        .build()
    }

    // Resend invitation using service
    await context.invitationService.resendInvitation(invitationId)

    return new ApiResponseBuilder()
      .setMessage('Invitation resent successfully')
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