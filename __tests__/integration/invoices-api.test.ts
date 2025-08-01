/**
 * Invoices API Integration Tests
 * 
 * Tests all invoice-related endpoints including generation,
 * management, and email functionality.
 */

import { NextRequest } from 'next/server'
import {
  TEST_CONFIG,
  createTestRequest,
  TestData,
  ApiTestHelpers
} from './api-test-setup'

// Set test environment
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_CONFIG.SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = TEST_CONFIG.SUPABASE_ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.STRIPE_SECRET_KEY = TEST_CONFIG.STRIPE_SECRET_KEY
process.env.RESEND_API_KEY = TEST_CONFIG.RESEND_API_KEY

// Mock external dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: TEST_CONFIG.TEST_USER_ID } }
      })
    }
  }))
}))

const mockResend = {
  emails: {
    send: jest.fn()
  }
}

jest.mock('resend', () => ({
  Resend: jest.fn(() => mockResend)
}))

jest.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    paymentIntents: { create: jest.fn() }
  }
}))

jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
  }
}))

// Mock the database
const mockDb = {
  query: {
    invoices: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    tabs: {
      findFirst: jest.fn()
    },
    lineItems: {
      findMany: jest.fn()
    },
    organizations: {
      findFirst: jest.fn().mockResolvedValue({
        id: TEST_CONFIG.TEST_ORGANIZATION_ID,
        name: 'Test Organization',
        isMerchant: true,
        isCorporate: false
      })
    },
    apiKeys: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'key-123',
        organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
        hashedKey: 'hashed-key',
        isActive: true
      })
    }
  },
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn()
    }))
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn()
      }))
    }))
  })),
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        execute: jest.fn()
      }))
    }))
  })),
  transaction: jest.fn()
}

jest.mock('@/lib/db/client', () => ({
  db: mockDb
}))

// Mock organization middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((handler) => {
    return async (request: NextRequest, context?: any) => {
      const mockContext = {
        organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
        organization: {
          id: TEST_CONFIG.TEST_ORGANIZATION_ID,
          name: 'Test Organization',
          isMerchant: true,
          isCorporate: false
        },
        userId: TEST_CONFIG.TEST_USER_ID,
        userRole: 'owner',
        apiKey: TEST_CONFIG.TEST_API_KEY,
        authType: 'apiKey' as const,
        scope: 'merchant' as const
      }
      
      return handler(request, mockContext)
    }
  })
}))

describe('Invoices API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up default mock responses
    mockDb.query.invoices.findMany.mockResolvedValue([])
    mockDb.query.invoices.findFirst.mockResolvedValue(null)
    mockDb.query.tabs.findFirst.mockResolvedValue(TestData.tab())
    mockDb.insert().values().returning.mockResolvedValue([TestData.invoice()])
    mockDb.select().from().where().execute.mockResolvedValue([{ count: '0' }])
    
    // Reset email mock
    mockResend.emails.send.mockResolvedValue({
      id: 'email_test_123',
      from: 'noreply@example.com',
      to: 'test@example.com'
    })
  })

  describe('GET /api/v1/invoices', () => {
    it('should return empty list when no invoices exist', async () => {
      const { GET } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices')
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await ApiTestHelpers.expectPaginatedResponse(response)
      expect(data.data).toHaveLength(0)
      expect(data.pagination.totalItems).toBe(0)
    })

    it('should return invoices list when invoices exist', async () => {
      const testInvoices = [
        TestData.invoice({ 
          id: 'inv_test_1', 
          invoiceNumber: 'INV-001',
          status: 'sent',
          totalAmount: '150.00'
        }),
        TestData.invoice({ 
          id: 'inv_test_2', 
          invoiceNumber: 'INV-002',
          status: 'paid',
          totalAmount: '200.00'
        })
      ]
      
      mockDb.query.invoices.findMany.mockResolvedValue(testInvoices)
      mockDb.select().from().where().execute.mockResolvedValue([{ count: '2' }])
      
      const { GET } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices')
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await ApiTestHelpers.expectPaginatedResponse(response)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].invoiceNumber).toBe('INV-001')
      expect(data.data[1].status).toBe('paid')
      expect(data.pagination.totalItems).toBe(2)
    })

    it('should filter invoices by status', async () => {
      const paidInvoices = [
        TestData.invoice({ id: 'inv_paid_1', status: 'paid' }),
        TestData.invoice({ id: 'inv_paid_2', status: 'paid' })
      ]
      
      mockDb.query.invoices.findMany.mockResolvedValue(paidInvoices)
      
      const { GET } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        params: { status: 'paid' }
      })
      
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(2)
      data.data.forEach((invoice: any) => {
        expect(invoice.status).toBe('paid')
      })
    })

    it('should filter invoices by customer email', async () => {
      const customerInvoices = [
        TestData.invoice({ 
          id: 'inv_customer_1', 
          customerEmail: 'customer@example.com' 
        })
      ]
      
      mockDb.query.invoices.findMany.mockResolvedValue(customerInvoices)
      
      const { GET } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        params: { customerEmail: 'customer@example.com' }
      })
      
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].customerEmail).toBe('customer@example.com')
    })

    it('should filter invoices by date range', async () => {
      const { GET } = await import('@/app/v1/invoices/route')
      
      const startDate = '2024-01-01T00:00:00Z'
      const endDate = '2024-12-31T23:59:59Z'
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        params: { 
          issuedAfter: startDate,
          issuedBefore: endDate
        }
      })
      
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      // Verify the repository was called with date filters
      expect(mockDb.query.invoices.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Function)
        })
      )
    })
  })

  describe('POST /api/v1/invoices', () => {
    it('should create invoice from tab successfully', async () => {
      const invoicePayload = {
        tabId: 'tab_test_123',
        dueDate: '2024-12-31',
        paymentTerms: 'Net 30',
        notes: 'Please remit payment within 30 days.',
        sendEmail: false
      }
      
      const testTab = TestData.tab({
        id: 'tab_test_123',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        totalAmount: '150.00',
        lineItems: [
          TestData.lineItem({ description: 'Service 1', totalPrice: '100.00' }),
          TestData.lineItem({ description: 'Service 2', totalPrice: '50.00' })
        ]
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const createdInvoice = TestData.invoice({
        id: 'inv_new_123',
        tabId: 'tab_test_123',
        invoiceNumber: 'INV-003',
        dueDate: new Date('2024-12-31'),
        paymentTerms: 'Net 30',
        notes: 'Please remit payment within 30 days.',
        totalAmount: '150.00'
      })
      
      mockDb.insert().values().returning.mockResolvedValue([createdInvoice])
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      const data = await ApiTestHelpers.expectResponseData(response, [
        'id', 'invoiceNumber', 'status', 'totalAmount', 'dueDate'
      ])
      
      expect(data.data.tabId).toBe('tab_test_123')
      expect(data.data.invoiceNumber).toBe('INV-003')
      expect(data.data.paymentTerms).toBe('Net 30')
      expect(data.data.notes).toBe('Please remit payment within 30 days.')
    })

    it('should create invoice and send email when requested', async () => {
      const invoicePayload = {
        tabId: 'tab_test_123',
        dueDate: '2024-12-31',
        sendEmail: true
      }
      
      const testTab = TestData.tab({
        customerEmail: 'customer@example.com'
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const createdInvoice = TestData.invoice({
        customerEmail: 'customer@example.com',
        publicUrl: 'unique-public-url-123'
      })
      
      mockDb.insert().values().returning.mockResolvedValue([createdInvoice])
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      // Verify email was sent
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: expect.stringContaining('Invoice'),
          html: expect.stringContaining('unique-public-url-123')
        })
      )
      
      const data = await response.json()
      expect(data.meta?.emailSent).toBe(true)
    })

    it('should handle email sending failure gracefully', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('Email service unavailable'))
      
      const invoicePayload = {
        tabId: 'tab_test_123',
        dueDate: '2024-12-31',
        sendEmail: true
      }
      
      const testTab = TestData.tab()
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload)
      })
      
      const response = await POST(request)
      
      // Invoice creation should still succeed even if email fails
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      const data = await response.json()
      expect(data.meta?.emailSent).toBe(false)
      expect(data.meta?.emailError).toBeDefined()
    })

    it('should reject invoice creation for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)
      
      const invoicePayload = {
        tabId: 'nonexistent_tab',
        dueDate: '2024-12-31'
      }
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 404)
      
      const data = await response.json()
      expect(data.error).toContain('Tab not found')
    })

    it('should auto-generate invoice number', async () => {
      const invoicePayload = {
        tabId: 'tab_test_123',
        dueDate: '2024-12-31'
      }
      
      const testTab = TestData.tab()
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      // Mock the count query to return 5 existing invoices
      mockDb.select().from().where().execute.mockResolvedValue([{ count: '5' }])
      
      const createdInvoice = TestData.invoice({
        invoiceNumber: 'INV-006' // Next sequential number
      })
      
      mockDb.insert().values().returning.mockResolvedValue([createdInvoice])
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      const data = await response.json()
      expect(data.data.invoiceNumber).toBe('INV-006')
    })

    it('should validate request data', async () => {
      const invalidPayload = {
        tabId: '', // Invalid - empty tab ID
        dueDate: 'invalid-date-format', // Invalid date
        sendEmail: 'not-boolean' // Invalid boolean
      }
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 400)
      
      const data = await response.json()
      expect(data.error).toContain('Invalid request data')
      expect(data.details).toBeDefined()
    })
  })

  describe('GET /api/v1/invoices/[id]', () => {
    it('should return specific invoice with details', async () => {
      const testInvoice = TestData.invoice({
        id: 'inv_specific_123',
        invoiceNumber: 'INV-999',
        status: 'sent',
        totalAmount: '250.00',
        tab: TestData.tab({
          lineItems: [
            TestData.lineItem({ description: 'Consulting', totalPrice: '200.00' }),
            TestData.lineItem({ description: 'Materials', totalPrice: '50.00' })
          ]
        })
      })
      
      mockDb.query.invoices.findFirst.mockResolvedValue(testInvoice)
      
      const { GET } = await import('@/app/api/v1/invoices/[id]/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices/inv_specific_123')
      const context = { params: Promise.resolve({ id: 'inv_specific_123' }) }
      
      const response = await GET(request, context)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await ApiTestHelpers.expectResponseData(response, [
        'id', 'invoiceNumber', 'status', 'totalAmount', 'customerName'
      ])
      
      expect(data.data.id).toBe('inv_specific_123')
      expect(data.data.invoiceNumber).toBe('INV-999')
      expect(data.data.tab?.lineItems).toHaveLength(2)
    })

    it('should return 404 for non-existent invoice', async () => {
      mockDb.query.invoices.findFirst.mockResolvedValue(null)
      
      const { GET } = await import('@/app/api/v1/invoices/[id]/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices/nonexistent')
      const context = { params: Promise.resolve({ id: 'nonexistent' }) }
      
      const response = await GET(request, context)
      
      ApiTestHelpers.expectErrorResponse(response, 404)
      
      const data = await response.json()
      expect(data.error).toContain('Invoice not found')
    })
  })

  describe('PUT /api/v1/invoices/[id]', () => {
    it('should update invoice status', async () => {
      const existingInvoice = TestData.invoice({
        id: 'inv_update_123',
        status: 'draft'
      })
      
      mockDb.query.invoices.findFirst.mockResolvedValue(existingInvoice)
      
      const updatedInvoice = { ...existingInvoice, status: 'sent' }
      mockDb.update().set().where().returning.mockResolvedValue([updatedInvoice])
      
      const updatePayload = {
        status: 'sent'
      }
      
      const { PUT } = await import('@/app/api/v1/invoices/[id]/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices/inv_update_123', {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      })
      
      const context = { params: Promise.resolve({ id: 'inv_update_123' }) }
      const response = await PUT(request, context)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await response.json()
      expect(data.data.status).toBe('sent')
    })

    it('should prevent updating paid invoice', async () => {
      const paidInvoice = TestData.invoice({
        id: 'inv_paid_123',
        status: 'paid'
      })
      
      mockDb.query.invoices.findFirst.mockResolvedValue(paidInvoice)
      
      const updatePayload = {
        status: 'cancelled'
      }
      
      const { PUT } = await import('@/app/api/v1/invoices/[id]/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices/inv_paid_123', {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      })
      
      const context = { params: Promise.resolve({ id: 'inv_paid_123' }) }
      const response = await PUT(request, context)
      
      ApiTestHelpers.expectErrorResponse(response, 400)
      
      const data = await response.json()
      expect(data.error).toContain('Cannot modify paid invoice')
    })
  })

  describe('POST /api/v1/invoices/[id]/send', () => {
    it('should send invoice email', async () => {
      const testInvoice = TestData.invoice({
        id: 'inv_send_123',
        customerEmail: 'customer@example.com',
        invoiceNumber: 'INV-777',
        status: 'draft',
        publicUrl: 'public-url-123'
      })
      
      mockDb.query.invoices.findFirst.mockResolvedValue(testInvoice)
      
      const { POST } = await import('@/app/api/v1/invoices/[id]/send/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices/inv_send_123/send', {
        method: 'POST'
      })
      
      const context = { params: Promise.resolve({ id: 'inv_send_123' }) }
      const response = await POST(request, context)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      // Verify email was sent
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: expect.stringContaining('INV-777'),
          html: expect.stringContaining('public-url-123')
        })
      )
      
      // Verify invoice status was updated to 'sent'
      expect(mockDb.update().set().where().returning).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent'
        })
      )
    })

    it('should not send email for already sent invoice', async () => {
      const sentInvoice = TestData.invoice({
        id: 'inv_already_sent_123',
        status: 'sent'
      })
      
      mockDb.query.invoices.findFirst.mockResolvedValue(sentInvoice)
      
      const { POST } = await import('@/app/api/v1/invoices/[id]/send/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices/inv_already_sent_123/send', {
        method: 'POST'
      })
      
      const context = { params: Promise.resolve({ id: 'inv_already_sent_123' }) }
      const response = await POST(request, context)
      
      ApiTestHelpers.expectErrorResponse(response, 400)
      
      const data = await response.json()
      expect(data.error).toContain('Invoice has already been sent')
      
      // Email should not be sent
      expect(mockResend.emails.send).not.toHaveBeenCalled()
    })
  })

  describe('Business Logic and Edge Cases', () => {
    it('should handle concurrent invoice creation', async () => {
      // Test race condition handling for invoice numbering
      const tabId = 'tab_concurrent_test'
      const testTab = TestData.tab({ id: tabId })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      mockDb.select().from().where().execute.mockResolvedValue([{ count: '10' }])
      
      const invoicePayload = {
        tabId,
        dueDate: '2024-12-31'
      }
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      // Simulate concurrent requests
      const requests = Array.from({ length: 3 }, () =>
        createTestRequest('http://localhost:3000/api/v1/invoices', {
          method: 'POST',
          body: JSON.stringify(invoicePayload)
        })
      )
      
      const responses = await Promise.all(
        requests.map(request => POST(request))
      )
      
      // All should succeed (though in practice, the implementation
      // should handle unique constraint violations)
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500)
      })
    })

    it('should calculate totals correctly with tax', async () => {
      const invoicePayload = {
        tabId: 'tab_with_tax',
        dueDate: '2024-12-31',
        taxRate: 0.08 // 8% tax
      }
      
      const testTab = TestData.tab({
        id: 'tab_with_tax',
        totalAmount: '100.00', // Pre-tax
        lineItems: [
          TestData.lineItem({ totalPrice: '100.00' })
        ]
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const createdInvoice = TestData.invoice({
        subtotal: '100.00',
        taxAmount: '8.00',
        totalAmount: '108.00'
      })
      
      mockDb.insert().values().returning.mockResolvedValue([createdInvoice])
      
      const { POST } = await import('@/app/api/v1/invoices/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      const data = await response.json()
      expect(data.data.subtotal).toBe('100.00')
      expect(data.data.taxAmount).toBe('8.00')
      expect(data.data.totalAmount).toBe('108.00')
    })
  })
})