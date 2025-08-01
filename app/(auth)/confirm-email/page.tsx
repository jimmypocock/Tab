'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast/toast-context'

export default function ConfirmEmailPage() {
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verificationCode || verificationCode.length !== 6) {
      showToast({
        type: 'error',
        title: 'Invalid code',
        description: 'Please enter the 6-digit code from your email'
      })
      return
    }

    setVerifying(true)
    try {
      // Get email from URL params (passed from registration)
      const params = new URLSearchParams(window.location.search)
      const email = params.get('email')
      
      if (!email) {
        showToast({
          type: 'error',
          title: 'Email not found',
          description: 'Please try registering again'
        })
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'signup'
      })

      if (error) {
        showToast({
          type: 'error',
          title: 'Verification failed',
          description: error.message
        })
      } else {
        showToast({
          type: 'success',
          title: 'Email verified!',
          description: 'Redirecting to dashboard...'
        })
        router.push('/dashboard')
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Verification failed',
        description: 'An unexpected error occurred'
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We&apos;ve sent you a confirmation email. Please click the link in the email or enter the verification code below.
          </p>

          {/* Verification Code Form */}
          <form onSubmit={handleVerifyCode} className="mt-8">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={verifying}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Didn&apos;t receive the email? Check your spam folder or
              <a href="/register" className="ml-1 font-medium text-indigo-600 hover:text-indigo-500">
                try again
              </a>
            </p>
          </div>
          
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <p className="text-sm text-blue-800 font-medium mb-2">
              Local Development Tip:
            </p>
            <p className="text-sm text-blue-700">
              Visit <a href="http://localhost:54324" className="underline font-medium" target="_blank" rel="noopener noreferrer">
                http://localhost:54324
              </a> to view test emails sent by your local Supabase instance.
            </p>
          </div>
          
          <div className="mt-6">
            <a
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Return to login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}