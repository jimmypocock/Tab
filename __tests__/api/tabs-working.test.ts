/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { PATCH } from '@/app/api/v1/tabs/(id)/route'
import { db } from '@/lib/db/client'
import * as bcrypt from 'bcryptjs'

// Mock database
jest.mock('@/lib/db/client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    transaction: jest.fn(),
    execute: jest.fn(),
  },
}))

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhookEndpoints: {
      create: jest.fn(),
      list: jest.fn().mockResolvedValue({ data: [] }),
      del: jest.fn(),
    }
  }))
})

// Mock crypto for API key hashing
const crypto = require('crypto')
const mockKeyHash = crypto.createHash('sha256').update('tab_test_12345678901234567890123456789012').digest('hex')

describe('Tab API Routes', () => {
  const mockDb = db as any
  const validApiKey = 'tab_test_12345678901234567890123456789012'
  const mockMerchantId = 'merchant_123'
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful API key validation by default
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockResolvedValue([{
        apiKeys: { 
          id: '1', 
          keyHash: `hashed_${validApiKey}`,
          merchantId: mockMerchantId 
        },
        merchants: { 
          id: mockMerchantId, 
          stripeCustomerId: 'cus_test_123',
          name: 'Test Merchant' 
        }
      }])
    }))
  })

  describe('POST /api/v1/tabs', () => {
    it('creates a tab with valid data', async () => {
      const tabData = {
        customerEmail: 'customer@example.com',
        customerName: 'Test Customer',
        currency: 'USD',
        lineItems: [
          { description: 'Item 1', quantity: 2, unitAmount: '25.00' },
          { description: 'Item 2', quantity: 1, unitAmount: '30.00' }
        ],
        taxRate: 0.08
      }

      // Mock successful tab creation
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{
            id: 'tab_123',
            merchantId: mockMerchantId,
            customerEmail: tabData.customerEmail,
            customerName: tabData.customerName,
            currency: tabData.currency,
            subtotal: '80.00',
            taxAmount: '6.40',
            total: '86.40',
            paidAmount: '0.00',
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        }
        return fn(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'X-API-Key': validApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tabData),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(201)
      expect(json.data).toMatchObject({
        id: 'tab_123',
        customerEmail: 'customer@example.com',
        subtotal: '80.00',
        taxAmount: '6.40',
        total: '86.40',
        status: 'open'
      })
      expect(json.data.paymentUrl).toContain('/pay/tab_123')
    })

    it('returns 401 without API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerEmail: 'test@example.com',
          currency: 'USD',
          lineItems: []
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.error).toContain('API key')
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'X-API-Key': validApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required customerEmail
          currency: 'USD',
          lineItems: []
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toContain('customerEmail')
    })
  })

  describe('GET /api/v1/tabs', () => {
    it('lists tabs for authenticated merchant', async () => {
      const mockTabs = [
        {
          id: 'tab_1',
          customerEmail: 'customer1@example.com',
          total: '100.00',
          status: 'open',
          createdAt: new Date()
        },
        {
          id: 'tab_2',
          customerEmail: 'customer2@example.com',
          total: '200.00',
          status: 'paid',
          createdAt: new Date()
        }
      ]

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockTabs)
      }))

      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'GET',
        headers: {
          'X-API-Key': validApiKey,
        },
      })

      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.data).toHaveLength(2)
      expect(json.data[0].id).toBe('tab_1')
    })

    it('filters by status', async () => {
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{
          id: 'tab_1',
          status: 'paid'
        }])
      }))

      const request = new NextRequest('http://localhost:3000/api/v1/tabs?status=paid', {
        method: 'GET',
        headers: {
          'X-API-Key': validApiKey,
        },
      })

      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].status).toBe('paid')
    })
  })

  describe('PATCH /api/v1/tabs/:id', () => {
    it('updates tab status', async () => {
      const tabId = 'tab_123'
      
      mockDb.update.mockReturnThis()
      mockDb.set.mockReturnThis()
      mockDb.where.mockReturnThis()
      mockDb.returning.mockResolvedValue([{
        id: tabId,
        status: 'void',
        updatedAt: new Date()
      }])

      const request = new NextRequest(`http://localhost:3000/api/v1/tabs/${tabId}`, {
        method: 'PATCH',
        headers: {
          'X-API-Key': validApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'void' }),
      })

      const response = await PATCH(request, { params: { id: tabId } })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.data.status).toBe('void')
    })
  })
})