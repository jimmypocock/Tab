'use client'

import { ToastProvider } from '@/lib/toast/toast-context'

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  )
}