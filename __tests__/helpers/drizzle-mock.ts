import { jest } from '@jest/globals'

/**
 * Creates a complete mock of Drizzle ORM's query API
 * This properly mocks the relational query syntax used by db.query.table.findMany()
 */
export function createDrizzleMock() {
  // Helper to create chainable query methods
  const createQueryChain = (defaultResult: any = []) => {
    const chain: any = {
      where: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue(defaultResult),
      execute: jest.fn().mockResolvedValue(defaultResult),
      then: jest.fn((resolve) => resolve(defaultResult))
    }
    
    // Make all methods return the chain for fluent API
    Object.keys(chain).forEach(key => {
      if (key !== 'then' && key !== 'execute' && key !== 'returning') {
        chain[key].mockReturnValue(chain)
      }
    })
    
    return chain
  }

  // Create relational query mocks
  const createRelationalQuery = () => ({
    findFirst: jest.fn().mockImplementation((config?: any) => {
      return Promise.resolve(null)
    }),
    findMany: jest.fn().mockImplementation((config?: any) => {
      return Promise.resolve([])
    })
  })

  // Main mock object
  const mock = {
    // Query builder methods
    select: jest.fn(() => ({
      from: jest.fn(() => createQueryChain())
    })),
    
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue([])
      }))
    })),
    
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
          execute: jest.fn().mockResolvedValue([])
        }))
      }))
    })),
    
    delete: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue([])
      }))
    })),
    
    // Transaction support
    transaction: jest.fn().mockImplementation(async (callback) => {
      // Pass the same mock to the transaction callback
      return callback(mock)
    }),
    
    // Relational query API - this is what db.query uses
    query: {
      tabs: createRelationalQuery(),
      lineItems: createRelationalQuery(),
      organizations: createRelationalQuery(),
      organizationMembers: createRelationalQuery(),
      organizationInvitations: createRelationalQuery(),
      merchants: createRelationalQuery(),
      paymentProcessors: createRelationalQuery(),
      billingGroups: createRelationalQuery(),
      billingGroupRules: createRelationalQuery(),
      invoices: createRelationalQuery(),
      payments: createRelationalQuery(),
      apiKeys: createRelationalQuery(),
      auditLogs: createRelationalQuery(),
    }
  }
  
  return mock
}

/**
 * Helper to set up mock responses for specific queries
 */
export function mockDrizzleResponse(
  mock: ReturnType<typeof createDrizzleMock>,
  table: keyof ReturnType<typeof createDrizzleMock>['query'],
  method: 'findFirst' | 'findMany',
  response: any
) {
  mock.query[table][method].mockResolvedValueOnce(response)
}

/**
 * Helper to set up chained query responses
 */
export function mockChainedQuery(
  mock: ReturnType<typeof createDrizzleMock>,
  operation: 'select' | 'insert' | 'update' | 'delete',
  response: any
) {
  switch (operation) {
    case 'select':
      const selectChain = createQueryChain(response)
      mock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce(selectChain)
      })
      break
      
    case 'insert':
      mock.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce(response),
          execute: jest.fn().mockResolvedValueOnce(response)
        })
      })
      break
      
    case 'update':
      mock.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce(response),
            execute: jest.fn().mockResolvedValueOnce(response)
          })
        })
      })
      break
      
    case 'delete':
      mock.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce(response),
          execute: jest.fn().mockResolvedValueOnce(response)
        })
      })
      break
  }
}

// Helper to create chainable query builder
function createQueryChain(defaultResult: any = []) {
  const methods = {
    where: jest.fn(),
    eq: jest.fn(),
    and: jest.fn(),
    or: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    execute: jest.fn().mockResolvedValue(defaultResult),
    returning: jest.fn().mockResolvedValue(defaultResult)
  }
  
  // Make chainable
  Object.keys(methods).forEach(key => {
    if (key !== 'execute' && key !== 'returning') {
      (methods as any)[key].mockReturnValue(methods)
    }
  })
  
  return methods
}