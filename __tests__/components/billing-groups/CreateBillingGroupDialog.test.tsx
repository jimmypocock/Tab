import { describe, it, expect, beforeEach, jest, beforeAll, afterAll } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateBillingGroupDialog } from '@/components/dashboard/billing-groups/CreateBillingGroupDialog'
import { server } from '@/__tests__/mocks/server'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Disable MSW for these tests to use manual mocks
beforeAll(() => {
  server.close()
  
  // Mock hasPointerCapture for Radix UI
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = jest.fn(() => false)
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = jest.fn()
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = jest.fn()
  }
})
afterAll(() => server.listen())

describe('CreateBillingGroupDialog', () => {
  const mockOnOpenChange = jest.fn()
  const mockOnCreated = jest.fn()
  const mockTabId = 'tab_123'

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ 
        id: 'bg_new',
        name: 'Test Group',
        group_type: 'standard'
      })
    })
  })

  describe('Dialog visibility', () => {
    it('should not render when open is false', () => {
      render(
        <CreateBillingGroupDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      expect(screen.queryByText('Create Billing Group')).not.toBeInTheDocument()
    })

    it('should render when open is true', () => {
      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      expect(screen.getByText('Create Billing Group')).toBeInTheDocument()
      expect(screen.getByText('Create a new billing group to organize and split charges')).toBeInTheDocument()
    })
  })

  describe('Form fields', () => {
    beforeEach(() => {
      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )
    })

    it('should render all required form fields', () => {
      expect(screen.getByLabelText('Group Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Group Type')).toBeInTheDocument()
      expect(screen.getByLabelText('Payer Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    })

    it('should have standard as default group type', () => {
      // Radix UI Select shows the selected value in the trigger button
      const selectTrigger = screen.getByRole('combobox', { name: /group type/i })
      expect(selectTrigger).toHaveTextContent('Standard')
    })

  })


  describe('Form validation', () => {
    it('should require group name', async () => {
      const user = userEvent.setup()

      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const createButton = screen.getByRole('button', { name: /create group/i })
      await user.click(createButton)

      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })



  })

  describe('Form submission', () => {
    it('should create billing group with minimum required fields', async () => {
      const user = userEvent.setup()

      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const nameInput = screen.getByLabelText('Group Name')
      const createButton = screen.getByRole('button', { name: /create group/i })

      await user.type(nameInput, 'Test Group')
      await user.click(createButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Check the call was made with correct URL
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/billing-groups')
      
      // Check the method and headers
      const options = mockFetch.mock.calls[0][1]
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      
      // Check the body contains the expected data
      const body = JSON.parse(options.body)
      expect(body.name).toBe('Test Group')
      expect(body.group_type).toBe('standard')
      expect(body.tab_id).toBe(mockTabId)

      expect(mockOnCreated).toHaveBeenCalled()
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })



  })

  describe('Loading state', () => {
    it('should show loading state during form submission', async () => {
      const user = userEvent.setup()
      
      let resolvePromise: (value: any) => void
      const mockPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      mockFetch.mockReturnValue(mockPromise)

      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const nameInput = screen.getByLabelText('Group Name')
      const createButton = screen.getByRole('button', { name: /create group/i })

      await user.type(nameInput, 'Test Group')
      await user.click(createButton)

      // Should show loading spinner
      expect(screen.getByRole('button', { name: /create group/i })).toBeDisabled()
      expect(screen.getByText('Create Group')).toBeInTheDocument()

      // Resolve the promise
      resolvePromise!({ 
        ok: true, 
        json: async () => ({ id: 'bg_new' }) 
      })
      
      await waitFor(() => {
        expect(mockOnCreated).toHaveBeenCalled()
      })
    })

    it('should disable form submission while loading', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const nameInput = screen.getByLabelText('Group Name')
      const createButton = screen.getByRole('button', { name: /create group/i })

      await user.type(nameInput, 'Test Group')
      await user.click(createButton)

      expect(createButton).toBeDisabled()
    })
  })

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Validation failed' })
      })

      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const nameInput = screen.getByLabelText('Group Name')
      const createButton = screen.getByRole('button', { name: /create group/i })

      await user.type(nameInput, 'Test Group')
      await user.click(createButton)

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument()
      })

      // Dialog should remain open on error
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
      expect(mockOnCreated).not.toHaveBeenCalled()
    })
  })

  describe('Dialog controls', () => {
    it('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup()

      render(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('should reset form when dialog is opened again', () => {
      const { rerender } = render(
        <CreateBillingGroupDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      // Open dialog and fill form
      rerender(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      const nameInput = screen.getByLabelText('Group Name') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'Test Group' } })
      expect(nameInput.value).toBe('Test Group')

      // Close and reopen
      rerender(
        <CreateBillingGroupDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      rerender(
        <CreateBillingGroupDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          tabId={mockTabId}
          onCreated={mockOnCreated}
        />
      )

      // Form should be reset
      const newNameInput = screen.getByLabelText('Group Name') as HTMLInputElement
      expect(newNameInput.value).toBe('')
    })
  })
})