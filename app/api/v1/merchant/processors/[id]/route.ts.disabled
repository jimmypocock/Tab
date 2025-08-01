import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  createSuccessResponse,
  createErrorResponse,
  ApiResponseBuilder 
} from '@/lib/api/response'
import { 
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '@/lib/errors'
import { logger } from '@/lib/logger'
import { MerchantProcessorService } from '@/lib/services/merchant-processor.service'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { organizationUsers, organizations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// Schema for updating a processor
const updateProcessorSchema = z.object({
  credentials: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processorId } = await params
    
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get user's organization (for now, use the first active organization)
    const organizationData = await db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.userId, user.id),
        eq(organizationUsers.status, 'active')
      ),
      with: {
        organization: true
      }
    })

    if (!organizationData?.organization) {
      throw new NotFoundError('Organization not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = updateProcessorSchema.safeParse(body)
    
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
    }

    // Update the processor
    const processor = await MerchantProcessorService.updateProcessor(
      organizationData.organization.id,
      processorId,
      validation.data
    )

    return new ApiResponseBuilder()
      .setData(processor)
      .build()
      
  } catch (error) {
    logger.error('Failed to update merchant processor', error as Error)
    return createErrorResponse(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processorId } = await params
    
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get user's organization (for now, use the first active organization)
    const organizationData = await db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.userId, user.id),
        eq(organizationUsers.status, 'active')
      ),
      with: {
        organization: true
      }
    })

    if (!organizationData?.organization) {
      throw new NotFoundError('Organization not found')
    }

    // Delete the processor
    await MerchantProcessorService.deleteProcessor(organizationData.organization.id, processorId)

    return createSuccessResponse({ success: true })
      
  } catch (error) {
    logger.error('Failed to delete merchant processor', error as Error)
    return createErrorResponse(error)
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}