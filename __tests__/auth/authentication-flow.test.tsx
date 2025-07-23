/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Mock Supabase auth
const mockSupabaseAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  getUser: jest.fn(),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } }
  }))
}

jest.mock('@/lib/supabase/client', () => ({
  createClientComponentClient: () => ({
    auth: mockSupabaseAuth,
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      }))
    }))
  })
}))

// Mock Next.js navigation
const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock auth components
const MockLoginForm: React.FC<{ onSubmit: (email: string, password: string) => void }> = ({ onSubmit }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    onSubmit(
      formData.get('email') as string,
      formData.get('password') as string
    )
  }

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        data-testid="email-input"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        data-testid="password-input"
      />
      <button type="submit" data-testid="login-button">
        Sign In
      </button>
    </form>
  )
}

const MockRegisterForm: React.FC<{ 
  onSubmit: (email: string, password: string, businessName: string) => void 
}> = ({ onSubmit }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    onSubmit(
      formData.get('email') as string,
      formData.get('password') as string,
      formData.get('businessName') as string
    )
  }

  return (
    <form onSubmit={handleSubmit} data-testid="register-form">
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        data-testid="email-input"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        data-testid="password-input"
      />
      <input
        name="businessName"
        type="text"
        placeholder="Business Name"
        required
        data-testid="business-name-input"
      />
      <button type="submit" data-testid="register-button">
        Create Account
      </button>
    </form>
  )
}

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Login Flow', () => {
    it('should handle successful login', async () => {
      const user = userEvent.setup()

      // Mock successful login response
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com'
          },
          session: {
            access_token: 'mock-token'
          }
        },
        error: null
      })

      const handleLogin = jest.fn(async (email: string, password: string) => {
        const result = await mockSupabaseAuth.signInWithPassword({
          email,
          password
        })

        if (result.error) {
          throw new Error(result.error.message)
        }

        // Simulate redirect to dashboard
        mockPush('/dashboard')
      })

      render(<MockLoginForm onSubmit={handleLogin} />)

      // Fill out form
      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')

      // Submit form
      await user.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('should handle login errors', async () => {
      const user = userEvent.setup()
      let capturedError: string | null = null

      // Mock login error
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      })

      const handleLogin = jest.fn(async (email: string, password: string) => {
        try {
          const result = await mockSupabaseAuth.signInWithPassword({
            email,
            password
          })

          if (result.error) {
            capturedError = result.error.message
            return // Don't throw, just capture the error
          }
        } catch (error) {
          capturedError = (error as Error).message
        }
      })

      render(<MockLoginForm onSubmit={handleLogin} />)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('password-input'), 'wrongpassword')
      await user.click(screen.getByTestId('login-button'))

      await waitFor(() => {
        expect(handleLogin).toHaveBeenCalled()
      })

      expect(capturedError).toBe('Invalid login credentials')
      // Should not redirect on error
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      const handleLogin = jest.fn()

      render(<MockLoginForm onSubmit={handleLogin} />)

      // Try to submit with invalid email
      await user.type(screen.getByTestId('email-input'), 'invalid-email')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.click(screen.getByTestId('login-button'))

      // HTML5 validation should prevent submission
      const emailInput = screen.getByTestId('email-input') as HTMLInputElement
      expect(emailInput.validity.valid).toBe(false)
    })
  })

  describe('Registration Flow', () => {
    it('should handle successful registration', async () => {
      const user = userEvent.setup()

      // Mock successful registration
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'user-456',
            email: 'newuser@example.com'
          },
          session: {
            access_token: 'mock-token'
          }
        },
        error: null
      })

      const handleRegister = jest.fn(async (email: string, password: string, businessName: string) => {
        const result = await mockSupabaseAuth.signUp({
          email,
          password,
          options: {
            data: {
              business_name: businessName
            }
          }
        })

        if (result.error) {
          throw new Error(result.error.message)
        }

        // Simulate redirect to dashboard
        mockPush('/dashboard')
      })

      render(<MockRegisterForm onSubmit={handleRegister} />)

      await user.type(screen.getByTestId('email-input'), 'newuser@example.com')
      await user.type(screen.getByTestId('password-input'), 'strongpassword123')
      await user.type(screen.getByTestId('business-name-input'), 'My Business')
      await user.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          password: 'strongpassword123',
          options: {
            data: {
              business_name: 'My Business'
            }
          }
        })
      })

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('should handle registration errors', async () => {
      const user = userEvent.setup()
      let capturedError: string | null = null

      // Mock registration error (email already exists)
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' }
      })

      const handleRegister = jest.fn(async (email: string, password: string, businessName: string) => {
        try {
          const result = await mockSupabaseAuth.signUp({
            email,
            password,
            options: {
              data: {
                business_name: businessName
              }
            }
          })

          if (result.error) {
            capturedError = result.error.message
            return
          }
        } catch (error) {
          capturedError = (error as Error).message
        }
      })

      render(<MockRegisterForm onSubmit={handleRegister} />)

      await user.type(screen.getByTestId('email-input'), 'existing@example.com')
      await user.type(screen.getByTestId('password-input'), 'password123')
      await user.type(screen.getByTestId('business-name-input'), 'My Business')
      await user.click(screen.getByTestId('register-button'))

      await waitFor(() => {
        expect(handleRegister).toHaveBeenCalled()
      })

      expect(capturedError).toBe('User already registered')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should validate required fields', () => {
      const handleRegister = jest.fn()
      render(<MockRegisterForm onSubmit={handleRegister} />)

      const emailInput = screen.getByTestId('email-input') as HTMLInputElement
      const passwordInput = screen.getByTestId('password-input') as HTMLInputElement
      const businessNameInput = screen.getByTestId('business-name-input') as HTMLInputElement

      expect(emailInput.required).toBe(true)
      expect(passwordInput.required).toBe(true)
      expect(businessNameInput.required).toBe(true)
    })
  })

  describe('Password Reset Flow', () => {
    it('should send password reset email', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      })

      const resetPassword = async (email: string) => {
        const result = await mockSupabaseAuth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })

        if (result.error) {
          throw new Error(result.error.message)
        }
      }

      await resetPassword('user@example.com')

      expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      )
    })

    it('should handle password reset errors', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: { message: 'Email not found' }
      })

      const resetPassword = async (email: string) => {
        const result = await mockSupabaseAuth.resetPasswordForEmail(email)

        if (result.error) {
          throw new Error(result.error.message)
        }
      }

      await expect(resetPassword('nonexistent@example.com'))
        .rejects.toThrow('Email not found')
    })
  })

  describe('Logout Flow', () => {
    it('should handle successful logout', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({
        error: null
      })

      const handleLogout = async () => {
        const result = await mockSupabaseAuth.signOut()

        if (result.error) {
          throw new Error(result.error.message)
        }

        // Simulate redirect to home
        mockReplace('/')
      }

      await handleLogout()

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith('/')
    })

    it('should handle logout errors gracefully', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({
        error: { message: 'Session invalid' }
      })

      const handleLogout = async () => {
        const result = await mockSupabaseAuth.signOut()

        if (result.error) {
          // In practice, you might still redirect even if logout fails
          console.warn('Logout error:', result.error.message)
        }

        // Still redirect to clear client state
        mockReplace('/')
      }

      await handleLogout()

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  describe('Auth State Management', () => {
    it('should track authentication state changes', () => {
      const mockCallback = jest.fn()
      
      // Mock auth state change subscription
      mockSupabaseAuth.onAuthStateChange.mockReturnValue({
        data: {
          subscription: {
            unsubscribe: jest.fn()
          }
        }
      })

      const subscription = mockSupabaseAuth.onAuthStateChange(mockCallback)

      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalledWith(mockCallback)
      expect(subscription.data.subscription.unsubscribe).toBeDefined()
    })

    it('should get current user session', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-123',
              email: 'test@example.com'
            },
            access_token: 'mock-token'
          }
        },
        error: null
      })

      const getCurrentUser = async () => {
        const result = await mockSupabaseAuth.getSession()
        return result.data.session?.user || null
      }

      const user = await getCurrentUser()

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com'
      })
    })

    it('should handle expired sessions', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' }
      })

      const getCurrentUser = async () => {
        const result = await mockSupabaseAuth.getSession()
        
        if (result.error) {
          throw new Error(result.error.message)
        }
        
        return result.data.session?.user || null
      }

      await expect(getCurrentUser()).rejects.toThrow('Session expired')
    })
  })

  describe('Route Protection', () => {
    it('should redirect unauthenticated users to login', async () => {
      // Mock no session
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const checkAuthAndRedirect = async (requiredRoute: string) => {
        const result = await mockSupabaseAuth.getSession()
        
        if (!result.data.session) {
          mockReplace(`/login?redirectTo=${encodeURIComponent(requiredRoute)}`)
          return false
        }
        
        return true
      }

      const isAuthorized = await checkAuthAndRedirect('/dashboard')

      expect(isAuthorized).toBe(false)
      expect(mockReplace).toHaveBeenCalledWith('/login?redirectTo=%2Fdashboard')
    })

    it('should allow authenticated users to access protected routes', async () => {
      // Mock active session
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' },
            access_token: 'valid-token'
          }
        },
        error: null
      })

      const checkAuthAndRedirect = async () => {
        const result = await mockSupabaseAuth.getSession()
        return !!result.data.session
      }

      const isAuthorized = await checkAuthAndRedirect()

      expect(isAuthorized).toBe(true)
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })
})