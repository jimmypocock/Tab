import { describe, it, expect, beforeEach, jest, beforeAll, afterAll } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BillingGroupCard } from '@/components/dashboard/billing-groups/BillingGroupCard'
import { server } from '@/__tests__/mocks/server'

// Mock window.confirm
global.confirm = jest.fn()

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Disable MSW for these tests to use manual mocks
beforeAll(() => server.close())
afterAll(() => server.listen())

describe('BillingGroupCard', () => {
  const mockOnUpdate = jest.fn()
  const mockOnClick = jest.fn()

  const mockGroup = {
    id: 'bg_123',
    name: 'Corporate Account',
    group_type: 'corporate',
    status: 'active',
    payer_email: 'billing@company.com',
    credit_limit: 5000.00,
    current_balance: 1200.00,
    deposit_amount: 500.00,
    deposit_applied: 100.00,
    rules_count: 3
  }

  const mockLineItems = [
    {
      id: 'li_1',
      description: 'Business Lunch',
      quantity: 1,
      unit_price: 50.00
    },
    {
      id: 'li_2',
      description: 'Conference Room',
      quantity: 2,
      unit_price: 25.00
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })
    ;(global.confirm as jest.Mock).mockReturnValue(true)
  })

  describe('Basic rendering', () => {
    it('should render group name and type', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Corporate Account')).toBeInTheDocument()
      expect(screen.getByText('corporate')).toBeInTheDocument()
    })

    it('should render payer email when provided', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Payer:')).toBeInTheDocument()
      expect(screen.getByText('billing@company.com')).toBeInTheDocument()
    })

    it('should not render payer section when email not provided', () => {
      const groupWithoutEmail = { ...mockGroup, payer_email: null }

      render(
        <BillingGroupCard
          group={groupWithoutEmail}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText('Payer:')).not.toBeInTheDocument()
    })

    it('should render line items count and total amount', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('2 items')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument() // 50 + (2 * 25)
    })

    it('should render singular form for single item', () => {
      const singleItem = [mockLineItems[0]]

      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={singleItem}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('1 item')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
    })
  })

  describe('Group type styling', () => {
    it('should apply corporate styling for corporate group', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const badge = screen.getByText('corporate').closest('.inline-flex')
      expect(badge).toHaveClass('bg-blue-500/10', 'text-blue-700', 'border-blue-200')
    })

    it('should apply deposit styling for deposit group', () => {
      const depositGroup = { ...mockGroup, group_type: 'deposit' }

      render(
        <BillingGroupCard
          group={depositGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const badge = screen.getByText('deposit').closest('.inline-flex')
      expect(badge).toHaveClass('bg-green-500/10', 'text-green-700', 'border-green-200')
    })

    it('should apply credit styling for credit group', () => {
      const creditGroup = { ...mockGroup, group_type: 'credit' }

      render(
        <BillingGroupCard
          group={creditGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const badge = screen.getByText('credit').closest('.inline-flex')
      expect(badge).toHaveClass('bg-purple-500/10', 'text-purple-700', 'border-purple-200')
    })

    it('should apply default styling for standard group', () => {
      const standardGroup = { ...mockGroup, group_type: 'standard' }

      render(
        <BillingGroupCard
          group={standardGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const badge = screen.getByText('standard').closest('.inline-flex')
      expect(badge).toHaveClass('bg-gray-500/10', 'text-gray-700', 'border-gray-200')
    })
  })

  describe('Status indicators', () => {
    it('should show status badge for non-active status', () => {
      const inactiveGroup = { ...mockGroup, status: 'inactive' }

      render(
        <BillingGroupCard
          group={inactiveGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('inactive')).toBeInTheDocument()
    })

    it('should not show status badge for active status', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText('active')).not.toBeInTheDocument()
    })
  })

  describe('Deposit progress', () => {
    it('should render deposit progress when deposit amount exists', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Deposit')).toBeInTheDocument()
      expect(screen.getByText('$400.00 remaining')).toBeInTheDocument() // 500 - 100
    })

    it('should not render deposit section when no deposit amount', () => {
      const groupWithoutDeposit = { ...mockGroup, deposit_amount: null }

      render(
        <BillingGroupCard
          group={groupWithoutDeposit}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText('Deposit')).not.toBeInTheDocument()
    })

    it('should handle zero deposit amount', () => {
      const groupWithZeroDeposit = { ...mockGroup, deposit_amount: 0 }

      render(
        <BillingGroupCard
          group={groupWithZeroDeposit}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText('Deposit')).not.toBeInTheDocument()
    })

    it('should calculate deposit remaining correctly with no applied amount', () => {
      const groupWithoutApplied = { ...mockGroup, deposit_applied: null }

      render(
        <BillingGroupCard
          group={groupWithoutApplied}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('$500.00 remaining')).toBeInTheDocument()
    })
  })

  describe('Credit limit progress', () => {
    it('should render credit usage when credit limit exists', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Credit Used')).toBeInTheDocument()
      expect(screen.getByText('$1200.00 / $5000.00')).toBeInTheDocument()
    })

    it('should not render credit section when no credit limit', () => {
      const groupWithoutCredit = { ...mockGroup, credit_limit: null }

      render(
        <BillingGroupCard
          group={groupWithoutCredit}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText('Credit Used')).not.toBeInTheDocument()
    })

    it('should apply warning styling for high credit usage (75-90%)', () => {
      const highUsageGroup = {
        ...mockGroup,
        current_balance: 4000.00, // 80% of 5000
        credit_limit: 5000.00
      }

      const { container } = render(
        <BillingGroupCard
          group={highUsageGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const progressWrapper = container.querySelector('.bg-yellow-100')
      expect(progressWrapper).toBeInTheDocument()
      expect(progressWrapper).toHaveAttribute('role', 'progressbar')
    })

    it('should apply danger styling for very high credit usage (>90%)', () => {
      const veryHighUsageGroup = {
        ...mockGroup,
        current_balance: 4600.00, // 92% of 5000
        credit_limit: 5000.00
      }

      const { container } = render(
        <BillingGroupCard
          group={veryHighUsageGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const progressWrapper = container.querySelector('.bg-red-100')
      expect(progressWrapper).toBeInTheDocument()
      expect(progressWrapper).toHaveAttribute('role', 'progressbar')
    })
  })

  describe('Rules count', () => {
    it('should show rules count when rules exist', () => {
      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('3 automation rules')).toBeInTheDocument()
    })

    it('should show singular form for single rule', () => {
      const groupWithOneRule = { ...mockGroup, rules_count: 1 }

      render(
        <BillingGroupCard
          group={groupWithOneRule}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('1 automation rule')).toBeInTheDocument()
    })

    it('should not show rules count when no rules', () => {
      const groupWithoutRules = { ...mockGroup, rules_count: 0 }

      render(
        <BillingGroupCard
          group={groupWithoutRules}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText(/automation rule/)).not.toBeInTheDocument()
    })

    it('should not show rules count when rules_count is null', () => {
      const groupWithNullRules = { ...mockGroup, rules_count: null }

      render(
        <BillingGroupCard
          group={groupWithNullRules}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText(/automation rule/)).not.toBeInTheDocument()
    })
  })

  describe('Selection state', () => {
    it('should apply selected styling when isSelected is true', () => {
      const { container } = render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          isSelected={true}
          onUpdate={mockOnUpdate}
        />
      )

      const card = container.firstChild
      expect(card).toHaveClass('ring-2', 'ring-primary')
    })

    it('should not apply selected styling when isSelected is false', () => {
      const { container } = render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          isSelected={false}
          onUpdate={mockOnUpdate}
        />
      )

      const card = container.firstChild
      expect(card).not.toHaveClass('ring-2', 'ring-primary')
    })

    it('should call onClick when card is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onClick={mockOnClick}
          onUpdate={mockOnUpdate}
        />
      )

      const card = screen.getByText('Corporate Account').closest('[role]') || 
                   screen.getByText('Corporate Account').closest('.cursor-pointer')
      
      if (card) {
        await user.click(card)
        expect(mockOnClick).toHaveBeenCalled()
      }
    })
  })

  describe('Dropdown menu', () => {
    it('should open dropdown menu when clicked', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      // Find the dropdown menu trigger button (MoreVertical icon)
      const buttons = screen.getAllByRole('button')
      const menuButton = buttons.find(btn => btn.querySelector('[aria-haspopup="menu"]')) || buttons[0]
      
      await user.click(menuButton)

      expect(screen.getByText('Edit Group')).toBeInTheDocument()
      expect(screen.getByText('Delete Group')).toBeInTheDocument()
    })

    it('should handle delete group with confirmation', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const menuButton = screen.getAllByRole('button')[0]
      await user.click(menuButton)

      const deleteButton = screen.getByText('Delete Group')
      await user.click(deleteButton)

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this billing group? All items will be unassigned.'
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
        // The first argument is a Request object when MSW is involved
        const [requestArg] = mockFetch.mock.calls[0]
        expect(requestArg.url || requestArg).toContain(`/api/v1/billing-groups/${mockGroup.id}`)
      })

      expect(mockOnUpdate).toHaveBeenCalled()
    })

    it('should not delete group when confirmation is cancelled', async () => {
      const user = userEvent.setup()
      ;(global.confirm as jest.Mock).mockReturnValue(false)

      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const menuButton = screen.getAllByRole('button')[0]
      await user.click(menuButton)

      const deleteButton = screen.getByText('Delete Group')
      await user.click(deleteButton)

      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockOnUpdate).not.toHaveBeenCalled()
    })

    it('should handle delete API error', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const menuButton = screen.getAllByRole('button')[0]
      await user.click(menuButton)

      const deleteButton = screen.getByText('Delete Group')
      ;(global.confirm as jest.Mock).mockReturnValue(true)
      await user.click(deleteButton)

      // Verify the error was handled (fetch was called but onUpdate wasn't)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
        // The first argument is a Request object when MSW is involved
        const [requestArg, options] = mockFetch.mock.calls[0]
        expect(requestArg.url || requestArg).toContain(`/api/v1/billing-groups/${mockGroup.id}`)
        expect(options).toEqual({ method: 'DELETE' })
        expect(mockOnUpdate).not.toHaveBeenCalled()
      })
    })

    it('should show loading state during deletion', async () => {
      const user = userEvent.setup()
      
      let resolvePromise: (value: any) => void
      const mockPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      mockFetch.mockReturnValue(mockPromise)

      const { container } = render(
        <BillingGroupCard
          group={mockGroup}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const menuButton = screen.getAllByRole('button')[0]
      await user.click(menuButton)

      const deleteButton = screen.getByText('Delete Group')
      await user.click(deleteButton)

      // Should show loading state
      expect(container.firstChild).toHaveClass('opacity-50')

      // Resolve the promise
      resolvePromise!({ ok: true })
      await waitFor(() => {
        expect(container.firstChild).not.toHaveClass('opacity-50')
      })
    })
  })
})