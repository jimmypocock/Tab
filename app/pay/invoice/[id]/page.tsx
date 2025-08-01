import { getServerDI } from '@/lib/di/server'
import InvoicePaymentClient from './invoice-payment-client'
import { notFound } from 'next/navigation'

interface PageProps {
  params: { id: string }
}

export default async function InvoicePaymentPage({ params }: PageProps) {
  try {
    // Fetch the invoice data using DI
    const di = getServerDI()
    const invoice = await di.invoiceService.getInvoiceByPublicUrl(params.id)

    // Check if invoice is payable
    if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'uncollectible') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Invoice {invoice.status === 'paid' ? 'Already Paid' : 'Not Payable'}
            </h1>
            <p className="text-gray-600">
              {invoice.status === 'paid' 
                ? `This invoice was paid on ${new Date(invoice.paidAt!).toLocaleDateString()}.`
                : `This invoice has been marked as ${invoice.status}.`
              }
            </p>
          </div>
        </div>
      )
    }

    return (
      <InvoicePaymentClient
        invoice={invoice}
        lineItems={lineItems}
        merchant={organization}
      />
    )
  } catch (error) {
    console.error('Error loading invoice:', error)
    notFound()
  }
}