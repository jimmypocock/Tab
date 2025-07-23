import { CustomerTargetingService } from '@/lib/services/customer-targeting.service'
import { createClient } from '@/lib/supabase/server'

// Mock the Supabase client
jest.mock('@/lib/supabase/server')

const mockSelect = jest.fn()
const mockEq = jest.fn(() => ({ single: jest.fn() }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))
const mockSupabase = { from: mockFrom }

describe('CustomerTargetingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.MockedFunction<typeof createClient>).mockResolvedValue(mockSupabase as any)
    mockSelect.mockReturnValue({ eq: mockEq })
  })

  describe('validateCustomerTargeting', () => {
    it('should validate individual customer (email only)', () => {
      const result = CustomerTargetingService.validateCustomerTargeting({
        customerEmail: 'john@example.com',
        customerName: 'John Doe'
      })

      expect(result.isValid).toBe(true)
    })

    it('should validate organization customer (organization ID only)', () => {
      const result = CustomerTargetingService.validateCustomerTargeting({
        customerOrganizationId: '123e4567-e89b-12d3-a456-426614174000',
        customerName: 'Acme Corp'
      })

      expect(result.isValid).toBe(true)
    })

    it('should validate organization customer with email override', () => {
      const result = CustomerTargetingService.validateCustomerTargeting({
        customerEmail: 'billing@example.com',
        customerOrganizationId: '123e4567-e89b-12d3-a456-426614174000',
        customerName: 'Acme Corp'
      })

      expect(result.isValid).toBe(true)
    })

    it('should reject when neither email nor organization is provided', () => {
      const result = CustomerTargetingService.validateCustomerTargeting({
        customerName: 'John Doe'
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Must specify either customerEmail')
    })
  })

  describe('getCustomerTargeting', () => {

    it('should resolve individual customer targeting', async () => {
      const mockTab = {
        id: 'test-tab-id',
        customerEmail: 'john@example.com',
        customerName: 'John Doe',
        customerOrganizationId: null,
      } as any

      const result = await CustomerTargetingService.getCustomerTargeting(mockTab)

      expect(result.type).toBe('individual')
      expect(result.effectiveBillingEmail).toBe('john@example.com')
      expect(result.customerName).toBe('John Doe')
      expect(result.organization).toBeUndefined()
    })

    it('should resolve organization customer targeting with billing email', async () => {
      const customerOrgId = 'customer-org-id'
      const mockOrganization = {
        id: customerOrgId,
        name: 'Customer Corp',
        billing_email: 'billing@customer.com',
      }

      const mockSingle = jest.fn().mockResolvedValue({ data: mockOrganization, error: null })
      mockEq.mockReturnValue({ single: mockSingle })

      const mockTab = {
        id: 'test-tab-id',
        customerEmail: null,
        customerName: null,
        customerOrganizationId: customerOrgId,
      } as any

      const result = await CustomerTargetingService.getCustomerTargeting(mockTab)

      expect(result.type).toBe('organization')
      expect(result.effectiveBillingEmail).toBe('billing@customer.com')
      expect(result.customerName).toBe('Customer Corp')
      expect(result.organization).toMatchObject({
        id: customerOrgId,
        name: 'Customer Corp',
        billingEmail: 'billing@customer.com',
      })
    })

    it('should resolve organization customer targeting with email override', async () => {
      const customerOrgId = 'customer-org-id'
      const mockOrganization = {
        id: customerOrgId,
        name: 'Customer Corp',
        billing_email: 'billing@customer.com',
      }

      const mockSingle = jest.fn().mockResolvedValue({ data: mockOrganization, error: null })
      mockEq.mockReturnValue({ single: mockSingle })

      const mockTab = {
        id: 'test-tab-id',
        customerEmail: 'custom@billing.com', // Override email
        customerName: 'Custom Billing Contact',
        customerOrganizationId: customerOrgId,
      } as any

      const result = await CustomerTargetingService.getCustomerTargeting(mockTab)

      expect(result.type).toBe('organization')
      expect(result.effectiveBillingEmail).toBe('custom@billing.com') // Uses override
      expect(result.customerName).toBe('Custom Billing Contact')
      expect(result.organization).toMatchObject({
        id: customerOrgId,
        name: 'Customer Corp',
        billingEmail: 'billing@customer.com',
      })
    })

    it('should throw error when organization has no billing email and no override', async () => {
      const customerOrgId = 'customer-org-id'
      const mockOrganization = {
        id: customerOrgId,
        name: 'Customer Corp',
        billing_email: null, // No billing email
      }

      const mockSingle = jest.fn().mockResolvedValue({ data: mockOrganization, error: null })
      mockEq.mockReturnValue({ single: mockSingle })

      const mockTab = {
        id: 'test-tab-id',
        customerEmail: null, // No override
        customerName: null,
        customerOrganizationId: customerOrgId,
      } as any

      await expect(
        CustomerTargetingService.getCustomerTargeting(mockTab)
      ).rejects.toThrow('No billing email available for organization')
    })

    it('should throw error for individual customer without email', async () => {
      const mockTab = {
        id: 'test-tab-id',
        customerEmail: null,
        customerName: 'John Doe',
        customerOrganizationId: null,
      } as any

      await expect(
        CustomerTargetingService.getCustomerTargeting(mockTab)
      ).rejects.toThrow('customerEmail is required for individual customers')
    })
  })

  describe('getBillingContext', () => {
    it('should return context for individual customer', () => {
      const targeting = {
        type: 'individual' as const,
        effectiveBillingEmail: 'john@example.com',
        customerName: 'John Doe',
      }

      const context = CustomerTargetingService.getBillingContext(targeting)

      expect(context).toMatchObject({
        billingEmail: 'john@example.com',
        customerName: 'John Doe',
        isOrganization: false,
        organizationName: undefined,
        hasEmailOverride: false,
      })
    })

    it('should return context for organization customer with override', () => {
      const targeting = {
        type: 'organization' as const,
        effectiveBillingEmail: 'custom@billing.com',
        customerName: 'Custom Contact',
        organization: {
          id: 'org-id',
          name: 'Customer Corp',
          billingEmail: 'billing@customer.com',
        }
      }

      const context = CustomerTargetingService.getBillingContext(targeting)

      expect(context).toMatchObject({
        billingEmail: 'custom@billing.com',
        customerName: 'Custom Contact',
        isOrganization: true,
        organizationName: 'Customer Corp',
        hasEmailOverride: true,
      })
    })
  })
})