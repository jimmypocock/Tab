/**
 * Organization Team Route - Refactored with DI Pattern
 */

import { NextRequest } from 'next/server'
import { withOwnerDI } from '@/lib/api/di-middleware'
import { ApiResponseBuilder } from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v1/organizations/[id]/team - Get team members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  
  return withOwnerDI(async (context) => {
    // Get team members using service
    const members = await context.organizationService.getTeamMembers(id)

    return new ApiResponseBuilder()
      .setData(members)
      .setCache(CacheConfigs.shortPrivate)
      .build()
  })(request)
}