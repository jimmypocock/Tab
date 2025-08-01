type QueryBuilder = {
  select: jest.Mock
  from: jest.Mock
  where: jest.Mock
  eq: jest.Mock
  and: jest.Mock
  or: jest.Mock
  not: jest.Mock
  orderBy: jest.Mock
  limit: jest.Mock
  offset: jest.Mock
  innerJoin: jest.Mock
  leftJoin: jest.Mock
  insert: jest.Mock
  values: jest.Mock
  returning: jest.Mock
  update: jest.Mock
  set: jest.Mock
  delete: jest.Mock
  count: jest.Mock
  groupBy: jest.Mock
  having: jest.Mock
  distinct: jest.Mock
}

export function createMockQueryBuilder(defaultResult: any = []): QueryBuilder & { execute: jest.Mock } {
  const execute = jest.fn().mockResolvedValue(defaultResult)
  
  const methods: QueryBuilder = {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    eq: jest.fn((column, value) => ({ column, value })),
    and: jest.fn(),
    or: jest.fn(),
    not: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    insert: jest.fn(),
    values: jest.fn(),
    returning: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    having: jest.fn(),
    distinct: jest.fn(),
  }

  // Make all methods return 'this' for chaining
  Object.keys(methods).forEach(key => {
    (methods as any)[key].mockReturnValue(new Proxy({}, {
      get(target, prop) {
        if (prop === 'execute' || prop === 'then') {
          return execute
        }
        if (prop in methods) {
          return (methods as any)[prop]
        }
        // Return a function that returns the proxy for any unknown method
        return jest.fn().mockReturnValue(this)
      }
    }))
  })

  return { ...methods, execute }
}

export function createMockDb() {
  const mockQueryBuilder = createMockQueryBuilder()
  
  return {
    // Main query methods
    select: mockQueryBuilder.select,
    from: mockQueryBuilder.from,
    insert: mockQueryBuilder.insert,
    update: mockQueryBuilder.update,
    delete: mockQueryBuilder.delete,
    
    // Transaction support
    transaction: jest.fn((callback) => {
      const tx = {
        select: mockQueryBuilder.select,
        from: mockQueryBuilder.from,
        insert: mockQueryBuilder.insert,
        update: mockQueryBuilder.update,
        delete: mockQueryBuilder.delete,
        rollback: jest.fn(),
        commit: jest.fn(),
      }
      return callback(tx)
    }),
    
    // Query object for relational queries
    query: {
      tabs: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      lineItems: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      merchants: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      organizations: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      billingGroups: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      invoices: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      payments: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      apiKeys: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      organizationMembers: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      organizationInvitations: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
    
    // Schema exports
    schema: {
      tabs: {},
      lineItems: {},
      merchants: {},
      organizations: {},
      billingGroups: {},
      invoices: {},
      payments: {},
      apiKeys: {},
    }
  }
}

export function mockDbResponse(mockDb: any, method: string, response: any) {
  const chain = {
    where: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(response),
    execute: jest.fn().mockResolvedValue(response),
    then: (resolve: any) => resolve(response)
  }
  
  if (method === 'select') {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue(chain)
    })
  } else if (method === 'insert') {
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(response)
      })
    })
  } else if (method === 'update') {
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(response)
        })
      })
    })
  } else if (method === 'delete') {
    mockDb.delete.mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(response)
      })
    })
  }
}