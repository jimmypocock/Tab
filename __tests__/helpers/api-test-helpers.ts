import { NextRequest } from 'next/server'

export interface MockOrganizationContext {
  organizationId: string
  organization: {
    id: string
    name: string
    isMerchant: boolean
    merchantId?: string | null
    stripeAccountId?: string | null
  }
  user: {
    id: string
    email: string
    name?: string
  }
  role: 'owner' | 'admin' | 'member' | 'viewer'
  apiKey?: {
    id: string
    scope: string
    environment: 'test' | 'live'
  }
}

export const DEFAULT_MOCK_CONTEXT: MockOrganizationContext = {
  organizationId: 'org_123',
  organization: {
    id: 'org_123',
    name: 'Test Organization',
    isMerchant: true,
    merchantId: 'merchant_123',
    stripeAccountId: 'acct_test123'
  },
  user: {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User'
  },
  role: 'owner',
  apiKey: {
    id: 'key_123',
    scope: 'full',
    environment: 'test'
  }
}

export function createMockRequest(
  method: string,
  url: string,
  options: {
    body?: any
    headers?: Record<string, string>
    params?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { body, headers = {}, searchParams = {} } = options
  
  // Build URL with search params
  const urlObj = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value)
  })
  
  // Default headers
  const defaultHeaders = {
    'content-type': 'application/json',
    'x-api-key': 'tab_test_12345678901234567890123456789012',
    ...headers
  }
  
  const request = new NextRequest(urlObj.toString(), {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined
  })
  
  return request
}

export function createAuthenticatedRequest(
  method: string,
  url: string,
  options: Parameters<typeof createMockRequest>[2] = {}
): NextRequest {
  return createMockRequest(method, url, {
    ...options,
    headers: {
      'x-api-key': 'tab_test_12345678901234567890123456789012',
      ...options.headers
    }
  })
}

export async function parseResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function expectSuccessResponse(response: Response, statusCode = 200) {
  expect(response.status).toBe(statusCode)
  expect(response.headers.get('content-type')).toContain('application/json')
}

export function expectErrorResponse(response: Response, statusCode: number, errorMessage?: string) {
  expect(response.status).toBe(statusCode)
  if (errorMessage) {
    return expect(parseResponse(response)).resolves.toMatchObject({
      error: expect.stringContaining(errorMessage)
    })
  }
}

export function expectPaginatedResponse(data: any) {
  expect(data).toMatchObject({
    data: expect.any(Array),
    pagination: {
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
      totalItems: expect.any(Number)
    }
  })
}

export function expectValidationError(response: Response, field?: string) {
  expect(response.status).toBe(400)
  return expect(parseResponse(response)).resolves.toMatchObject({
    error: expect.stringContaining(field || 'validation')
  })
}

export function mockSupabaseAuth(userId = 'user_123', orgId = 'org_123') {
  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: 'test@example.com'
          }
        },
        error: null
      })
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: orgId,
              name: 'Test Organization'
            },
            error: null
          })
        }))
      }))
    }))
  }
  
  return mockSupabase
}

// Common test data factories
export const TestDataFactory = {
  tab: (overrides = {}) => ({
    id: 'tab_123',
    organizationId: 'org_123',
    status: 'open',
    currency: 'USD',
    totalAmount: '100.00',
    subtotal: '90.91',
    taxAmount: '9.09',
    paidAmount: '0.00',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerOrganizationId: null,
    externalReference: null,
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  }),
  
  lineItem: (overrides = {}) => ({
    id: 'item_123',
    tabId: 'tab_123',
    organizationId: 'org_123',
    billingGroupId: null,
    description: 'Test Item',
    quantity: '1',
    unitPrice: '90.91',
    totalPrice: '90.91',
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  }),
  
  billingGroup: (overrides = {}) => ({
    id: 'group_123',
    organizationId: 'org_123',
    name: 'Test Group',
    description: 'Test billing group',
    isDefault: false,
    displayOrder: 0,
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  }),
  
  payment: (overrides = {}) => ({
    id: 'payment_123',
    tabId: 'tab_123',
    organizationId: 'org_123',
    amount: '50.00',
    currency: 'USD',
    status: 'completed',
    processor: 'stripe',
    processorPaymentId: 'pi_test123',
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  }),
  
  invoice: (overrides = {}) => ({
    id: 'invoice_123',
    tabId: 'tab_123',
    billingGroupId: 'group_123',
    organizationId: 'org_123',
    invoiceNumber: 'INV-001',
    publicUrl: 'inv_test123',
    status: 'pending',
    dueDate: new Date('2023-02-01'),
    totalAmount: '100.00',
    paidAmount: '0.00',
    currency: 'USD',
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  }),
  
  organization: (overrides = {}) => ({
    id: 'org_123',
    name: 'Test Organization',
    isMerchant: true,
    merchantId: 'merchant_123',
    customerOrganizationCode: 'TESTORG',
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  }),
  
  apiKey: (overrides = {}) => ({
    id: 'key_123',
    organizationId: 'org_123',
    name: 'Test Key',
    keyHash: 'hashed_key',
    lastUsedAt: null,
    usageCount: 0,
    isActive: true,
    scope: 'full',
    environment: 'test',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    ...overrides
  })
}