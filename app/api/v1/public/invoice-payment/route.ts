import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { invoices, payments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createPaymentIntent } from '@/lib/stripe/client'
import { z } from 'zod'
import { generateId } from '@/lib/utils/index'
import { ApiError } from '@/lib/api/errors'
import { InvoiceService } from '@/lib/services/invoice.service'

const invoicePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  publicUrl: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('usd'),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = invoicePaymentSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request data', details: validation.error.issues } },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get invoice by public URL
    const invoiceData = await InvoiceService.getInvoiceByPublicUrl(data.publicUrl)
    
    if (!invoiceData || invoiceData.invoice.id !== data.invoiceId) {
      return NextResponse.json(
        { error: { message: 'Invoice not found' } },
        { status: 404 }
      )
    }

    const { invoice, organization } = invoiceData

    // Check if invoice is payable
    if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'uncollectible') {
      return NextResponse.json(
        { error: { message: 'Invoice is not payable' } },
        { status: 400 }
      )
    }

    // Calculate amount due
    const amountDue = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)
    
    if (data.amount > amountDue) {
      return NextResponse.json(
        { error: { message: 'Payment amount exceeds amount due' } },
        { status: 400 }
      )
    }

    // Create Stripe payment intent
    const paymentIntent = await createPaymentIntent({
      amount: Math.round(data.amount * 100), // Convert to cents
      currency: data.currency,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        organizationId: organization.id,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        paymentType: 'invoice',
      },
      description: `Payment for Invoice #${invoice.invoiceNumber}`,
      receipt_email: data.customerEmail,
    })

    // Create payment record
    await db.insert(payments).values({
      id: generateId('pay'),
      organizationId: organization.id,
      invoiceId: invoice.id,
      amount: data.amount.toString(),
      currency: data.currency,
      status: 'pending',
      paymentMethod: 'card',
      processorPaymentId: paymentIntent.id,
      processor: 'stripe',
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      metadata: {
        source: 'invoice_payment_page',
        invoiceNumber: invoice.invoiceNumber,
      },
    })

    // Update invoice status to viewed if not already
    if (invoice.status === 'sent') {
      await db
        .update(invoices)
        .set({ 
          status: 'viewed',
          viewedAt: new Date()
        })
        .where(eq(invoices.id, invoice.id))
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error('Error creating invoice payment:', error)
    
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: error.statusCode }
      )
    }
    
    return NextResponse.json(
      { error: { message: 'Failed to create payment' } },
      { status: 500 }
    )
  }
}