import { vi } from '@jest/globals'

// Mock user data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
}

// Mock session data
export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: 1234567890,
  token_type: 'bearer',
  user: mockUser,
}

// Mock database responses
export const mockMerchantData = {
  id: 'merchant-123',
  user_id: 'user-123',
  business_name: 'Test Business',
  email: 'merchant@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

export const mockTabData = {
  id: 'tab_123',
  merchant_id: 'merchant-123',
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  amount: 10000,
  paid_amount: 5000,
  status: 'partial',
  payment_link: 'https://example.com/pay/tab_123',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

// Create query builder mock
export const createQueryBuilderMock = (data: any = null, error: any = null) => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data, error })),
    maybeSingle: jest.fn(() => Promise.resolve({ data, error })),
    then: jest.fn((callback) => callback({ data, error })),
    throwOnError: jest.fn().mockReturnThis(),
  }
  
  return queryBuilder
}

// Create realtime subscription mock
export const createRealtimeMock = () => {
  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn((callback?: (status: string) => void) => {
      if (callback) callback('SUBSCRIBED')
      return channel
    }),
    unsubscribe: jest.fn(),
  }
  
  return {
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  }
}

// Create storage mock
export const createStorageMock = () => {
  const fileApi = {
    upload: jest.fn(() => Promise.resolve({ data: { path: 'test/file.jpg' }, error: null })),
    download: jest.fn(() => Promise.resolve({ data: new Blob(['test']), error: null })),
    remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
    list: jest.fn(() => Promise.resolve({ data: [], error: null })),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/file.jpg' } })),
  }
  
  return {
    from: jest.fn(() => fileApi),
  }
}

// Create auth mock
export const createAuthMock = (options: {
  user?: any
  session?: any
  error?: any
} = {}) => {
  const { 
    user = mockUser, 
    session = mockSession, 
    error = null 
  } = options
  
  return {
    getUser: jest.fn(() => Promise.resolve({ data: { user }, error })),
    getSession: jest.fn(() => Promise.resolve({ data: { session }, error })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user, session }, error })),
    signInWithOAuth: jest.fn(() => Promise.resolve({ data: { url: 'https://example.com/oauth' }, error })),
    signUp: jest.fn(() => Promise.resolve({ data: { user, session }, error })),
    signOut: jest.fn(() => Promise.resolve({ error })),
    resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error })),
    updateUser: jest.fn(() => Promise.resolve({ data: { user }, error })),
    onAuthStateChange: jest.fn((callback) => {
      // Immediately call the callback with the current session
      callback('SIGNED_IN', session)
      
      // Return unsubscribe function
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      }
    }),
  }
}

// Main Supabase client mock factory
export const createSupabaseMock = (options: {
  auth?: any
  data?: Record<string, any>
  error?: any
} = {}) => {
  const { auth, data = {}, error = null } = options
  
  const client = {
    auth: auth || createAuthMock(),
    from: jest.fn((table: string) => {
      const tableData = data[table] || null
      return createQueryBuilderMock(tableData, error)
    }),
    storage: createStorageMock(),
    realtime: createRealtimeMock(),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  }
  
  return client
}

// Helper to mock Supabase for server components
export const mockSupabaseServer = (options: {
  user?: any
  session?: any
  data?: Record<string, any>
  error?: any
} = {}) => {
  const client = createSupabaseMock(options)
  
  // Mock the server client creation
  jest.mock('@/lib/supabase/server', () => ({
    createServerClient: jest.fn(() => client),
    createServerActionClient: jest.fn(() => client),
    createServerComponentClient: jest.fn(() => client),
  }))
  
  return client
}

// Helper to mock Supabase for client components
export const mockSupabaseClient = (options: {
  user?: any
  session?: any
  data?: Record<string, any>
  error?: any
} = {}) => {
  const client = createSupabaseMock(options)
  
  // Mock the client creation
  jest.mock('@/lib/supabase/client', () => ({
    createBrowserClient: jest.fn(() => client),
  }))
  
  return client
}