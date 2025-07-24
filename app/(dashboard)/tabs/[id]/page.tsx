import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { CopyButton, SendInvoiceButton, TabDetailsClient } from './client-components'

export default async function TabDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  
  // Await params in Next.js 15
  const { id } = await params
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch tab with all related data including billing groups
  const { data: tab } = await supabase
    .from('tabs')
    .select(`
      *,
      line_items (*),
      payments (*),
      invoices (*),
      merchant:merchants (*),
      billing_groups (*)
    `)
    .eq('id', id)
    .eq('merchant_id', user!.id)
    .single()

  if (!tab) {
    notFound()
  }

  const balance = parseFloat(tab.total_amount) - parseFloat(tab.paid_amount)
  const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${tab.id}`

  return (
    <TabDetailsClient
      tab={tab}
      billingGroups={tab.billing_groups || []}
      lineItems={tab.line_items || []}
      payments={tab.payments || []}
      paymentUrl={paymentUrl}
      balance={balance}
    />
  )
}