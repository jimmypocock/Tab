import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProcessorSettings from './processor-settings'
import { PageHeader } from '@/components/dashboard'

export default async function ProcessorsPage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  return (
    <div>
      <PageHeader
        title="Payment Processors"
        description="Configure your payment processor integrations"
      />
      <ProcessorSettings userId={user.id} />
    </div>
  )
}