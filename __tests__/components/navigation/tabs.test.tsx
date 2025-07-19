/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { Tabs, Tab } from '@/components/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/settings/general')
}))

describe('Tabs', () => {
  const mockTabs: Tab[] = [
    { name: 'General', href: '/settings/general' },
    { name: 'Security', href: '/settings/security' },
    { name: 'Notifications', href: '/settings/notifications', count: 3 },
    { name: 'Billing', href: '/settings/billing' }
  ]

  it('renders all tabs', () => {
    render(<Tabs tabs={mockTabs} />)
    
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
  })

  it('highlights active tab', () => {
    render(<Tabs tabs={mockTabs} />)
    
    const generalTab = screen.getByRole('link', { name: /General/ })
    expect(generalTab).toHaveClass('border-blue-500')
    expect(generalTab).toHaveClass('text-blue-600')
    expect(generalTab).toHaveAttribute('aria-current', 'page')
    
    const securityTab = screen.getByRole('link', { name: /Security/ })
    expect(securityTab).toHaveClass('border-transparent')
    expect(securityTab).toHaveClass('text-gray-500')
    expect(securityTab).not.toHaveAttribute('aria-current')
  })

  it('renders tab counts when provided', () => {
    render(<Tabs tabs={mockTabs} />)
    
    expect(screen.getByText('3')).toBeInTheDocument()
    
    // Count badge should have active styling when tab is active
    const notificationsTab = screen.getByRole('link', { name: /Notifications/ })
    const countBadge = notificationsTab.querySelector('span')
    expect(countBadge).toHaveClass('bg-gray-100')
  })

  it('renders correct href attributes', () => {
    render(<Tabs tabs={mockTabs} />)
    
    expect(screen.getByRole('link', { name: /General/ })).toHaveAttribute('href', '/settings/general')
    expect(screen.getByRole('link', { name: /Security/ })).toHaveAttribute('href', '/settings/security')
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveAttribute('href', '/settings/notifications')
    expect(screen.getByRole('link', { name: /Billing/ })).toHaveAttribute('href', '/settings/billing')
  })

  it('accepts custom className', () => {
    render(<Tabs tabs={mockTabs} className="custom-tabs" />)
    
    const tabsContainer = screen.getByRole('navigation').parentElement?.parentElement
    expect(tabsContainer).toHaveClass('custom-tabs')
  })

  it('handles tabs with zero count', () => {
    const tabsWithZero: Tab[] = [
      { name: 'All', href: '/items', count: 0 },
      { name: 'Active', href: '/items/active', count: 5 }
    ]
    
    render(<Tabs tabs={tabsWithZero} />)
    
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('has proper aria label', () => {
    render(<Tabs tabs={mockTabs} />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'Tabs')
  })
})