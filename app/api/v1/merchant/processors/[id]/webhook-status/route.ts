import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { MerchantProcessorService } from '@/lib/services/merchant-processor.service'
import { ApiResponseBuilder } from '@/lib/api/response'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationAuth(request, async (_req: NextRequest, context: OrganizationContext) => {
    try {
      const { id } = await params

      const status = await MerchantProcessorService.verifyWebhookStatus(context.organizationId, id)

      return ApiResponseBuilder.success(status)
    } catch (error: any) {
      logger.error('Failed to check webhook status', error)
      
      if (error.message?.includes('not found')) {
        return ApiResponseBuilder.error('Processor not found', 404)
      }

      return ApiResponseBuilder.error('Failed to check webhook status', 500)
    }
  })
}