import { createClient } from '@/lib/supabase/server'
import { HomePageContent } from '@/components/home-page-content'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <HomePageContent 
      isAuthenticated={!!user} 
      userEmail={user?.email}
    />
  )
}