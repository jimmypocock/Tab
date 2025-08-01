import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiKeyService } from '@/lib/services/api-key.service'
import { ApiError, ValidationError, UnauthorizedError } from '@/lib/api/errors'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  scope: z.enum(['merchant', 'corporate', 'full']).optional().default('merchant'),
  environment: z.enum(['test', 'live']).optional().default('test'),
  permissions: z.record(z.any()).optional().default({}),
})

// GET /api/v1/organizations/[id]/api-keys - Get organization API keys
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      throw new ApiError('Organization ID is required', 400)
    }

    const organizationId = params.id
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Get API keys
    const apiKeys = await ApiKeyService.getOrganizationApiKeys(organizationId, user.id)

    return NextResponse.json({
      data: apiKeys,
      meta: {
        total: apiKeys.length,
      },
    })
  } catch (error) {
    logger.error('Failed to get API keys', error as Error, {
      organizationId: params?.id,
    })

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: error.statusCode }
      )
    }
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// POST /api/v1/organizations/[id]/api-keys - Create new API key
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!params?.id) {
      throw new ApiError('Organization ID is required', 400)
    }

    const organizationId = params.id
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = createApiKeySchema.safeParse(body)
    
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
    }

    const validatedData = validation.data

    // Create API key
    const result = await ApiKeyService.createApiKey(organizationId, user.id, validatedData)

    return NextResponse.json({
      data: {
        ...result.apiKey,
        key: result.key, // Only returned on creation
      },
      message: 'API key created successfully',
    }, { status: 201 })
  } catch (error) {
    logger.error('Failed to create API key', error as Error, {
      organizationId: params?.id,
    })

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: error.statusCode }
      )
    }
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}