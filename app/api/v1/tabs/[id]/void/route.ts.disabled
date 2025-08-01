import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { TabVoidingService } from '@/lib/services/tab-voiding.service'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// Validation schema for voiding
const voidTabSchema = z.object({
  reason: z.string().min(1).max(500),
  closeActiveBillingGroups: z.boolean().optional().default(true),
  voidDraftInvoices: z.boolean().optional().default(true),
  skipValidation: z.boolean().optional().default(false),
})

// Validation schema for restore
const restoreTabSchema = z.object({
  reason: z.string().min(1).max(500),
})

// POST /api/v1/tabs/[id]/void - Void a tab
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    // Parse request body
    const body = await req.json()
    const validation = voidTabSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { reason, skipValidation, ...options } = validation.data

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    // First, validate if voiding is possible (unless skipped)
    if (!skipValidation) {
      const voidingValidation = await TabVoidingService.validateVoiding(
        tabId,
        context.organizationId
      )

      if (!voidingValidation.canVoid) {
        return NextResponse.json(
          { 
            error: 'Cannot void tab',
            blockers: voidingValidation.blockers,
            warnings: voidingValidation.warnings,
            tab: voidingValidation.tab
          },
          { status: 409 }
        )
      }
    }

    // Void the tab
    const auditEntry = await TabVoidingService.voidTab(
      tabId,
      context.organizationId,
      userId,
      reason,
      {
        skipValidation,
        ...options
      }
    )

    return NextResponse.json({
      message: 'Tab voided successfully',
      auditEntry,
    })
  } catch (error: any) {
    logger.error('Error voiding tab', { 
      error, 
      tabId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('Cannot void tab')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      )
    }

    if (error.message && error.message.includes('already voided')) {
      return NextResponse.json(
        { error: 'Tab is already voided' },
        { status: 409 }
      )
    }

    if (error.message && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to void tab' },
      { status: 500 }
    )
  }
})

// PUT /api/v1/tabs/[id]/void - Restore a voided tab
export const PUT = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    // Parse request body
    const body = await req.json()
    const validation = restoreTabSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { reason } = validation.data

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    // Restore the tab
    await TabVoidingService.restoreVoidedTab(
      tabId,
      context.organizationId,
      userId,
      reason
    )

    return NextResponse.json({
      message: 'Tab restored successfully',
    })
  } catch (error: any) {
    logger.error('Error restoring voided tab', { 
      error, 
      tabId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      )
    }

    if (error.message && error.message.includes('not voided')) {
      return NextResponse.json(
        { error: 'Tab is not voided' },
        { status: 409 }
      )
    }

    if (error.message && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to restore tab' },
      { status: 500 }
    )
  }
})

// GET /api/v1/tabs/[id]/void - Get voiding history for a tab
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    const voidingHistory = await TabVoidingService.getVoidingHistory(
      tabId,
      context.organizationId
    )

    return NextResponse.json({
      data: voidingHistory
    })
  } catch (error: any) {
    logger.error('Error getting voiding history', { 
      error, 
      tabId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get voiding history' },
      { status: 500 }
    )
  }
})