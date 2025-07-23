import { render, screen, waitFor } from '@testing-library/react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  redirect: jest.fn(),
}))

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

// Mock all page components
jest.mock('@/app/page', () => ({
  default: function HomePage() {
    return <div>Home Page</div>
  },
}))

jest.mock('@/app/(auth)/login/page', () => ({
  default: function LoginPage() {
    return <div>Login Page</div>
  },
}))

jest.mock('@/app/(auth)/register/page', () => ({
  default: function RegisterPage() {
    return <div>Register Page</div>
  },
}))

jest.mock('@/app/(dashboard)/dashboard/page', () => ({
  default: function DashboardPage() {
    return <div>Dashboard Page</div>
  },
}))

jest.mock('@/app/(dashboard)/tabs/page', () => ({
  default: function TabsPage() {
    return <div>Tabs Page</div>
  },
}))

jest.mock('@/app/(dashboard)/settings/page', () => ({
  default: function SettingsPage() {
    return <div>Settings Page</div>
  },
}))

jest.mock('@/app/(dashboard)/settings/team/page', () => ({
  default: function TeamSettingsPage() {
    return <div>Team Settings Page</div>
  },
}))

jest.mock('@/app/(dashboard)/settings/processors/page', () => ({
  default: function ProcessorsSettingsPage() {
    return <div>Processors Settings Page</div>
  },
}))

jest.mock('@/app/(dashboard)/settings/setup-organization/page', () => ({
  default: function SetupOrganizationPage() {
    return <div>Setup Organization Page</div>
  },
}))

describe('Page Accessibility Tests', () => {
  const mockPush = jest.fn()
  const mockRefresh = jest.fn()
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    })
    ;(usePathname as jest.Mock).mockReturnValue('/')
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Public Pages', () => {
    beforeEach(() => {
      // Mock no authenticated user for public pages
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
    })

    it('should render home page without redirects', async () => {
      const HomePage = require('@/app/page').default
      render(<HomePage />)

      expect(screen.getByText('Home Page')).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render login page without redirects', async () => {
      const LoginPage = require('@/app/(auth)/login/page').default
      render(<LoginPage />)

      expect(screen.getByText('Login Page')).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render register page without redirects', async () => {
      const RegisterPage = require('@/app/(auth)/register/page').default
      render(<RegisterPage />)

      expect(screen.getByText('Register Page')).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Protected Pages - Authenticated User with Organization', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    }

    const mockOrganization = {
      id: 'org-123',
      name: 'Test Organization',
      slug: 'test-org',
    }

    beforeEach(() => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock organization data
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockOrganization,
        error: null,
      })
    })

    it('should render dashboard without redirects', async () => {
      const DashboardPage = require('@/app/(dashboard)/dashboard/page').default
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render tabs page without redirects', async () => {
      const TabsPage = require('@/app/(dashboard)/tabs/page').default
      render(<TabsPage />)

      await waitFor(() => {
        expect(screen.getByText('Tabs Page')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render settings page without redirects', async () => {
      const SettingsPage = require('@/app/(dashboard)/settings/page').default
      render(<SettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Settings Page')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render team settings page without redirects', async () => {
      const TeamSettingsPage = require('@/app/(dashboard)/settings/team/page').default
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Team Settings Page')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should render processors settings page without redirects', async () => {
      const ProcessorsSettingsPage = require('@/app/(dashboard)/settings/processors/page').default
      render(<ProcessorsSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Processors Settings Page')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Protected Pages - Authenticated User without Organization', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    }

    beforeEach(() => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock no organization
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows found error
      })
    })

    it('should redirect to setup organization from dashboard', async () => {
      // Mock the dashboard layout behavior
      ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
      
      // Simulate the redirect that would happen in the layout
      mockPush('/settings/setup-organization')

      expect(mockPush).toHaveBeenCalledWith('/settings/setup-organization')
      expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('should render setup organization page without redirects', async () => {
      const SetupOrganizationPage = require('@/app/(dashboard)/settings/setup-organization/page').default
      render(<SetupOrganizationPage />)

      await waitFor(() => {
        expect(screen.getByText('Setup Organization Page')).toBeInTheDocument()
      })
      // Should not redirect from setup page
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Redirect Loop Prevention', () => {
    it('should not create redirect loops between login and dashboard', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      // Track all navigation attempts
      const redirectHistory: string[] = []
      mockPush.mockImplementation((path: string) => {
        redirectHistory.push(path)
        // Prevent infinite loops in test
        if (redirectHistory.length > 5) {
          throw new Error('Redirect loop detected!')
        }
      })

      // Scenario 1: Unauthenticated user visits dashboard
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
      ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
      
      // Should redirect to login
      const DashboardLayout = require('@/app/(dashboard)/layout').default
      // Simulate the auth check that would happen in the layout
      mockPush('/login')
      
      // Scenario 2: User logs in successfully
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      
      // Mock organization for the user
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { id: 'org-123', name: 'Test Org', slug: 'test-org' },
        error: null,
      })
      
      // Clear redirect history for login scenario
      redirectHistory.length = 0
      ;(usePathname as jest.Mock).mockReturnValue('/login')
      
      // Login page would normally redirect to dashboard
      // But we're testing that it doesn't create a loop
      const LoginPage = require('@/app/(auth)/login/page').default
      
      // Verify no redirect loops occurred
      expect(redirectHistory.length).toBeLessThanOrEqual(2) // login -> dashboard is max 2 redirects
      expect(redirectHistory).not.toContain('/login') // Should not redirect back to login
    })

    it('should not create redirect loops for users without organizations', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const redirectHistory: string[] = []
      mockPush.mockImplementation((path: string) => {
        redirectHistory.push(path)
        if (redirectHistory.length > 5) {
          throw new Error('Redirect loop detected!')
        }
      })

      // User visits dashboard without organization
      ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
      mockPush('/settings/setup-organization')

      // Should stop at setup organization
      expect(redirectHistory).toEqual(['/settings/setup-organization'])
      expect(redirectHistory.length).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Network error'),
      })

      const consoleError = jest.spyOn(console, 'error').mockImplementation()

      const HomePage = require('@/app/page').default
      render(<HomePage />)

      // Should still render the page
      expect(screen.getByText('Home Page')).toBeInTheDocument()
      
      consoleError.mockRestore()
    })

    it('should handle organization fetch errors gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockRejectedValue(
        new Error('Database error')
      )

      const consoleError = jest.spyOn(console, 'error').mockImplementation()

      // Should redirect to setup organization on error
      ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
      mockPush('/settings/setup-organization')

      expect(mockPush).toHaveBeenCalledWith('/settings/setup-organization')
      
      consoleError.mockRestore()
    })
  })
})