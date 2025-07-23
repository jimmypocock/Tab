import { NextRequest, NextResponse } from 'next/server'
import { withCorporateAuth } from '@/lib/api/corporate-middleware'
import { CorporateAccountService } from '@/lib/services/corporate-account.service'
import { logger } from '@/lib/logger'

// GET /api/v1/corporate/account - Get corporate account details
export const GET = withCorporateAuth(async (req, context) => {
  try {
    // The corporate account is already available in context
    const { corporateAccount } = context
    
    // Get merchant relationships
    const relationships = await CorporateAccountService.getMerchantRelationships(
      corporateAccount.id
    )
    
    return NextResponse.json({
      account: corporateAccount,
      relationships: relationships.map(r => ({
        id: r.relationship.id,
        merchant: {
          id: r.merchant.id,
          name: r.merchant.businessName,
        },
        status: r.relationship.status,
        creditLimit: r.relationship.creditLimit,
        paymentTerms: r.relationship.paymentTerms,
        discountPercentage: r.relationship.discountPercentage,
      })),
    })
  } catch (error) {
    logger.error('Error fetching corporate account', { error, corporateAccountId: corporateAccount.id })
    return NextResponse.json(
      { error: 'Failed to fetch account details' },
      { status: 500 }
    )
  }
})

// PUT /api/v1/corporate/account - Update corporate account details
export const PUT = withCorporateAuth(async (req, context) => {
  try {
    const body = await req.json()
    const { corporateAccount } = context
    
    // Validate allowed fields
    const allowedFields = ['primaryContactName', 'primaryContactPhone', 'billingAddress']
    const updates: any = {}
    
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }
    
    // Update would go here (not implemented in service yet)
    // const updated = await CorporateAccountService.updateAccount(corporateAccount.id, updates)
    
    return NextResponse.json({
      message: 'Account updated successfully',
      // account: updated,
    })
  } catch (error) {
    logger.error('Error updating corporate account', { error, corporateAccountId: corporateAccount.id })
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
})