import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrganizationSwitcher } from '@/components/dashboard/organization-switcher'
import { switchOrganization } from '@/app/(dashboard)/actions/organization-actions'

// Mock the server action
jest.mock('@/app/(dashboard)/actions/organization-actions', () => ({
  switchOrganization: jest.fn(),
}))

describe('OrganizationSwitcher', () => {
  const mockOrganizations = [
    {
      id: 'org-1',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      is_merchant: true,
      is_corporate: false,
    },
    {
      id: 'org-2',
      name: 'Beta Industries',
      slug: 'beta-ind',
      is_merchant: false,
      is_corporate: true,
    },
    {
      id: 'org-3',
      name: 'Gamma Holdings',
      slug: 'gamma-holdings',
      is_merchant: true,
      is_corporate: true,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders single organization without switcher', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={[mockOrganizations[0]]}
        userRole="owner"
      />
    )

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('Merchant')).toBeInTheDocument()
    
    // Switcher should not be clickable
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders multiple organizations with switcher', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={mockOrganizations}
        userRole="admin"
      />
    )

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={mockOrganizations}
        userRole="member"
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Check all organizations are shown
    expect(screen.getByText('Switch organization')).toBeInTheDocument()
    expect(screen.getAllByText('Acme Corporation')).toHaveLength(2) // Current + in list
    expect(screen.getByText('Beta Industries')).toBeInTheDocument()
    expect(screen.getByText('Gamma Holdings')).toBeInTheDocument()
    
    // Check badges
    expect(screen.getByText('Corporate')).toBeInTheDocument()
    expect(screen.getByText('Merchant & Corporate')).toBeInTheDocument()
  })

  it('shows checkmark for current organization', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[1]}
        organizations={mockOrganizations}
        userRole="viewer"
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Find the button for the current org (in the dropdown list)
    const betaButtons = screen.getAllByText('Beta Industries')
    const betaListButton = betaButtons[1].closest('button')
    expect(betaListButton).toHaveClass('bg-blue-50')
    
    // Other orgs shouldn't have special styling
    const acmeButton = screen.getByText('Acme Corporation').closest('button')
    expect(acmeButton).not.toHaveClass('bg-blue-50')
  })

  it('switches organization on selection', async () => {
    const mockSwitchOrg = switchOrganization as jest.MockedFunction<typeof switchOrganization>
    mockSwitchOrg.mockResolvedValueOnce()

    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={mockOrganizations}
        userRole="owner"
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Click on Beta Industries
    const betaButton = screen.getByText('Beta Industries').closest('button')!
    fireEvent.click(betaButton)

    await waitFor(() => {
      expect(mockSwitchOrg).toHaveBeenCalledWith('org-2')
    })
  })

  it('does not switch when clicking current organization', async () => {
    const mockSwitchOrg = switchOrganization as jest.MockedFunction<typeof switchOrganization>

    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={mockOrganizations}
        userRole="owner"
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Click on current org (Acme)
    const acmeButtons = screen.getAllByText('Acme Corporation')
    const acmeListButton = acmeButtons[1].closest('button')!
    fireEvent.click(acmeListButton)

    expect(mockSwitchOrg).not.toHaveBeenCalled()
  })

  it('shows create new organization link', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={mockOrganizations}
        userRole="owner"
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const createLink = screen.getByText('+ Create new organization')
    expect(createLink).toBeInTheDocument()
    expect(createLink.closest('a')).toHaveAttribute('href', '/organizations/new')
  })

  it('closes dropdown when clicking backdrop', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[0]}
        organizations={mockOrganizations}
        userRole="owner"
      />
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Switch organization')).toBeInTheDocument()

    // Click backdrop
    const backdrop = document.querySelector('.fixed.inset-0')!
    fireEvent.click(backdrop)

    expect(screen.queryByText('Switch organization')).not.toBeInTheDocument()
  })

  it('displays correct icons and badges for organization types', () => {
    render(
      <OrganizationSwitcher
        currentOrganization={mockOrganizations[2]} // Merchant & Corporate
        organizations={mockOrganizations}
        userRole="owner"
      />
    )

    // Check current org shows both merchant and corporate badge
    expect(screen.getByText('Merchant & Corporate')).toBeInTheDocument()
  })
})