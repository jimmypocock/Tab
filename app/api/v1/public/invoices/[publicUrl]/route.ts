import { NextRequest, NextResponse } from 'next/server'
import { InvoiceService } from '@/lib/services/invoice.service'

export async function GET(
  request: NextRequest,
  { params }: { params: { publicUrl: string } }
) {
  try {
    const invoiceData = await InvoiceService.getInvoiceByPublicUrl(params.publicUrl)
    
    if (!invoiceData) {
      return NextResponse.json(
        { error: { message: 'Invoice not found' } },
        { status: 404 }
      )
    }

    const { invoice, lineItems, organization } = invoiceData

    // Calculate amount due
    const amountDue = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)

    return NextResponse.json({
      data: {
        invoice: {
          id: invoice.id,
          publicUrl: invoice.publicUrl,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          paymentTerms: invoice.paymentTerms,
          currency: invoice.currency,
          subtotal: invoice.subtotal,
          taxAmount: invoice.taxAmount,
          discountAmount: invoice.discountAmount,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          amountDue: amountDue.toFixed(2),
          customerEmail: invoice.customerEmail,
          customerName: invoice.customerName,
          customerOrganizationName: invoice.customerOrganizationName,
          reference: invoice.reference,
          notes: invoice.notes,
        },
        lineItems: lineItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          metadata: item.metadata,
        })),
        merchant: {
          id: organization.id,
          name: organization.name,
          email: organization.email,
          billingEmail: organization.billingEmail,
          address: organization.address,
          phone: organization.phone,
          website: organization.website,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch invoice' } },
      { status: 500 }
    )
  }
}