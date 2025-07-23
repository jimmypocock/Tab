import { NextRequest, NextResponse } from 'next/server'
import { GET } from '@/app/(auth)/auth/confirm/route'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// Mock NextResponse redirect
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    redirect: jest.fn(),
  },
}))

describe('Email Confirmation Route', () => {
  const mockSupabase = {
    auth: {
      verifyOtp: jest.fn(),
    },
  }

  const createMockRequest = (url: string) => {
    return {
      url,
      method: 'GET',
      headers: new Headers(),
    } as unknown as NextRequest
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(NextResponse.redirect as jest.Mock).mockImplementation((url) => ({
      status: 302,
      headers: { Location: url.toString() },
    }))
  })

  it('confirms email and redirects to dashboard on success', async () => {
    mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })

    const request = createMockRequest(
      'http://localhost:1235/auth/confirm?token_hash=test-token&type=signup'
    )

    await GET(request)

    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'signup',
      token_hash: 'test-token',
    })

    expect(NextResponse.redirect).toHaveBeenCalledWith(
      new URL('/dashboard', 'http://localhost:1235/auth/confirm')
    )
  })

  it('redirects to custom next URL if provided', async () => {
    mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })

    const request = createMockRequest(
      'http://localhost:1235/auth/confirm?token_hash=test-token&type=signup&next=/settings'
    )

    await GET(request)

    expect(NextResponse.redirect).toHaveBeenCalledWith(
      new URL('/settings', 'http://localhost:1235/auth/confirm')
    )
  })

  it('redirects to login with error on verification failure', async () => {
    mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid token' },
    })

    const request = createMockRequest(
      'http://localhost:1235/auth/confirm?token_hash=invalid-token&type=signup'
    )

    await GET(request)

    expect(NextResponse.redirect).toHaveBeenCalledWith(
      new URL('/login?error=Unable to confirm email', 'http://localhost:1235/auth/confirm')
    )
  })

  it('redirects to login when missing required parameters', async () => {
    const request = createMockRequest('http://localhost:1235/auth/confirm')

    await GET(request)

    expect(mockSupabase.auth.verifyOtp).not.toHaveBeenCalled()
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      new URL('/login?error=Unable to confirm email', 'http://localhost:1235/auth/confirm')
    )
  })
})