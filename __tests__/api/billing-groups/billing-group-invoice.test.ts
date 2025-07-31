import { NextRequest } from 'next/server'

// Mock dependencies first
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/services/invoice.service')
jest.mock('@/lib/logger')

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id'),
  customAlphabet: jest.fn(() => jest.fn(() => 'mock-custom-id')),
}))

jest.mock('@/lib/db/schema', () => ({
  billingGroups: {},
  tabs: {},
  lineItems: {},
  payments: {},
  invoices: {},
  invoiceLineItems: {},
  organizations: {},
}))

// Import after mocks
import { POST } from '@/app/api/v1/billing-groups/[id]/invoice/route'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { InvoiceService } from '@/lib/services/invoice.service'

// Setup mocks before importing
const mockBillingGroupService = {
  getBillingGroupById: jest.fn(),
}

const mockInvoiceService = {
  createBillingGroupInvoice: jest.fn(),
  sendInvoiceEmail: jest.fn(),
}

jest.mocked(BillingGroupService).getBillingGroupById = mockBillingGroupService.getBillingGroupById
jest.mocked(InvoiceService).createBillingGroupInvoice = mockInvoiceService.createBillingGroupInvoice
jest.mocked(InvoiceService).sendInvoiceEmail = mockInvoiceService.sendInvoiceEmail

describe('POST /api/v1/billing-groups/:id/invoice', () => {
  const mockMerchant = {
    id: 'merchant_123',
    email: 'merchant@example.com',
    businessName: 'Test Business'
  }

  const mockBillingGroup = {
    id: 'bg_123',
    name: 'Test Billing Group',
    groupType: 'corporate',
    payerEmail: 'payer@example.com',
    tab: {
      id: 'tab_123',
      merchantId: 'merchant_123'
    }
  }

  const mockInvoice = {
    id: 'inv_123',
    invoiceNumber: 'INV-2025-0001',
    status: 'open',
    issueDate: new Date('2025-01-25'),
    dueDate: new Date('2025-02-24'),
    customerEmail: 'payer@example.com',
    customerName: 'Test Payer',
    customerOrganizationId: null,
    subtotal: '100.00',
    taxAmount: '10.00',
    totalAmount: '110.00',
    paidAmount: '0.00',
    balanceDue: '110.00',
    currency: 'USD',
    paymentTerms: 'Net 30',
    publicUrl: 'inv_abc123',
    metadata: {
      billingGroup: {
        id: 'bg_123',
        name: 'Test Billing Group'
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create invoice from billing group successfully', async () => {
    const requestBody = {
      due_date: '2025-02-24T00:00:00Z',
      payment_terms: 'Net 30',
      notes: 'Test invoice',
      send_email: true,
      include_unassigned_items: false
    }

    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(mockBillingGroup)
    ;(InvoiceService.createBillingGroupInvoice as jest.Mock).mockResolvedValue(mockInvoice)
    ;(InvoiceService.sendInvoiceEmail as jest.Mock).mockResolvedValue(undefined)

    const response = await POST(mockRequest, {
      merchant: mockMerchant,
      params: Promise.resolve({ id: 'bg_123' }),
    } as any)

    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.meta?.message).toBe('Invoice created successfully')
    expect(data.data).toMatchObject({
      id: 'inv_123',
      invoice_number: 'INV-2025-0001',
      status: 'open',
      customer_email: 'payer@example.com'
    })

    expect(InvoiceService.createBillingGroupInvoice).toHaveBeenCalledWith({
      billingGroupId: 'bg_123',
      organizationId: 'merchant_123',
      dueDate: new Date('2025-02-24T00:00:00Z'),
      paymentTerms: 'Net 30',
      notes: 'Test invoice',
      includeUnassignedItems: false
    })

    expect(InvoiceService.sendInvoiceEmail).toHaveBeenCalledWith(
      'inv_123',
      'merchant_123'
    )
  })

  it('should create invoice without sending email', async () => {
    const requestBody = {
      due_date: '2025-02-24T00:00:00Z',
      send_email: false
    }

    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(mockBillingGroup)
    ;(InvoiceService.createBillingGroupInvoice as jest.Mock).mockResolvedValue(mockInvoice)

    const response = await POST(mockRequest, {
      merchant: mockMerchant,
      params: Promise.resolve({ id: 'bg_123' }),
    } as any)

    expect(response.status).toBe(200)
    expect(InvoiceService.sendInvoiceEmail).not.toHaveBeenCalled()
  })

  it('should return 404 if billing group not found', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/invalid/invoice', {
      method: 'POST',
      body: JSON.stringify({ due_date: '2025-02-24T00:00:00Z' }),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(undefined)

    const response = await POST(mockRequest, {
      params: Promise.resolve({ id: 'invalid' }),
      merchant: mockMerchant,
    } as any)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Billing group not found')
  })

  it('should return 403 if billing group belongs to different merchant', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      body: JSON.stringify({ due_date: '2025-02-24T00:00:00Z' }),
    })

    const unauthorizedGroup = {
      ...mockBillingGroup,
      tab: { ...mockBillingGroup.tab, merchantId: 'other_merchant' }
    }

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(unauthorizedGroup)

    const response = await POST(mockRequest, {
      merchant: mockMerchant,
      params: Promise.resolve({ id: 'bg_123' }),
    } as any)

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 for invalid request body', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      body: JSON.stringify({
        due_date: 'invalid-date',
        payment_terms: 123 // Should be string
      }),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(mockBillingGroup)

    const response = await POST(mockRequest, {
      merchant: mockMerchant,
      params: Promise.resolve({ id: 'bg_123' }),
    } as any)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Validation error')
    expect(data.details).toBeDefined()
  })

  it('should handle invoice creation failure', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      body: JSON.stringify({ due_date: '2025-02-24T00:00:00Z' }),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(mockBillingGroup)
    ;(InvoiceService.createBillingGroupInvoice as jest.Mock).mockRejectedValue(
      new Error('Database error')
    )

    const response = await POST(mockRequest, {
      merchant: mockMerchant,
      params: Promise.resolve({ id: 'bg_123' }),
    } as any)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to create invoice')
  })

  it('should continue if email sending fails', async () => {
    const requestBody = {
      due_date: '2025-02-24T00:00:00Z',
      send_email: true
    }

    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(mockBillingGroup)
    ;(InvoiceService.createBillingGroupInvoice as jest.Mock).mockResolvedValue(mockInvoice)
    ;(InvoiceService.sendInvoiceEmail as jest.Mock).mockRejectedValue(
      new Error('Email service unavailable')
    )

    const response = await POST(mockRequest, {
      merchant: mockMerchant,
      params: Promise.resolve({ id: 'bg_123' }),
    } as any)

    // Should still return success even if email fails
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
  })

  it('should include billing address and shipping address if provided', async () => {
    const requestBody = {
      due_date: '2025-02-24T00:00:00Z',
      billing_address: {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      },
      shipping_address: {
        line1: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        postal_code: '90001',
        country: 'US'
      }
    }

    const mockRequest = new NextRequest('http://localhost:3000/api/v1/billing-groups/bg_123/invoice', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    ;(BillingGroupService.getBillingGroupById as jest.Mock).mockResolvedValue(mockBillingGroup)
    ;(InvoiceService.createBillingGroupInvoice as jest.Mock).mockResolvedValue(mockInvoice)

    await POST(mockRequest, {
      params: Promise.resolve({ id: 'bg_123' }),
      merchant: mockMerchant,
    } as any)

    expect(InvoiceService.createBillingGroupInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAddress: requestBody.billing_address,
        shippingAddress: requestBody.shipping_address
      })
    )
  })
})