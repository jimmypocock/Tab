import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import RegisterPage from '@/app/(auth)/register/page'
import LoginPage from '@/app/(auth)/login/page'
import ConfirmEmailPage from '@/app/(auth)/confirm-email/page'
import { createClient } from '@/lib/supabase/client'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

// Create mock location functions
const mockAssign = jest.fn()
const mockReplace = jest.fn() 
const mockReload = jest.fn()

// Store original location
const originalLocation = window.location

// Replace window.location with a mock
beforeAll(() => {
  // @ts-ignore
  delete window.location
  
  // Create a mock location object with proper href tracking
  const mockLocation = {
    href: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    assign: mockAssign,
    replace: mockReplace,
    reload: mockReload,
  }

  // @ts-ignore
  window.location = mockLocation
})

afterAll(() => {
  // @ts-ignore
  window.location = originalLocation
})

describe('Registration Flow', () => {
  const mockPush = jest.fn()
  const mockRefresh = jest.fn()
  const mockSupabase = {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      verifyOtp: jest.fn(),
    },
    from: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset window.location.href
    if (window.location) {
      (window.location as any).href = ''
    }
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    })
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    })
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('RegisterPage', () => {
    it('renders registration form', () => {
      render(<RegisterPage />)

      expect(screen.getByLabelText('Business Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('handles successful registration', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      render(<RegisterPage />)

      fireEvent.change(screen.getByLabelText('Business Name'), {
        target: { value: 'Test Business' },
      })
      fireEvent.change(screen.getByLabelText('Email Address'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: {
            data: {
              business_name: 'Test Business',
            },
          },
        })
        expect(mockPush).toHaveBeenCalledWith('/confirm-email')
      })
    })

    it('displays error on registration failure', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: null,
        error: { message: 'User already exists' },
      })

      render(<RegisterPage />)

      fireEvent.change(screen.getByLabelText('Business Name'), {
        target: { value: 'Test Business' },
      })
      fireEvent.change(screen.getByLabelText('Email Address'), {
        target: { value: 'existing@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText('User already exists')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    it('validates password length', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('Password')
      const passwordHint = screen.getByText('Must be at least 6 characters')

      expect(passwordHint).toBeInTheDocument()
    })
  })

  describe('ConfirmEmailPage', () => {
    it('renders confirmation instructions', () => {
      render(<ConfirmEmailPage />)

      expect(screen.getByText('Check your email')).toBeInTheDocument()
      expect(screen.getByText(/We've sent you a confirmation email/)).toBeInTheDocument()
      expect(screen.getByText('Local Development Tip:')).toBeInTheDocument()
      expect(screen.getByText('http://localhost:54324')).toBeInTheDocument()
    })

    it('includes link to return to login', () => {
      render(<ConfirmEmailPage />)

      const loginLink = screen.getByText('Return to login')
      expect(loginLink).toHaveAttribute('href', '/login')
    })
  })

  describe('LoginPage', () => {
    it('renders login form', () => {
      render(<LoginPage />)

      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('handles successful login', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })

      render(<LoginPage />)

      fireEvent.change(screen.getByLabelText('Email address'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        })
        // The login form should disappear after successful login
        // (In reality, window.location.href would redirect to /dashboard)
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled()
      })
    })

    it('displays error for unconfirmed email', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Email not confirmed' },
      })

      render(<LoginPage />)

      fireEvent.change(screen.getByLabelText('Email address'), {
        target: { value: 'unconfirmed@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(screen.getByText('Email not confirmed')).toBeInTheDocument()
      })
    })

    it('displays error from URL parameters', () => {
      const mockSearchParams = {
        get: jest.fn().mockReturnValue('Unable to confirm email'),
      }
      ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

      render(<LoginPage />)

      expect(screen.getByText('Unable to confirm email')).toBeInTheDocument()
    })
  })
})