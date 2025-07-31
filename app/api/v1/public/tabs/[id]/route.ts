import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { 
  ApiResponseBuilder 
} from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { NotFoundError, DatabaseError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { calculateTabBalance } from '@/lib/utils/index'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params
  
  try {
    // Fetch tab with merchant info and billing groups (no auth required for public payment page)
    const result = await db.query.tabs.findFirst({
      where: eq(tabs.id, id),
      with: {
        lineItems: {
          orderBy: (lineItems, { asc }) => [asc(lineItems.createdAt)],
        },
        merchant: {
          columns: {
            id: true,
            email: true,
            businessName: true,
            // Don't expose sensitive merchant data
          },
        },
        billingGroups: {
          where: (billingGroups, { eq }) => eq(billingGroups.status, 'active'),
          orderBy: (billingGroups, { asc }) => [asc(billingGroups.groupNumber)],
        },
      },
    })

    if (!result) {
      throw new NotFoundError('Tab not found')
    }

    // Calculate balance for display
    const balanceDue = calculateTabBalance(result.totalAmount, result.paidAmount)

    // Only return necessary data for payment page
    const publicTab = {
      id: result.id,
      customerEmail: result.customerEmail,
      customerName: result.customerName,
      subtotal: result.subtotal,
      taxAmount: result.taxAmount,
      totalAmount: result.totalAmount,
      paidAmount: result.paidAmount,
      balanceDue,
      status: result.status,
      currency: result.currency,
      metadata: result.metadata,
      lineItems: result.lineItems.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        billingGroupId: item.billingGroupId,
      })),
      billingGroups: result.billingGroups?.map(group => ({
        id: group.id,
        name: group.name,
        groupNumber: group.groupNumber,
        groupType: group.groupType,
        payerEmail: group.payerEmail,
        currentBalance: group.currentBalance,
        depositAmount: group.depositAmount,
        depositApplied: group.depositApplied,
      })),
      merchant: {
        email: result.merchant.email,
        businessName: result.merchant.businessName,
      },
      createdAt: result.createdAt,
    }

    logger.debug('Public tab fetched', {
      tabId: id,
      status: result.status,
    })

    // Use public caching for payment pages
    return new ApiResponseBuilder()
      .setData(publicTab)
      .setCache(CacheConfigs.publicLong)
      .build()
      
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error
    }
    
    logger.error('Error fetching public tab', error as Error, {
      tabId: id,
    })
    
    throw new DatabaseError('Failed to fetch tab', error)
  }
}