'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Building, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast/toast-context'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [invitationDetails, setInvitationDetails] = useState<any>(null)
  const [invitedEmail, setInvitedEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isNewUser, setIsNewUser] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [inviterEmail, setInviterEmail] = useState('')
  const [isExpired, setIsExpired] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (token) {
      checkInvitation()
    } else {
      setError('Invalid invitation link')
      setLoading(false)
    }
  }, [token])

  const checkInvitation = async () => {
    try {
      // First fetch invitation details
      const response = await fetch(`/api/v1/auth/invitation-details?token=${token}`)
      const data = await response.json()
      
      if (!response.ok) {
        if (data.error === 'This invitation has expired') {
          setIsExpired(true)
          setInvitedEmail(data.email || '')
          setOrganizationName(data.organizationName || '')
        }
        setError(data.error || 'Invalid invitation')
        setLoading(false)
        return
      }
      
      setInvitedEmail(data.email)
      setOrganizationName(data.organizationName)
      
      const supabase = createClient()
      
      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // User is logged in, check if email matches
        if (user.email !== data.email) {
          setError('You are logged in with a different email address. Please log out and try again.')
          setLoading(false)
          return
        }
        
        // Check if this is a confirmed user returning from email confirmation
        if (user.email_confirmed_at) {
          // User is confirmed, accept invitation directly
          acceptInvitation(user.id)
        } else {
          // User still needs to confirm email
          showToast({
            type: 'info',
            title: 'Please confirm your email',
            description: `Check ${data.email} and click the confirmation link to complete joining ${organizationName}`
          })
          setLoading(false)
        }
      } else {
        // User needs to sign up or log in
        setLoading(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate invitation'
      showToast({
        type: 'error',
        title: 'Invitation Error',
        description: errorMessage
      })
      setError(errorMessage)
      setLoading(false)
    }
  }

  const acceptInvitation = async (userId: string) => {
    try {
      const response = await fetch('/api/v1/auth/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Accept invitation failed:', response.status, data)
        setError(data.error || `Failed to accept invitation (${response.status})`)
        setProcessing(false)
        return
      }

      if (data.success) {
        setSuccess(true)
        setInvitationDetails(data)
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setError(data.error || 'Failed to accept invitation')
        setProcessing(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation'
      showToast({
        type: 'error',
        title: 'Failed to accept invitation',
        description: errorMessage
      })
      setError(errorMessage)
      setProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)

    try {
      const supabase = createClient()

      if (isNewUser) {
        // Sign up new user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: invitedEmail,
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
          setProcessing(false)
          return
        }

        if (!authData.user) {
          setError('Failed to create account')
          setProcessing(false)
          return
        }

        // Check if email confirmation is required
        if (!authData.user.email_confirmed_at) {
          setPendingUserId(authData.user.id)
          setShowOtpInput(true)
          showToast({
            type: 'info',
            title: 'Check your email',
            description: `Please check ${invitedEmail} and click the confirmation link, or enter the 6-digit code below`
          })
          setProcessing(false)
          return
        }

        // Accept invitation with confirmed user
        await acceptInvitation(authData.user.id)
      } else {
        // Sign in existing user
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: invitedEmail,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setProcessing(false)
          return
        }

        if (!authData.user) {
          setError('Failed to sign in')
          setProcessing(false)
          return
        }

        // For sign in, wait a moment for session to establish
        await new Promise(resolve => setTimeout(resolve, 500))

        // Accept invitation with user ID
        await acceptInvitation(authData.user.id)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      showToast({
        type: 'error',  
        title: 'Authentication Error',
        description: errorMessage
      })
      setError(errorMessage)
      setProcessing(false)
    }
  }

  const handleOtpVerification = async () => {
    if (!otpCode || !pendingUserId) return
    
    setProcessing(true)
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.verifyOtp({
        email: invitedEmail,
        token: otpCode,
        type: 'signup'
      })

      if (error) {
        setError(error.message)
        setProcessing(false)
        return
      }

      if (data.user) {
        // OTP verified, accept invitation
        await acceptInvitation(data.user.id)
      } else {
        setError('Failed to verify code')
        setProcessing(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify code'
      setError(errorMessage)
      setProcessing(false)
    }
  }

  const handleResendCode = async () => {
    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: invitedEmail,
      })

      if (error) {
        showToast({
          type: 'error',
          title: 'Failed to resend code',
          description: error.message
        })
      } else {
        showToast({
          type: 'success',
          title: 'Code sent',
          description: `A new code has been sent to ${invitedEmail}`
        })
        
        // Set cooldown timer
        setResendCooldown(60)
        const interval = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(interval)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to resend code',
        description: 'An unexpected error occurred'
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <p className="mt-2 text-sm text-gray-600">Validating invitation...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Invitation Accepted!</h2>
          <p className="text-gray-600">
            You&apos;ve successfully joined {organizationName || 'the organization'}.
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    )
  }

  if (error && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Invalid Invitation</h2>
          <p className="text-gray-600">{error}</p>
          <Link
            href="/login"
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Building className="h-12 w-12 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accept Team Invitation
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isNewUser ? `Create an account to join ${organizationName}` : `Sign in to join ${organizationName}`}
          </p>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!showOtpInput && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" value="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                readOnly
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md bg-gray-50 cursor-not-allowed focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={invitedEmail}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isNewUser ? 'new-password' : 'current-password'}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setIsNewUser(!isNewUser)}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {isNewUser ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={processing}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                isNewUser ? 'Sign up and Accept' : 'Sign in and Accept'
              )}
            </button>
          </div>
          </form>
        )}

        {/* OTP Verification */}
        {showOtpInput && (
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Enter Confirmation Code</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the 6-digit code sent to {invitedEmail}
            </p>
            <div className="flex space-x-2">
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center text-lg font-mono"
                placeholder="123456"
              />
              <button
                onClick={handleOtpVerification}
                disabled={otpCode.length !== 6 || processing}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={handleResendCode}
                disabled={processing || resendCooldown > 0}
                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}