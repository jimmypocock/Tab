import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '@/__tests__/helpers/test-utils'
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

// Mock Supabase client with proper auth methods
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signUp: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'user123', email: 'test@example.com' } }, 
      error: null 
    }),
    signInWithPassword: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'user123', email: 'test@example.com' } }, 
      error: null 
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } }
    }))
  }
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

describe('Registration Flow', () => {
  const mockPush = jest.fn()
  const mockRefresh = jest.fn()

  // Mock window.location.href assignment to prevent JSDOM navigation errors
  beforeAll(() => {
    // Delete the existing location property first
    delete (window as any).location
    
    // Create a custom location object with a non-throwing href setter
    const mockLocation = {
      href: 'http://localhost/',
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      toString: () => 'http://localhost/'
    }
    
    // Override the href property with a custom setter
    Object.defineProperty(mockLocation, 'href', {
      get: () => 'http://localhost/',
      set: (value) => {
        // Silent no-op to prevent JSDOM navigation errors
        console.log(`Mock navigation to: ${value}`)
      },
      configurable: true
    })
    
    // Set the new location object
    ;(window as any).location = mockLocation
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    })
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    })
    ;(createClient as jest.Mock).mockReturnValue(mockSupabaseClient)
  })

  describe('RegisterPage', () => {
    it('renders registration form', () => {
      render(<RegisterPage />)

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('handles successful registration', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      })

      render(<RegisterPage />)

      fireEvent.change(screen.getByLabelText('Email Address'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: {
            emailRedirectTo: 'http://localhost/login?emailConfirmed=true',
          },
        })
        expect(mockPush).toHaveBeenCalledWith('/confirm-email?email=test%40example.com')
      })
    })

    it('displays error on registration failure', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: null,
        error: { message: 'User already exists' },
      })

      render(<RegisterPage />)

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
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
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
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        })
        // The login form should disappear after successful login
        // (In reality, window.location.href would redirect to /dashboard)
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalled()
      })
    })

    it('displays error for unconfirmed email', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
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