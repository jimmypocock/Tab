/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/dashboard'
import { DollarSign, TrendingUp } from 'lucide-react'

describe('StatsCard', () => {
  it('renders basic stats', () => {
    render(
      <StatsCard
        title="Total Revenue"
        value="$12,345"
      />
    )
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('$12,345')).toBeInTheDocument()
  })

  it('renders with description', () => {
    render(
      <StatsCard
        title="Active Users"
        value={1234}
        description="Last 30 days"
      />
    )
    
    expect(screen.getByText('Active Users')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('renders with icon', () => {
    render(
      <StatsCard
        title="Revenue"
        value="$12,345"
        icon={DollarSign}
        iconColor="text-green-600"
        iconBgColor="bg-green-100"
      />
    )
    
    const iconContainer = screen.getByText('Revenue').parentElement?.parentElement?.querySelector('.rounded-full')
    expect(iconContainer).toHaveClass('bg-green-100')
    
    const icon = iconContainer?.querySelector('svg')
    expect(icon).toHaveClass('text-green-600')
  })

  it('renders positive trend', () => {
    render(
      <StatsCard
        title="Sales"
        value="$5,000"
        trend={{ value: 12.5, isPositive: true }}
      />
    )
    
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
    expect(screen.getByText('+12.5%')).toHaveClass('text-green-600')
    expect(screen.getByText('from last month')).toBeInTheDocument()
  })

  it('renders negative trend', () => {
    render(
      <StatsCard
        title="Expenses"
        value="$3,000"
        trend={{ value: -8.2, isPositive: false }}
      />
    )
    
    expect(screen.getByText('-8.2%')).toBeInTheDocument()
    expect(screen.getByText('-8.2%')).toHaveClass('text-red-600')
  })

  it('handles numeric values', () => {
    render(
      <StatsCard
        title="Order Count"
        value={42}
      />
    )
    
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(
      <StatsCard
        title="Test"
        value="123"
        className="custom-stats"
      />
    )
    
    const card = screen.getByText('Test').closest('.bg-white')
    expect(card).toHaveClass('custom-stats')
  })

  it('renders complete card with all props', () => {
    render(
      <StatsCard
        title="Monthly Revenue"
        value="$45,678"
        description="All payment methods"
        icon={TrendingUp}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-100"
        trend={{ value: 23.1, isPositive: true }}
      />
    )
    
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument()
    expect(screen.getByText('$45,678')).toBeInTheDocument()
    expect(screen.getByText('All payment methods')).toBeInTheDocument()
    expect(screen.getByText('+23.1%')).toBeInTheDocument()
    
    const iconContainer = screen.getByText('Monthly Revenue').parentElement?.parentElement?.querySelector('.rounded-full')
    expect(iconContainer).toHaveClass('bg-blue-100')
  })
})