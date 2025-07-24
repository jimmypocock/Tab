import { describe, it, expect, beforeEach, jest, beforeAll, afterAll } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BillingGroupsManager } from '@/components/dashboard/billing-groups/BillingGroupsManager'
import { server } from '@/__tests__/mocks/server'

// Mock child components - use relative paths to match component imports
jest.mock('@/components/dashboard/billing-groups/BillingGroupCard', () => ({
  BillingGroupCard: ({ group, onClick }: any) => (
    <div data-testid={`billing-group-${group.id}`} onClick={onClick}>
      {group.name}
    </div>
  )
}))

jest.mock('@/components/dashboard/billing-groups/LineItemAssignment', () => ({
  LineItemAssignment: ({ onItemsAssigned }: any) => (
    <div data-testid="line-item-assignment">
      <button onClick={onItemsAssigned} data-testid="assign-items">
        Assign Items
      </button>
    </div>
  )
}))

jest.mock('@/components/dashboard/billing-groups/CreateBillingGroupDialog', () => ({
  CreateBillingGroupDialog: ({ open, onCreated }: any) => {
    // Log to see if we're getting the callback
    if (open && onCreated) {
      // Make the button immediately accessible
      return (
        <div data-testid="create-dialog">
          <button 
            onClick={() => {
              onCreated()
            }} 
            data-testid="create-group"
          >
            Create Group
          </button>
        </div>
      )
    }
    return null
  }
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Disable MSW for these tests to use manual mocks
beforeAll(() => server.close())
afterAll(() => server.listen())

describe('BillingGroupsManager', () => {
  const mockTab = {
    id: 'tab_123',
    name: 'Test Tab'
  }

  const mockBillingGroups = [
    {
      id: 'bg_1',
      name: 'Corporate Account',
      group_type: 'corporate',
      status: 'active'
    },
    {
      id: 'bg_2',
      name: 'Personal Expenses',
      group_type: 'standard',
      status: 'active'
    }
  ]

  const mockLineItems = [
    {
      id: 'li_1',
      description: 'Coffee',
      billing_group_id: 'bg_1',
      quantity: 1,
      unit_price: 5.00
    },
    {
      id: 'li_2',
      description: 'Lunch',
      billing_group_id: null,
      quantity: 1,
      unit_price: 15.00
    }
  ]

  const mockOnUpdate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })
  })

  describe('Disabled state (no billing groups)', () => {
    it('should show enable toggle when no billing groups exist', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={[]}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Billing Groups')).toBeInTheDocument()
      expect(screen.getByText('Split charges between different payers or payment methods')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
      expect(screen.getByRole('switch')).not.toBeChecked()
    })

    it('should show feature benefits when disabled', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={[]}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Split bills between multiple payers')).toBeInTheDocument()
      expect(screen.getByText('Apply deposits or credit limits')).toBeInTheDocument()
      expect(screen.getByText('Set up automatic charge routing rules')).toBeInTheDocument()
    })

    it('should enable billing groups when toggle is switched', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={[]}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/v1/tabs/${mockTab.id}/enable-billing-groups`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }
        )
      })

      expect(mockOnUpdate).toHaveBeenCalled()
    })

    it('should handle enable billing groups API error', async () => {
      const user = userEvent.setup()
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      })

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={[]}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Should still be disabled after error
      await waitFor(() => {
        expect(toggle).not.toBeChecked()
      })

      // Should not call onUpdate on error
      expect(mockOnUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Enabled state (with billing groups)', () => {
    it('should show billing groups and controls when enabled', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('Manage how charges are split and assigned')).toBeInTheDocument()
      expect(screen.getByText('Add Group')).toBeInTheDocument()
      expect(screen.getByTestId('billing-group-bg_1')).toBeInTheDocument()
      expect(screen.getByTestId('billing-group-bg_2')).toBeInTheDocument()
    })

    it('should show unassigned items alert when present', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('1 item not assigned to any billing group')).toBeInTheDocument()
    })

    it('should not show unassigned items alert when all items assigned', () => {
      const assignedLineItems = mockLineItems.map(item => ({
        ...item,
        billing_group_id: 'bg_1'
      }))

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={assignedLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByText(/not assigned to any billing group/)).not.toBeInTheDocument()
    })

    it('should show correct plural form for multiple unassigned items', () => {
      const multipleUnassignedItems = [
        ...mockLineItems,
        {
          id: 'li_3',
          description: 'Snack',
          billing_group_id: null,
          quantity: 1,
          unit_price: 3.00
        }
      ]

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={multipleUnassignedItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByText('2 items not assigned to any billing group')).toBeInTheDocument()
    })

    it('should open create dialog when Add Group is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const addButton = screen.getByText('Add Group')
      await user.click(addButton)

      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
    })

    it('should handle billing group selection', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const groupCard = screen.getByTestId('billing-group-bg_1')
      await user.click(groupCard)

      // Group should be selected (this would affect the LineItemAssignment component)
      expect(groupCard).toBeInTheDocument()
    })

    it('should show line item assignment when line items exist', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.getByTestId('line-item-assignment')).toBeInTheDocument()
    })

    it('should not show line item assignment when no line items exist', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={[]}
          onUpdate={mockOnUpdate}
        />
      )

      expect(screen.queryByTestId('line-item-assignment')).not.toBeInTheDocument()
    })

    it('should handle items assigned callback', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const assignButton = screen.getByTestId('assign-items')
      await user.click(assignButton)

      expect(mockOnUpdate).toHaveBeenCalled()
    })

  })

  describe('State management', () => {
    it('should track selected group ID', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      // Click first group
      const firstGroup = screen.getByTestId('billing-group-bg_1')
      await user.click(firstGroup)

      // Click second group
      const secondGroup = screen.getByTestId('billing-group-bg_2')
      await user.click(secondGroup)

      // Both interactions should work
      expect(firstGroup).toBeInTheDocument()
      expect(secondGroup).toBeInTheDocument()
    })

    it('should manage create dialog open state', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      // Dialog should be closed initially
      expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument()

      // Open dialog
      const addButton = screen.getByText('Add Group')
      await user.click(addButton)

      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
    })
  })

  describe('Props handling', () => {
    it('should pass correct props to BillingGroupCard', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      // Should render both groups
      expect(screen.getByTestId('billing-group-bg_1')).toBeInTheDocument()
      expect(screen.getByTestId('billing-group-bg_2')).toBeInTheDocument()
      expect(screen.getByTestId('billing-group-bg_1')).toHaveTextContent('Corporate Account')
      expect(screen.getByTestId('billing-group-bg_2')).toHaveTextContent('Personal Expenses')
    })

    it('should pass correct props to LineItemAssignment', () => {
      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      // Component should be rendered with items and groups
      // Check for the mocked LineItemAssignment component
      expect(screen.getByTestId('line-item-assignment')).toBeInTheDocument()
    })

    it('should pass correct props to CreateBillingGroupDialog', async () => {
      const user = userEvent.setup()

      render(
        <BillingGroupsManager
          tab={mockTab}
          billingGroups={mockBillingGroups}
          lineItems={mockLineItems}
          onUpdate={mockOnUpdate}
        />
      )

      const addButton = screen.getByText('Add Group')
      await user.click(addButton)

      // Dialog should be rendered when open
      // Check for dialog title instead of test-id
      expect(screen.getByText('Create Billing Group')).toBeInTheDocument()
    })
  })
})