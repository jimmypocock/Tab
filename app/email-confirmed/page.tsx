'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function EmailConfirmedPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // If not logged in, redirect to login
        router.push('/login')
        return
      }

      // Wait a moment to show the success message
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }

    checkUserAndRedirect()
  }, [router, supabase.auth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Email Confirmed!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your email has been successfully verified. You'll be redirected to your dashboard in a moment...
          </p>
          <div className="mt-8">
            <div className="animate-pulse flex space-x-2 justify-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
          <div className="mt-6">
            <a
              href="/dashboard"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Go to dashboard now →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}