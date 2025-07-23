'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface OrganizationContextType {
  selectedOrganizationId: string | null
  setSelectedOrganizationId: (id: string) => void
}

const OrganizationContext = createContext<OrganizationContextType>({
  selectedOrganizationId: null,
  setSelectedOrganizationId: () => {}
})

export function OrganizationProvider({ 
  children, 
  defaultOrganizationId 
}: { 
  children: React.ReactNode
  defaultOrganizationId: string
}) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    // Check localStorage for saved organization preference
    const saved = localStorage.getItem('selectedOrganizationId')
    if (saved) {
      setSelectedOrganizationId(saved)
    } else {
      setSelectedOrganizationId(defaultOrganizationId)
    }
  }, [defaultOrganizationId])

  const handleSetSelectedOrganization = (id: string) => {
    setSelectedOrganizationId(id)
    localStorage.setItem('selectedOrganizationId', id)
    // Trigger a page refresh to reload with new organization context
    window.location.reload()
  }

  return (
    <OrganizationContext.Provider 
      value={{ 
        selectedOrganizationId, 
        setSelectedOrganizationId: handleSetSelectedOrganization 
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  return useContext(OrganizationContext)
}