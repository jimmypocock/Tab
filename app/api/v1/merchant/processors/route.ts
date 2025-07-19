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
import { ProcessorType } from '@/lib/payment-processors/types'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { merchants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Schema for adding a processor
const addProcessorSchema = z.object({
  processorType: z.enum(['stripe', 'square', 'paypal', 'authorize_net']),
  credentials: z.record(z.string(), z.any()),
  isTestMode: z.boolean().default(true),
})

export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get merchant
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, user.id),
    })

    if (!merchant) {
      throw new NotFoundError('Merchant account not found')
    }

    // Get all processors for the merchant
    const processors = await MerchantProcessorService.getMerchantProcessors(merchant.id)

    return new ApiResponseBuilder()
      .setData(processors)
      .build()
      
  } catch (error) {
    logger.error('Failed to get merchant processors', error as Error)
    return createErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get merchant
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, user.id),
    })

    if (!merchant) {
      throw new NotFoundError('Merchant account not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = addProcessorSchema.safeParse(body)
    
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
    }

    const { processorType, credentials, isTestMode } = validation.data

    // Add the processor
    const processor = await MerchantProcessorService.addProcessor(
      merchant.id,
      processorType as ProcessorType,
      credentials,
      isTestMode
    )

    // Get webhook URL for the processor
    const webhookUrl = MerchantProcessorService.getWebhookUrl(processorType as ProcessorType)

    return new ApiResponseBuilder()
      .setData({
        ...processor,
        webhookUrl,
      })
      .setStatusCode(201)
      .build()
      
  } catch (error) {
    logger.error('Failed to add merchant processor', error as Error)
    return createErrorResponse(error)
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}