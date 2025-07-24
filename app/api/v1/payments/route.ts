import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { payments, billingGroups, lineItems } from '@/lib/db/schema'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { parseJsonBody } from '@/lib/api/middleware'
import { createPaymentSchema, validateInput } from '@/lib/api/validation'
import { eq, and, sum, sql } from 'drizzle-orm'
import { 
  createSuccessResponse,
  ApiResponseBuilder 
} from '@/lib/api/response'
import { 
  NotFoundError,
  ValidationError,
  ConflictError,
  DatabaseError
} from '@/lib/errors'
import { logger } from '@/lib/logger'
import { MerchantProcessorService } from '@/lib/services/merchant-processor.service'
import { ProcessorType } from '@/lib/payment-processors/types'

export async function POST(request: NextRequest) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    // Parse and validate request body
    const body = await parseJsonBody(req)
    
    const validation = validateInput(createPaymentSchema, body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
    }

    const data = validation.data

    try {
      // Fetch the tab
      const tab = await db.query.tabs.findFirst({
        where: (tabs, { eq, and }) => 
          and(
            eq(tabs.id, data.tabId),
            eq(tabs.organizationId, context.organizationId)
          ),
      })

      if (!tab) {
        throw new NotFoundError('Tab')
      }

      let targetBalance: number
      let targetName: string
      let billingGroup: any = null

      if (data.billingGroupId) {
        // Billing group payment - validate billing group and calculate its balance
        billingGroup = await db.query.billingGroups.findFirst({
          where: (bg, { eq, and }) => 
            and(
              eq(bg.id, data.billingGroupId),
              eq(bg.tabId, data.tabId)
            ),
        })

        if (!billingGroup) {
          throw new NotFoundError('Billing group not found or does not belong to this tab')
        }

        // Calculate billing group balance
        const lineItemsTotal = await db
          .select({ total: sum(lineItems.total) })
          .from(lineItems)
          .where(eq(lineItems.billingGroupId, data.billingGroupId))
          
        const paidAmount = await db
          .select({ total: sum(payments.amount) })
          .from(payments)
          .where(and(
            eq(payments.billingGroupId, data.billingGroupId),
            eq(payments.status, 'succeeded')
          ))

        const groupTotal = parseFloat(lineItemsTotal[0]?.total || '0')
        const groupPaid = parseFloat(paidAmount[0]?.total || '0')
        targetBalance = groupTotal - groupPaid

        targetName = `billing group "${billingGroup.name}"`

        // Check if billing group is already paid
        if (targetBalance <= 0) {
          throw new ConflictError('Billing group is already paid')
        }

        // For deposit groups, check if payment would exceed deposit + balance
        if (billingGroup.groupType === 'deposit') {
          const depositAvailable = parseFloat(billingGroup.depositAmount || '0') - parseFloat(billingGroup.depositApplied || '0')
          if (data.amount > targetBalance + depositAvailable) {
            throw new ValidationError('Payment amount exceeds billing group balance plus available deposit', [{
              message: `Payment amount ${data.amount.toFixed(2)} exceeds balance ${targetBalance.toFixed(2)} plus available deposit ${depositAvailable.toFixed(2)}`,
              path: ['amount']
            }])
          }
        }

        // For credit groups, check credit limit
        if (billingGroup.groupType === 'credit') {
          const creditLimit = parseFloat(billingGroup.creditLimit || '0')
          const currentBalance = parseFloat(billingGroup.currentBalance || '0')
          const availableCredit = creditLimit - currentBalance
          
          if (data.amount > availableCredit) {
            throw new ValidationError('Payment amount exceeds available credit limit', [{
              message: `Payment amount ${data.amount.toFixed(2)} exceeds available credit ${availableCredit.toFixed(2)}`,
              path: ['amount']
            }])
          }
        }
      } else {
        // Tab-level payment - use existing logic
        targetBalance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
        targetName = 'tab'

        // Check if tab is already paid
        if (targetBalance <= 0) {
          throw new ConflictError('Tab is already paid')
        }
      }

      // Validate payment amount against target balance
      if (data.amount > targetBalance) {
        throw new ValidationError('Payment amount exceeds balance', [{
          message: `Payment amount ${data.amount.toFixed(2)} exceeds ${targetName} balance ${targetBalance.toFixed(2)}`,
          path: ['amount']
        }])
      }

      // Get organization's payment processor (defaulting to Stripe for now)
      const processorType = data.processorType || ProcessorType.STRIPE
      const processor = await MerchantProcessorService.createProcessorInstance(
        context.organizationId,
        processorType,
        context.scope === 'merchant' && context.authType === 'apiKey'
      )

      // Create payment intent with the processor
      const description = billingGroup 
        ? `Payment for ${billingGroup.name} (Tab ${tab.id})`
        : `Payment for Tab ${tab.id}`

      const paymentMetadata = {
        tab_id: tab.id,
        organization_id: context.organizationId,
        customer_email: tab.customerEmail,
        ...(billingGroup && {
          billing_group_id: billingGroup.id,
          billing_group_name: billingGroup.name,
          billing_group_type: billingGroup.groupType,
        }),
        ...data.metadata,
      }

      const paymentIntent = await processor.createPaymentIntent({
        amount: data.amount,
        currency: tab.currency,
        description,
        metadata: paymentMetadata
      })

      // Get the processor configuration to record which one was used
      const processorConfig = await MerchantProcessorService.getProcessor(
        context.organizationId,
        processorType,
        context.scope === 'merchant' && context.authType === 'apiKey'
      )

      // Create payment record
      const [payment] = await db.insert(payments).values({
        tabId: data.tabId,
        billingGroupId: data.billingGroupId || null,
        processorId: processorConfig?.id,
        amount: data.amount.toFixed(2),
        currency: tab.currency,
        status: 'pending',
        processor: processorType,
        processorPaymentId: paymentIntent.processorPaymentId,
        metadata: paymentMetadata,
      }).returning()

      logger.info('Payment created', {
        paymentId: payment?.id,
        tabId: tab.id,
        billingGroupId: data.billingGroupId,
        billingGroupName: billingGroup?.name,
        organizationId: context.organizationId,
        processorType,
        amount: data.amount,
      })

      return new ApiResponseBuilder()
        .setData({
          payment,
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.id, // This would be the actual client secret from Stripe
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
          }
        })
        .setStatusCode(201)
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof ValidationError || 
          error instanceof ConflictError) {
        throw error
      }
      logger.error('Failed to create payment', error as Error, {
        organizationId: context.organizationId,
        tabId: data.tabId,
      })
      throw new DatabaseError('Failed to create payment', error)
    }
  }, {
    requiredScope: 'merchant'
  })
}

export async function GET(request: NextRequest) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    try {
      // Get query parameters
      const { searchParams } = new URL(req.url)
      const tabId = searchParams.get('tab_id')
      const billingGroupId = searchParams.get('billing_group_id')
      const status = searchParams.get('status')
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
      const offset = parseInt(searchParams.get('offset') || '0')

      // Build query conditions
      const conditions = []
      
      if (tabId) {
        // Verify tab belongs to organization
        const tab = await db.query.tabs.findFirst({
          where: (tabs, { eq, and }) => 
            and(
              eq(tabs.id, tabId),
              eq(tabs.organizationId, context.organizationId)
            ),
        })
        
        if (!tab) {
          throw new NotFoundError('Tab')
        }
        
        conditions.push(eq(payments.tabId, tabId))
      }
      
      if (billingGroupId) {
        // Verify billing group belongs to organization's tab
        const billingGroup = await db.query.billingGroups.findFirst({
          where: (bg, { eq }) => eq(bg.id, billingGroupId),
          with: {
            tab: true,
          },
        })
        
        if (!billingGroup || billingGroup.tab?.organizationId !== context.organizationId) {
          throw new NotFoundError('Billing group')
        }
        
        conditions.push(eq(payments.billingGroupId, billingGroupId))
      }
      
      if (status) {
        conditions.push(eq(payments.status, status))
      }

      // Fetch payments with processor and billing group information
      const results = await db.query.payments.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          tab: true,
          billingGroup: true,
          processor: true,
        },
        limit,
        offset,
        orderBy: (payments, { desc }) => [desc(payments.createdAt)],
      })

      // Filter out payments not belonging to organization
      const filteredResults = results.filter(p => 
        p.tab && p.tab.organizationId === context.organizationId
      )

      return new ApiResponseBuilder()
        .setData(filteredResults)
        .setPagination(
          Math.floor(offset / limit) + 1,
          limit,
          filteredResults.length
        )
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Failed to fetch payments', error as Error, {
        organizationId: context.organizationId,
      })
      throw new DatabaseError('Failed to fetch payments', error)
    }
  }, {
    requiredScope: 'merchant'
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}