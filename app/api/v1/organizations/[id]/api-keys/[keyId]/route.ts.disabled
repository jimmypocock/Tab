import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiKeyService } from '@/lib/services/api-key.service'
import { ApiError, ValidationError, UnauthorizedError } from '@/lib/api/errors'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const updateApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  isActive: z.boolean().optional(),
  permissions: z.record(z.any()).optional(),
})

// PUT /api/v1/organizations/[id]/api-keys/[keyId] - Update API key
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  try {
    if (!params?.id || !params?.keyId) {
      throw new ApiError('Organization ID and Key ID are required', 400)
    }

    const { id: organizationId, keyId } = params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = updateApiKeySchema.safeParse(body)
    
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
    }

    const validatedData = validation.data

    // Update API key
    const updatedKey = await ApiKeyService.updateApiKey(
      keyId,
      organizationId,
      user.id,
      validatedData
    )

    return NextResponse.json({
      data: updatedKey,
      message: 'API key updated successfully',
    })
  } catch (error) {
    logger.error('Failed to update API key', error as Error, {
      organizationId: params?.id,
      keyId: params?.keyId,
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

// DELETE /api/v1/organizations/[id]/api-keys/[keyId] - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  try {
    if (!params?.id || !params?.keyId) {
      throw new ApiError('Organization ID and Key ID are required', 400)
    }

    const { id: organizationId, keyId } = params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    // Revoke API key
    await ApiKeyService.revokeApiKey(keyId, organizationId, user.id)

    return NextResponse.json({
      message: 'API key revoked successfully',
    })
  } catch (error) {
    logger.error('Failed to revoke API key', error as Error, {
      organizationId: params?.id,
      keyId: params?.keyId,
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