import { render, screen, fireEvent, waitFor } from '@/__tests__/helpers/test-utils'
import userEvent from '@testing-library/user-event'
import TeamSettingsPage from '@/app/(dashboard)/settings/team/page'
import { useOrganization } from '@/components/dashboard/organization-provider'
import * as teamActions from '@/app/(dashboard)/settings/team/actions'

// Mock the organization provider
jest.mock('@/components/dashboard/organization-provider', () => ({
  useOrganization: jest.fn()
}))

// Mock the server actions
jest.mock('@/app/(dashboard)/settings/team/actions', () => ({
  getTeamMembers: jest.fn(),
  inviteTeamMember: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  cancelInvitation: jest.fn(),
  resendInvitation: jest.fn()
}))

describe('TeamSettingsPage', () => {
  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org'
  }

  const mockTeamMembers = [
    {
      id: 'member-1',
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        full_name: 'John Owner'
      },
      role: 'owner',
      status: 'active',
      joinedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'member-2',
      user: {
        id: 'user-2',
        email: 'admin@example.com',
        full_name: 'Jane Admin'
      },
      role: 'admin',
      status: 'active',
      department: 'Engineering',
      title: 'CTO',
      joinedAt: '2024-01-02T00:00:00Z'
    },
    {
      id: 'member-3',
      user: null,
      role: 'member',
      status: 'pending_invitation',
      invitedAt: '2024-01-03T00:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useOrganization as jest.MockedFunction<typeof useOrganization>).mockReturnValue({
      currentOrganization: mockOrganization,
      userRole: 'owner',
      organizations: [mockOrganization],
      setCurrentOrganization: jest.fn()
    })
    ;(teamActions.getTeamMembers as jest.MockedFunction<typeof teamActions.getTeamMembers>).mockResolvedValue(mockTeamMembers)
  })

  describe('Team Members Display', () => {
    it('should display all team members', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('owner@example.com')).toBeInTheDocument()
        expect(screen.getByText('admin@example.com')).toBeInTheDocument()
        expect(screen.getByText('Pending invitation')).toBeInTheDocument()
      })
    })

    it('should display member roles and metadata', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Owner')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Admin')[0]).toBeInTheDocument()
        expect(screen.getByText('Engineering')).toBeInTheDocument()
        expect(screen.getByText('• CTO')).toBeInTheDocument()
      })
    })

    it('should display role descriptions', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Full access, can delete organization')).toBeInTheDocument()
        expect(screen.getByText('Full access except delete organization')).toBeInTheDocument()
        expect(screen.getByText('Create/edit tabs, invoices, view reports')).toBeInTheDocument()
        expect(screen.getByText('Read-only access to data')).toBeInTheDocument()
      })
    })
  })

  describe('Invitation Management', () => {
    it('should show invite button for authorized users', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })
    })

    it('should not show invite button for non-admin users', async () => {
      ;(useOrganization as jest.MockedFunction<typeof useOrganization>).mockReturnValue({
        currentOrganization: mockOrganization,
        userRole: 'viewer',
        organizations: [mockOrganization],
        setCurrentOrganization: jest.fn()
      })

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.queryByText('Invite Member')).not.toBeInTheDocument()
      })
    })

    it('should show and hide invitation form', async () => {
      const user = userEvent.setup()
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      // Click invite button
      await user.click(screen.getByText('Invite Member'))
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()

      // Cancel invitation
      await user.click(screen.getAllByText('Cancel')[0])
      expect(screen.queryByText('Invite Team Member')).not.toBeInTheDocument()
    })

    it('should send invitation successfully', async () => {
      const user = userEvent.setup()
      ;(teamActions.inviteTeamMember as jest.MockedFunction<typeof teamActions.inviteTeamMember>).mockResolvedValue({ success: true })

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      // Open invite form
      await user.click(screen.getByText('Invite Member'))

      // Fill form
      await user.type(screen.getByPlaceholderText('colleague@company.com'), 'newuser@example.com')
      await user.selectOptions(screen.getByLabelText('Role'), 'admin')

      // Send invitation
      await user.click(screen.getByText('Send Invitation'))

      await waitFor(() => {
        expect(teamActions.inviteTeamMember).toHaveBeenCalledWith(
          'org-123',
          'newuser@example.com',
          'admin'
        )
      })
    })

    it('should handle invitation errors', async () => {
      const user = userEvent.setup()
      ;(teamActions.inviteTeamMember as jest.MockedFunction<typeof teamActions.inviteTeamMember>).mockResolvedValue({ 
        error: 'User already exists' 
      })

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      // Open and fill form
      await user.click(screen.getByText('Invite Member'))
      await user.type(screen.getByPlaceholderText('colleague@company.com'), 'existing@example.com')
      await user.click(screen.getByText('Send Invitation'))

      // Check for error toast
      await waitFor(() => {
        expect(screen.getByText('Failed to send invitation')).toBeInTheDocument()
        expect(screen.getByText('User already exists')).toBeInTheDocument()
      })
    })
  })

  describe('Pending Invitations', () => {
    it('should show resend and cancel options for pending invitations', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Resend')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })
    })

    it('should resend invitation', async () => {
      const user = userEvent.setup()
      ;(teamActions.resendInvitation as jest.MockedFunction<typeof teamActions.resendInvitation>).mockResolvedValue({ success: true })

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Resend')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Resend'))

      await waitFor(() => {
        expect(teamActions.resendInvitation).toHaveBeenCalledWith('org-123', 'member-3')
        // Check for success toast
        expect(screen.getByText('Invitation resent')).toBeInTheDocument()
      })
    })

    it('should cancel invitation', async () => {
      const user = userEvent.setup()
      ;(teamActions.cancelInvitation as jest.MockedFunction<typeof teamActions.cancelInvitation>).mockResolvedValue({ success: true })

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(teamActions.cancelInvitation).toHaveBeenCalledWith('org-123', 'member-3')
      })
    })
  })

  describe('Member Management', () => {
    it('should not show actions for organization owner', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        // Find the owner's row
        const ownerEmail = screen.getByText('owner@example.com')
        const ownerRow = ownerEmail.closest('li')
        
        // Should not have any action buttons
        expect(ownerRow?.querySelector('button[aria-label*="More"]')).not.toBeInTheDocument()
      })
    })

    it('should show actions for non-owner members', async () => {
      render(<TeamSettingsPage />)

      await waitFor(() => {
        // Find admin's row
        const adminEmail = screen.getByText('admin@example.com')
        const adminRow = adminEmail.closest('li')
        
        // Should have action button
        const moreButton = adminRow?.querySelector('button')
        expect(moreButton).toBeInTheDocument()
      })
    })

    it('should remove member with confirmation', async () => {
      const user = userEvent.setup()
      ;(teamActions.removeMember as jest.MockedFunction<typeof teamActions.removeMember>).mockResolvedValue({ success: true })
      const mockConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true)

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument()
      })

      // Find and click the more button for admin
      const adminRow = screen.getByText('admin@example.com').closest('li')
      const moreButton = adminRow?.querySelector('button')
      
      if (moreButton) {
        await user.click(moreButton)
        
        // Click remove option
        await user.click(screen.getByText('Remove Member'))

        await waitFor(() => {
          expect(mockConfirm).toHaveBeenCalledWith(
            'Are you sure you want to remove this member from the organization?'
          )
          expect(teamActions.removeMember).toHaveBeenCalledWith('org-123', 'member-2')
        })
      }

      mockConfirm.mockRestore()
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading state initially', () => {
      ;(teamActions.getTeamMembers as jest.MockedFunction<typeof teamActions.getTeamMembers>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { container } = render(<TeamSettingsPage />)
      
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('should handle errors when loading team members', async () => {
      ;(teamActions.getTeamMembers as jest.MockedFunction<typeof teamActions.getTeamMembers>).mockRejectedValue(
        new Error('Failed to load')
      )

      render(<TeamSettingsPage />)

      // Check for error toast
      await waitFor(() => {
        expect(screen.getByText('Failed to load team members')).toBeInTheDocument()
        expect(screen.getByText('Please try again later')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no team members', async () => {
      ;(teamActions.getTeamMembers as jest.MockedFunction<typeof teamActions.getTeamMembers>).mockResolvedValue([])

      render(<TeamSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('No team members')).toBeInTheDocument()
        expect(screen.getByText('Get started by inviting team members to your organization.')).toBeInTheDocument()
      })
    })
  })
})