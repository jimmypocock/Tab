import { NextRequest, NextResponse } from 'next/server'
import { withCorporateAuth } from '@/lib/api/corporate-middleware'
import { CorporateAccountService } from '@/lib/services/corporate-account.service'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// GET /api/v1/corporate/reports/spending - Get spending analytics
export const GET = withCorporateAuth(async (req, context) => {
  try {
    const { corporateAccount } = context
    const { searchParams } = new URL(req.url)
    
    // Parse date range
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'date_from and date_to are required' },
        { status: 400 }
      )
    }
    
    const analytics = await CorporateAccountService.getSpendingAnalytics(
      corporateAccount.id,
      new Date(dateFrom),
      new Date(dateTo)
    )
    
    return NextResponse.json({
      period: {
        from: dateFrom,
        to: dateTo,
      },
      summary: analytics.total,
      by_merchant: analytics.byMerchant,
    })
  } catch (error) {
    logger.error('Error generating spending report', { error, corporateAccountId: corporateAccount.id, dateFrom, dateTo })
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
})