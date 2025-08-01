import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { TabVoidingService } from '@/lib/services/tab-voiding.service'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// Validation schema for bulk voiding
const bulkVoidSchema = z.object({
  tabIds: z.array(z.string().uuid()).min(1).max(20),
  reason: z.string().min(1).max(500),
  closeActiveBillingGroups: z.boolean().optional().default(true),
  voidDraftInvoices: z.boolean().optional().default(true),
  skipValidation: z.boolean().optional().default(false),
})

// POST /api/v1/tabs/bulk-void - Void multiple tabs
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    // Parse request body
    const body = await req.json()
    const validation = bulkVoidSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { tabIds, reason, skipValidation, ...options } = validation.data

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    const results: any[] = []
    const errors: any[] = []

    // Process each tab
    for (const tabId of tabIds) {
      try {
        // First validate if not skipping
        if (!skipValidation) {
          const voidingValidation = await TabVoidingService.validateVoiding(
            tabId,
            context.organizationId
          )

          if (!voidingValidation.canVoid) {
            errors.push({
              tabId,
              status: 'blocked',
              error: 'Cannot void tab',
              blockers: voidingValidation.blockers,
              warnings: voidingValidation.warnings
            })
            continue
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

        results.push({
          tabId,
          status: 'success',
          auditEntry
        })
      } catch (error: any) {
        errors.push({
          tabId,
          status: 'error',
          error: error.message || 'Unknown error'
        })
      }
    }

    // Summary statistics
    const summary = {
      total: tabIds.length,
      succeeded: results.length,
      failed: errors.length,
      blocked: errors.filter(e => e.status === 'blocked').length
    }

    return NextResponse.json({
      message: `Bulk void completed. ${results.length} succeeded, ${errors.length} failed.`,
      summary,
      results,
      errors
    })
  } catch (error: any) {
    logger.error('Error in bulk tab voiding', { 
      error, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to perform bulk void operation' },
      { status: 500 }
    )
  }
})