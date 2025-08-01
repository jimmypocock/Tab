// This file sets up all the mocks needed for API testing

// Database mock setup
export const mockDb = {
  select: jest.fn(),
  from: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
  query: {
    tabs: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    lineItems: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    merchants: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    organizations: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    billingGroups: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    invoices: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    payments: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    apiKeys: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    organizationMembers: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    organizationInvitations: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    }
  }
}

// Organization context mock
export const mockOrganizationContext = {
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
  role: 'owner' as const,
  apiKey: {
    id: 'key_123',
    scope: 'full',
    environment: 'test' as const
  }
}

// Setup database mock chain methods
export function setupDbMocks() {
  const mockChain = {
    where: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
    returning: jest.fn().mockResolvedValue([])
  }
  
  mockDb.select.mockReturnValue({
    from: jest.fn().mockReturnValue(mockChain)
  })
  
  mockDb.from.mockReturnValue(mockChain)
  
  mockDb.insert.mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([])
    })
  })
  
  mockDb.update.mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([])
      })
    })
  })
  
  mockDb.delete.mockReturnValue({
    where: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([])
    })
  })
  
  mockDb.transaction.mockImplementation((cb: any) => cb(mockDb))
  
  return mockChain
}

// Clear all mocks
export function clearAllMocks() {
  jest.clearAllMocks()
  setupDbMocks()
}