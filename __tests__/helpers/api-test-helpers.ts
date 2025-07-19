import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'

interface CreateRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: any
  searchParams?: Record<string, string>
}

export function createTestRequest(
  url: string,
  options: CreateRequestOptions = {}
): NextRequest {
  const { method = 'GET', headers = {}, body, searchParams } = options
  
  // Build URL with search params
  const fullUrl = new URL(url, 'http://localhost:3000')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value)
    })
  }
  
  // Create request options
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  
  // Add body if provided
  if (body && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = JSON.stringify(body)
  }
  
  return new NextRequest(fullUrl.toString(), requestInit)
}

export function createAuthenticatedRequest(
  url: string,
  apiKey: string,
  options: CreateRequestOptions = {}
): NextRequest {
  return createTestRequest(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-API-Key': apiKey,
    },
  })
}

// Helper to extract response data
export async function getResponseData<T = any>(response: NextResponse): Promise<T> {
  // Clone the response to avoid "Body has already been read" errors
  const clonedResponse = response.clone()
  const text = await clonedResponse.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON response: ${text}`)
  }
}

// Mock implementations for testing
export const mockImplementations = {
  // Mock successful API key validation
  validApiKey: (merchantId: string) => {
    const apiKey = `tab_test_${crypto.randomBytes(16).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
    
    return {
      key: apiKey,
      mockData: {
        id: crypto.randomUUID(),
        merchantId,
        keyHash,
        keyPrefix: apiKey.substring(0, 8),
        isActive: true,
        environment: 'test',
        merchant: {
          id: merchantId,
          businessName: 'Test Business',
          userId: crypto.randomUUID(),
        }
      }
    }
  },
  
  // Mock database queries
  mockDbQueries: () => ({
    'apiKeys.findFirst': jest.fn(),
    'tabs.findFirst': jest.fn(),
    'tabs.findMany': jest.fn(),
    'merchants.findFirst': jest.fn(),
  }),
  
  // Mock transaction
  mockTransaction: (implementation: (tx: any) => Promise<any>) => {
    return jest.fn().mockImplementation(async (fn: any) => {
      const tx = {
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        query: {
          tabs: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
          },
          lineItems: {
            findMany: jest.fn(),
          },
        },
      }
      
      if (implementation) {
        return implementation(tx)
      }
      
      return fn(tx)
    })
  },
}

// Test assertions
export const apiAssertions = {
  expectSuccessResponse: (response: NextResponse, expectedStatus = 200) => {
    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('content-type')).toContain('application/json')
  },
  
  expectErrorResponse: async (response: NextResponse, expectedStatus: number, expectedError?: string) => {
    expect(response.status).toBe(expectedStatus)
    if (expectedError) {
      const data = await getResponseData(response)
      if (typeof data.error === 'string') {
        expect(data.error.toLowerCase()).toContain(expectedError.toLowerCase())
      } else if (data.error && typeof data.error === 'object') {
        expect(JSON.stringify(data.error).toLowerCase()).toContain(expectedError.toLowerCase())
      } else if (data.message) {
        expect(data.message.toLowerCase()).toContain(expectedError.toLowerCase())
      }
    }
  },
  
  expectPaginatedResponse: async (response: NextResponse) => {
    const data = await getResponseData(response)
    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('meta')
    expect(data.meta).toHaveProperty('page')
    expect(data.meta).toHaveProperty('limit')
    expect(data.meta).toHaveProperty('total')
    expect(data.meta).toHaveProperty('totalPages')
  },
}