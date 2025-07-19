/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { Sidebar, NavItem } from '@/components/dashboard'
import { Home, FileText, CreditCard, Settings } from 'lucide-react'

// Mock usePathname
jest.mock('next/navigation', () => ({
  usePathname: jest.fn()
}))

import { usePathname } from 'next/navigation'

describe('Sidebar', () => {
  const mockNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Tabs', href: '/tabs', icon: FileText },
    { name: 'Invoices', href: '/invoices', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings }
  ]

  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard')
  })

  it('renders navigation items', () => {
    render(<Sidebar navItems={mockNavItems} />)
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Tabs')).toBeInTheDocument()
    expect(screen.getByText('Invoices')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights active navigation item', () => {
    (usePathname as jest.Mock).mockReturnValue('/tabs')
    
    render(<Sidebar navItems={mockNavItems} />)
    
    const tabsLink = screen.getByRole('link', { name: /Tabs/ })
    expect(tabsLink).toHaveClass('bg-gray-100')
    expect(tabsLink).toHaveClass('text-gray-900')
    
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ })
    expect(dashboardLink).not.toHaveClass('bg-gray-100')
    expect(dashboardLink).toHaveClass('text-gray-700')
  })

  it('renders navigation badges', () => {
    const itemsWithBadges: NavItem[] = [
      { name: 'Dashboard', href: '/dashboard', icon: Home, badge: 'New' },
      { name: 'Tabs', href: '/tabs', icon: FileText, badge: 5 }
    ]
    
    render(<Sidebar navItems={itemsWithBadges} />)
    
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders logo when provided', () => {
    render(
      <Sidebar 
        navItems={mockNavItems} 
        logo={<div data-testid="logo">My Logo</div>}
      />
    )
    
    expect(screen.getByTestId('logo')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <Sidebar 
        navItems={mockNavItems} 
        footer={<div data-testid="footer">User Info</div>}
      />
    )
    
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(
      <Sidebar 
        navItems={mockNavItems} 
        className="custom-sidebar"
      />
    )
    
    const sidebar = screen.getByRole('navigation').parentElement
    expect(sidebar).toHaveClass('custom-sidebar')
  })

  it('renders all navigation item links correctly', () => {
    render(<Sidebar navItems={mockNavItems} />)
    
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    
    const tabsLink = screen.getByRole('link', { name: /Tabs/ })
    expect(tabsLink).toHaveAttribute('href', '/tabs')
    
    const invoicesLink = screen.getByRole('link', { name: /Invoices/ })
    expect(invoicesLink).toHaveAttribute('href', '/invoices')
    
    const settingsLink = screen.getByRole('link', { name: /Settings/ })
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('renders complete sidebar with all props', () => {
    render(
      <Sidebar
        logo={<h1>Tab App</h1>}
        navItems={[
          { name: 'Dashboard', href: '/dashboard', icon: Home, badge: 2 },
          { name: 'Settings', href: '/settings', icon: Settings }
        ]}
        footer={
          <div className="text-sm text-gray-600">
            <p>John Doe</p>
            <button>Sign out</button>
          </div>
        }
        className="w-64"
      />
    )
    
    expect(screen.getByText('Tab App')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })
})