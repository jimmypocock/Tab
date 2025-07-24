import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { logger } from '@/lib/logger'

// Validation schemas
const createBillingGroupSchema = z.object({
  tab_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  group_type: z.enum(['company', 'personal', 'department', 'insurance', 'grant', 'master', 'guest', 'group', 'project', 'split']),
  payer_organization_id: z.string().uuid().optional(),
  payer_email: z.string().email().optional(),
  credit_limit: z.number().positive().optional(),
  deposit_amount: z.number().positive().optional(),
  authorization_code: z.string().optional(),
  po_number: z.string().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(data => data.tab_id || data.invoice_id, {
  message: 'Either tab_id or invoice_id must be provided',
})

const querySchema = z.object({
  tab_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  include_rules: z.string().transform(v => v === 'true').optional(),
  include_line_items: z.string().transform(v => v === 'true').optional(),
})

// GET /api/v1/billing-groups - List billing groups
export const GET = withApiAuth(async (req, context) => {
  try {
    const { searchParams } = new URL(req.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))
    
    if (!query.tab_id && !query.invoice_id) {
      return NextResponse.json(
        { error: 'Either tab_id or invoice_id must be provided' },
        { status: 400 }
      )
    }
    
    const billingGroups = await BillingGroupService.getBillingGroups({
      tabId: query.tab_id,
      invoiceId: query.invoice_id,
      includeRules: query.include_rules,
      includeLineItems: query.include_line_items,
    })
    
    return NextResponse.json({ billing_groups: billingGroups })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error fetching billing groups', { error, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to fetch billing groups' },
      { status: 500 }
    )
  }
})

// POST /api/v1/billing-groups - Create a billing group
export const POST = withApiAuth(async (req, context) => {
  try {
    const body = await req.json()
    const validatedData = createBillingGroupSchema.parse(body)
    
    // TODO: Verify organization has access to the tab/invoice
    // This would involve checking that the tab/invoice belongs to the organization
    
    const billingGroup = await BillingGroupService.createBillingGroup({
      tabId: validatedData.tab_id,
      invoiceId: validatedData.invoice_id,
      name: validatedData.name,
      groupType: validatedData.group_type,
      payerOrganizationId: validatedData.payer_organization_id,
      payerEmail: validatedData.payer_email,
      creditLimit: validatedData.credit_limit?.toString(),
      depositAmount: validatedData.deposit_amount?.toString(),
      authorizationCode: validatedData.authorization_code,
      poNumber: validatedData.po_number,
      metadata: validatedData.metadata,
    })
    
    return NextResponse.json({ billing_group: billingGroup }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error creating billing group', { error, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to create billing group' },
      { status: 500 }
    )
  }
})