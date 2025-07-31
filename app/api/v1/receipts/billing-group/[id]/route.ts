import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { billingGroups, tabs, lineItems, payments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// GET /api/v1/receipts/billing-group/:id - Generate receipt for billing group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const paymentSessionId = searchParams.get('payment_session')
  
  try {
    // Get billing group with related data
    const billingGroup = await db.query.billingGroups.findFirst({
      where: eq(billingGroups.id, id),
      with: {
        tab: {
          with: {
            merchant: true,
          }
        },
        lineItems: true,
        payerOrganization: true,
      }
    })
    
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }
    
    // Get recent payment if session ID provided
    let recentPayment = null
    if (paymentSessionId) {
      recentPayment = await db.query.payments.findFirst({
        where: and(
          eq(payments.tabId, billingGroup.tabId!),
          eq(payments.metadata.checkout_session_id, paymentSessionId)
        ),
      })
    }
    
    // Generate receipt HTML
    const receiptHtml = generateBillingGroupReceiptHtml({
      billingGroup,
      payment: recentPayment,
    })
    
    // For now, return HTML. In production, you'd use a PDF generator like Puppeteer
    return new NextResponse(receiptHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="receipt-${billingGroup.groupNumber}.html"`,
      },
    })
    
  } catch (error) {
    logger.error('Error generating billing group receipt', error as Error, {
      billingGroupId: id,
    })
    
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    )
  }
}

function generateBillingGroupReceiptHtml(data: {
  billingGroup: any
  payment: any
}) {
  const { billingGroup, payment } = data
  const currentDate = new Date().toLocaleDateString()
  const paymentDate = payment ? new Date(payment.createdAt).toLocaleDateString() : currentDate
  
  const itemsHtml = billingGroup.lineItems.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.unitPrice).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.total).toFixed(2)}</td>
    </tr>
  `).join('')
  
  const subtotal = billingGroup.lineItems.reduce((sum: number, item: any) => 
    sum + parseFloat(item.total), 0
  )
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt - ${billingGroup.groupNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .info-section { margin-bottom: 30px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; }
        .total-section { text-align: right; margin-top: 30px; }
        .footer { text-align: center; margin-top: 50px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Receipt</h1>
          <p>Receipt #: ${payment?.id || 'PENDING'}</p>
          <p>Date: ${paymentDate}</p>
        </div>
        
        <div class="info-section">
          <h2>Merchant Information</h2>
          <p><strong>${billingGroup.tab.merchant.businessName}</strong></p>
          <p>${billingGroup.tab.merchant.email}</p>
        </div>
        
        <div class="info-section">
          <h2>Billing Group Information</h2>
          <div class="info-row">
            <span><strong>Group Name:</strong></span>
            <span>${billingGroup.name}</span>
          </div>
          <div class="info-row">
            <span><strong>Group Number:</strong></span>
            <span>${billingGroup.groupNumber}</span>
          </div>
          ${billingGroup.payerEmail ? `
          <div class="info-row">
            <span><strong>Payer Email:</strong></span>
            <span>${billingGroup.payerEmail}</span>
          </div>
          ` : ''}
          ${billingGroup.payerOrganization ? `
          <div class="info-row">
            <span><strong>Organization:</strong></span>
            <span>${billingGroup.payerOrganization.name}</span>
          </div>
          ` : ''}
        </div>
        
        <h2>Items</h2>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Description</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="info-row">
            <span><strong>Subtotal:</strong></span>
            <span><strong>$${subtotal.toFixed(2)}</strong></span>
          </div>
          ${payment ? `
          <div class="info-row" style="color: #059669;">
            <span><strong>Amount Paid:</strong></span>
            <span><strong>$${parseFloat(payment.amount).toFixed(2)}</strong></span>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>Thank you for your payment!</p>
          <p>This is a computer-generated receipt and does not require a signature.</p>
        </div>
      </div>
    </body>
    </html>
  `
}