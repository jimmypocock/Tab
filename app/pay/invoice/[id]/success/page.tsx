import { InvoiceService } from '@/lib/services/invoice.service'
import InvoiceSuccessClient from './invoice-success-client'
import { notFound } from 'next/navigation'

interface PageProps {
  params: { id: string }
}

export default async function InvoicePaymentSuccessPage({ params }: PageProps) {
  try {
    // Fetch the invoice data
    const invoiceData = await InvoiceService.getInvoiceByPublicUrl(params.id)
    
    if (!invoiceData) {
      notFound()
    }

    const { invoice, organization } = invoiceData

    return (
      <InvoiceSuccessClient
        invoice={invoice}
        merchant={organization}
      />
    )
  } catch (error) {
    console.error('Error loading invoice:', error)
    notFound()
  }
}