'use client'

import { ToastProvider } from '@/lib/toast/toast-context'

export function AuthProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}