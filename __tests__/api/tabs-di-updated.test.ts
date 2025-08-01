/**
 * Tab API Tests - Updated for DI Pattern
 */

import { NextRequest } from 'next/server'
import { createTestDIContainer, createTestRequestContext, mockDIMiddleware, testData } from '../utils/di-test-setup'
import { DITokens } from '@/lib/di/types'

// Mock the DI middleware
jest.mock('@/lib/api/di-middleware', () => mockDIMiddleware())

describe('Tab API with DI Pattern', () => {
  let container: any
  let mockTabRepository: any
  let mockTabService: any

  beforeEach(() => {
    container = createTestDIContainer()
    mockTabRepository = container.resolve(DITokens.TabRepository)
    mockTabService = container.resolve(DITokens.TabService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/tabs', () => {
    it('should return tabs list successfully', async () => {
      // Mock the service to return test data
      mockTabService.listTabs = jest.fn().mockResolvedValue({
        data: [testData.tab],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
        }
      })

      // Import the route handler
      const { GET } = await import('@/app/api/v1/tabs/route')
      
      // Create test request
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        headers: { 'x-api-key': 'tab_test_12345678901234567890123456789012' }
      })

      // Execute the handler
      const response = await GET(request)
      const data = await response.json()

      // Assertions
      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe(testData.tab.id)
      expect(data.pagination.totalItems).toBe(1)
    })

    it('should handle empty results', async () => {
      mockTabService.listTabs = jest.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
        }
      })

      const { GET } = await import('@/app/api/v1/tabs/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        headers: { 'x-api-key': 'tab_test_12345678901234567890123456789012' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(0)
      expect(data.pagination.totalItems).toBe(0)
    })
  })

  describe('POST /api/v1/tabs', () => {
    it('should create a new tab successfully', async () => {
      const newTabData = {
        customerName: 'New Customer',
        customerEmail: 'new@example.com',
        currency: 'usd',
        lineItems: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: 25.00
          }
        ]
      }

      mockTabService.createTab = jest.fn().mockResolvedValue({
        ...testData.tab,
        ...newTabData,
        id: 'tab_new_123'
      })

      const { POST } = await import('@/app/api/v1/tabs/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: { 
          'x-api-key': 'tab_test_12345678901234567890123456789012',
          'content-type': 'application/json'
        },
        body: JSON.stringify(newTabData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.customerName).toBe(newTabData.customerName)
      expect(data.data.customerEmail).toBe(newTabData.customerEmail)
      expect(mockTabService.createTab).toHaveBeenCalledWith(
        'test-org-123',
        expect.objectContaining(newTabData)
      )
    })

    it('should handle validation errors', async () => {
      const invalidData = {
        customerName: '', // Invalid - empty name
        customerEmail: 'invalid-email', // Invalid email format
      }

      const { POST } = await import('@/app/api/v1/tabs/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: { 
          'x-api-key': 'tab_test_12345678901234567890123456789012',
          'content-type': 'application/json'
        },
        body: JSON.stringify(invalidData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(data.error.message).toContain('Invalid request data')
    })
  })
})

describe('Tab Repository with DI', () => {
  let container: any
  let repository: any
  let mockDb: any

  beforeEach(() => {
    container = createTestDIContainer()
    repository = container.resolve(DITokens.TabRepository)
    mockDb = container.resolve(DITokens.Database)
  })

  it('should find tabs by organization', async () => {
    mockDb.query.tabs.findMany.mockResolvedValue([testData.tab])

    const result = await repository.findMany('test-org-123')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(testData.tab.id)
    expect(mockDb.query.tabs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Function)
      })
    )
  })

  it('should create a new tab', async () => {
    const newTab = {
      organizationId: 'test-org-123',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      totalAmount: '100.00',
      currency: 'usd',
    }

    mockDb.insert().values().returning.mockResolvedValue([{ 
      id: 'tab_new_123', 
      ...newTab 
    }])

    const result = await repository.create(newTab)

    expect(result.id).toBe('tab_new_123')
    expect(mockDb.insert).toHaveBeenCalled()
  })
})

describe('Tab Service with DI', () => {
  let container: any
  let service: any
  let mockRepository: any

  beforeEach(() => {
    container = createTestDIContainer()
    service = container.resolve(DITokens.TabService)
    mockRepository = container.resolve(DITokens.TabRepository)
  })

  it('should list tabs with pagination', async () => {
    mockRepository.findMany = jest.fn().mockResolvedValue([testData.tab])

    const result = await service.listTabs('test-org-123', {
      page: 1,
      pageSize: 20
    })

    expect(result.data).toHaveLength(1)
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.pageSize).toBe(20)
    expect(mockRepository.findMany).toHaveBeenCalledWith(
      'test-org-123',
      expect.objectContaining({
        limit: 20,
        offset: 0
      })
    )
  })

  it('should create a tab with line items', async () => {
    const createInput = {
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      currency: 'usd',
      lineItems: [
        {
          description: 'Test Item',
          quantity: 1,
          unitPrice: 25.00
        }
      ]
    }

    mockRepository.create = jest.fn().mockResolvedValue({
      ...testData.tab,
      ...createInput,
      id: 'tab_new_123'
    })

    const result = await service.createTab('test-org-123', createInput)

    expect(result.customerName).toBe(createInput.customerName)
    expect(result.customerEmail).toBe(createInput.customerEmail)
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'test-org-123',
        customerName: createInput.customerName,
        customerEmail: createInput.customerEmail
      })
    )
  })
})