import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// GET /api/v1/tabs/:id/billing-summary - Get billing summary for a tab
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    // Verify tab exists and belongs to organization
    const [tab] = await db
      .select({
        id: tabs.id,
        organizationId: tabs.organizationId,
        totalAmount: tabs.totalAmount,
        status: tabs.status,
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
    
    // Get billing summary
    const summary = await BillingGroupService.getTabBillingSummary(tabId)
    
    return NextResponse.json({
      tab_id: tabId,
      tab_status: tab.status,
      tab_total: parseFloat(tab.totalAmount),
      billing_summary: {
        groups: summary.groups.map(g => ({
          billing_group: {
            id: g.billingGroup.id,
            name: g.billingGroup.name,
            type: g.billingGroup.groupType,
            status: g.billingGroup.status,
            payer_email: g.billingGroup.payerEmail,
            payer_organization_id: g.billingGroup.payerOrganizationId,
            credit_limit: g.billingGroup.creditLimit ? parseFloat(g.billingGroup.creditLimit) : null,
            current_balance: parseFloat(g.billingGroup.currentBalance || '0'),
            deposit_amount: g.billingGroup.depositAmount ? parseFloat(g.billingGroup.depositAmount) : 0,
            deposit_applied: g.billingGroup.depositApplied ? parseFloat(g.billingGroup.depositApplied) : 0,
          },
          line_items_count: g.lineItems.length,
          total: g.total,
          deposit_remaining: g.depositRemaining,
        })),
        unassigned_items: summary.unassignedItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: parseFloat(item.unitPrice),
          total: parseFloat(item.total),
        })),
        unassigned_count: summary.unassignedItems.length,
        total_amount: summary.totalAmount,
      },
    })
  } catch (error) {
    logger.error('Error fetching billing summary', { error, tabId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to fetch billing summary' },
      { status: 500 }
    )
  }
})