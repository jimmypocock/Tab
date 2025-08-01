'use client'

import { TeamManagement } from '@/components/dashboard/team/TeamManagement'
import { useOrganization } from '@/components/dashboard/organization-context'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function TeamSettingsPage() {
  const { currentOrganization, userRole } = useOrganization()
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUser()
  }, [])

  if (!currentOrganization || !userId || !userRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <TeamManagement
      organizationId={currentOrganization.id}
      currentUserId={userId}
      currentUserRole={userRole}
    />
  )
}