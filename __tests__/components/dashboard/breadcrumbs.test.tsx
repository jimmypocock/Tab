/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { Breadcrumbs, BreadcrumbItem } from '@/components/dashboard'

describe('Breadcrumbs', () => {
  const basicItems: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Settings' }
  ]

  it('renders all breadcrumb items', () => {
    render(<Breadcrumbs items={basicItems} />)
    
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders links for non-last items with href', () => {
    render(<Breadcrumbs items={basicItems} />)
    
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/')
    
    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  it('renders last item as text, not link', () => {
    render(<Breadcrumbs items={basicItems} />)
    
    const settingsElement = screen.getByText('Settings')
    expect(settingsElement.tagName).toBe('SPAN')
    expect(settingsElement).toHaveAttribute('aria-current', 'page')
  })

  it('renders separator chevrons between items', () => {
    render(<Breadcrumbs items={basicItems} />)
    
    // Should have 2 chevrons for 3 items
    const chevrons = screen.getByRole('navigation').querySelectorAll('svg')
    expect(chevrons).toHaveLength(2)
  })

  it('handles single item without separators', () => {
    render(<Breadcrumbs items={[{ name: 'Home' }]} />)
    
    expect(screen.getByText('Home')).toBeInTheDocument()
    const chevrons = screen.getByRole('navigation').querySelectorAll('svg')
    expect(chevrons).toHaveLength(0)
  })

  it('handles items without href', () => {
    const itemsWithoutHref: BreadcrumbItem[] = [
      { name: 'Level 1' },
      { name: 'Level 2' },
      { name: 'Level 3' }
    ]
    
    render(<Breadcrumbs items={itemsWithoutHref} />)
    
    // All items should be spans, not links
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(screen.getByText('Level 2')).toBeInTheDocument()
    expect(screen.getByText('Level 3')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(<Breadcrumbs items={basicItems} className="custom-breadcrumbs" />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-breadcrumbs')
  })

  it('applies correct styling to items', () => {
    render(<Breadcrumbs items={basicItems} />)
    
    // Non-last items should have gray text
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveClass('text-gray-500')
    
    // Last item should have darker text and be bold
    const lastItem = screen.getByText('Settings')
    expect(lastItem).toHaveClass('font-medium')
    expect(lastItem).toHaveClass('text-gray-900')
  })

  it('has proper accessibility attributes', () => {
    render(<Breadcrumbs items={basicItems} />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb')
  })

  it('renders complex breadcrumb trail', () => {
    const complexItems: BreadcrumbItem[] = [
      { name: 'Home', href: '/' },
      { name: 'Products', href: '/products' },
      { name: 'Electronics', href: '/products/electronics' },
      { name: 'Laptops', href: '/products/electronics/laptops' },
      { name: 'Gaming Laptop Pro' }
    ]
    
    render(<Breadcrumbs items={complexItems} />)
    
    // Check all items are rendered
    complexItems.forEach(item => {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    })
    
    // Should have 4 chevrons for 5 items
    const chevrons = screen.getByRole('navigation').querySelectorAll('svg')
    expect(chevrons).toHaveLength(4)
  })
})