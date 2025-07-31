import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { InvoiceService } from '@/lib/services/invoice.service'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { logger } from '@/lib/logger'
import { ApiResponseBuilder } from '@/lib/api/response'

// Validation schema for creating invoice from billing group
const createInvoiceSchema = z.object({
  due_date: z.string().datetime(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  include_unassigned_items: z.boolean().optional().default(false),
  send_email: z.boolean().optional().default(false),
  billing_address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string(),
  }).optional(),
  shipping_address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string(),
  }).optional(),
})

// POST /api/v1/billing-groups/:id/invoice - Create invoice from billing group
export const POST = withApiAuth(async (req, context) => {
  const { id } = await context.params
  
  try {
    const body = await req.json()
    const validatedData = createInvoiceSchema.parse(body)
    
    // Verify billing group exists and belongs to merchant
    const billingGroup = await BillingGroupService.getBillingGroupById(id)
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }
    
    // Verify the billing group belongs to a tab owned by this merchant
    if (!billingGroup.tab || billingGroup.tab.merchantId !== context.merchant.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Create invoice for billing group
    const invoice = await InvoiceService.createBillingGroupInvoice({
      billingGroupId: id,
      organizationId: context.merchant.id,
      dueDate: new Date(validatedData.due_date),
      paymentTerms: validatedData.payment_terms,
      notes: validatedData.notes,
      billingAddress: validatedData.billing_address,
      shippingAddress: validatedData.shipping_address,
      includeUnassignedItems: validatedData.include_unassigned_items,
    })
    
    logger.info('Invoice created from billing group', {
      invoiceId: invoice.id,
      billingGroupId: id,
      merchantId: context.merchant.id,
      sendEmail: validatedData.send_email,
    })
    
    // Send invoice email if requested
    if (validatedData.send_email) {
      try {
        await InvoiceService.sendInvoiceEmail(invoice.id, context.merchant.id)
        logger.info('Invoice email sent', {
          invoiceId: invoice.id,
          customerEmail: invoice.customerEmail,
        })
      } catch (error) {
        logger.error('Failed to send invoice email', error as Error, {
          invoiceId: invoice.id,
        })
        // Don't fail the request if email fails
      }
    }
    
    // Transform to API format
    const apiInvoice = {
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      status: invoice.status,
      issue_date: invoice.issueDate.toISOString(),
      due_date: invoice.dueDate.toISOString(),
      customer_email: invoice.customerEmail,
      customer_name: invoice.customerName,
      customer_organization_id: invoice.customerOrganizationId,
      subtotal: invoice.subtotal,
      tax_amount: invoice.taxAmount,
      total_amount: invoice.totalAmount,
      paid_amount: invoice.paidAmount,
      balance_due: invoice.balanceDue,
      currency: invoice.currency,
      payment_terms: invoice.paymentTerms,
      public_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoice.publicUrl}`,
      metadata: invoice.metadata,
      billing_group: {
        id: billingGroup.id,
        name: billingGroup.name,
        group_type: billingGroup.groupType,
        payer_email: billingGroup.payerEmail,
      },
      created_at: invoice.createdAt.toISOString(),
      updated_at: invoice.updatedAt.toISOString(),
    }
    
    return new ApiResponseBuilder()
      .setData(apiInvoice)
      .setMeta({ message: 'Invoice created successfully' })
      .build()
      
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }
    
    logger.error('Error creating invoice from billing group', error as Error, {
      billingGroupId: id,
      merchantId: context.merchant.id,
    })
    
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
})