/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileMenu } from '@/components/navigation'
import { NavItem } from '@/components/dashboard'
import { Home, FileText, Settings } from 'lucide-react'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/dashboard')
}))

describe('MobileMenu', () => {
  const mockNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Tabs', href: '/tabs', icon: FileText, badge: 3 },
    { name: 'Settings', href: '/settings', icon: Settings }
  ]
  
  const mockOnClose = jest.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('renders when open', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
      />
    )
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Tabs')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(
      <MobileMenu
        isOpen={false}
        onClose={mockOnClose}
        navItems={mockNavItems}
      />
    )
    
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
      />
    )
    
    const closeButton = screen.getByRole('button', { name: 'Close sidebar' })
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when a nav item is clicked', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
      />
    )
    
    const tabsLink = screen.getByRole('link', { name: /Tabs/ })
    fireEvent.click(tabsLink)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders nav item badges', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
      />
    )
    
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders logo when provided', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
        logo={<div data-testid="mobile-logo">Logo</div>}
      />
    )
    
    expect(screen.getByTestId('mobile-logo')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
        footer={<div data-testid="mobile-footer">Footer</div>}
      />
    )
    
    expect(screen.getByTestId('mobile-footer')).toBeInTheDocument()
  })

  it('highlights active nav item', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        navItems={mockNavItems}
      />
    )
    
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ })
    expect(dashboardLink).toHaveClass('bg-gray-100')
    expect(dashboardLink).toHaveClass('text-gray-900')
  })
})