'use client'

import { ReactNode } from 'react'
import { ToastProvider } from '@/lib/toast/toast-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Create a client outside of the component to prevent re-creation on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
})

// This is where ALL client-side providers go
// As you add more providers (Redux, Theme, Auth wrappers, etc.), add them here
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {/* Add more providers here as needed */}
        {/* <ThemeProvider> */}
        {/* <AuthProvider> */}
        {/* <AnalyticsProvider> */}
        {children}
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </ToastProvider>
    </QueryClientProvider>
  )
}