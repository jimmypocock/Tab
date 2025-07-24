import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schema
const enableBillingGroupsSchema = z.object({
  template: z.enum(['hotel', 'restaurant', 'corporate', 'custom']).optional(),
  default_groups: z.array(z.object({
    name: z.string(),
    type: z.enum(['standard', 'corporate', 'deposit', 'credit']),
  })).optional(),
})

// POST /api/v1/tabs/:id/enable-billing-groups - Enable billing groups for a tab
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    const body = await req.json().catch(() => ({}))
    const validatedData = enableBillingGroupsSchema.parse(body)
    
    // Verify tab exists and belongs to organization
    const [tab] = await db
      .select({
        id: tabs.id,
        organizationId: tabs.organizationId,
      })
      .from(tabs)
      .where(eq(tabs.id, tabId))
      .limit(1)
    
    if (!tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      )
    }
    
    if (tab.organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Check if billing groups already exist for this tab
    const existingGroups = await BillingGroupService.getTabBillingGroups(tabId)
    if (existingGroups.length > 0) {
      return NextResponse.json(
        { error: 'Billing groups already enabled for this tab' },
        { status: 400 }
      )
    }
    
    // Enable billing groups with optional template
    const groups = await BillingGroupService.enableBillingGroups(tabId, {
      template: validatedData.template,
      defaultGroups: validatedData.default_groups,
    })
    
    return NextResponse.json({
      message: 'Billing groups enabled successfully',
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        type: g.groupType,
        status: g.status,
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error enabling billing groups', { error, tabId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to enable billing groups' },
      { status: 500 }
    )
  }
})