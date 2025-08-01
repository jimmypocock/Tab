/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { GET as getTab, PUT as updateTab, DELETE as deleteTab } from '@/app/api/v1/tabs/[id]/route'
import { createTestDatabase, cleanupAllDatabases, createTestOrganization, seedTestData, clearDatabase } from './setup'

// Mock the auth middleware to use our test database
let testDb: any
let testOrg: any

jest.mock('@/lib/db/client', () => ({
  get db() {
    return testDb
  }
}))

jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: (handler: any) => {
    return async (request: NextRequest, context: any) => {
      const apiKey = request.headers.get('x-api-key')
      if (!apiKey || apiKey !== testOrg?.apiKey) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const mockContext = {
        organizationId: testOrg.organization.id,
        organization: testOrg.organization,
        user: { id: testOrg.userId, email: 'test@example.com' },
        role: 'owner',
        apiKey: testOrg.apiKeyRecord
      }
      
      return handler(request, mockContext, context)
    }
  }
}))

describe('Tabs API - Integration Tests', () => {
  beforeAll(async () => {
    // Create test database
    const { db } = await createTestDatabase()
    testDb = db
  })

  afterAll(async () => {
    await cleanupAllDatabases()
  })

  beforeEach(async () => {
    // Clear database and create fresh test data
    await clearDatabase(testDb)
    testOrg = await createTestOrganization(testDb)
    await seedTestData(testDb, testOrg.organization.id)
  })

  describe('GET /api/v1/tabs', () => {
    it('should return empty list when no tabs exist', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toMatchObject({
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: 0,
          totalItems: 0
        }
      })
    })

    it('should return tabs with pagination', async () => {
      // Create test tabs
      const tabs = []
      for (let i = 0; i < 25; i++) {
        const [tab] = await testDb.insert(testDb.schema.tabs).values({
          id: `tab_${i}`,
          organizationId: testOrg.organization.id,
          customerName: `Customer ${i}`,
          customerEmail: `customer${i}@test.com`,
          totalAmount: '100.00',
          subtotal: '90.91',
          taxAmount: '9.09',
          paidAmount: '0.00',
          status: 'open',
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning()
        tabs.push(tab)
      }

      const request = new NextRequest('http://localhost/api/v1/tabs?page=1&pageSize=10', {
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(10)
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalPages: 3,
        totalItems: 25
      })
    })

    it('should filter tabs by status', async () => {
      // Create tabs with different statuses
      await testDb.insert(testDb.schema.tabs).values([
        {
          id: 'tab_open',
          organizationId: testOrg.organization.id,
          status: 'open',
          customerName: 'Open Tab',
          totalAmount: '100.00',
          subtotal: '90.91',
          taxAmount: '9.09',
          paidAmount: '0.00',
          currency: 'USD'
        },
        {
          id: 'tab_closed',
          organizationId: testOrg.organization.id,
          status: 'closed',
          customerName: 'Closed Tab',
          totalAmount: '100.00',
          subtotal: '90.91',
          taxAmount: '9.09',
          paidAmount: '100.00',
          currency: 'USD'
        }
      ])

      const request = new NextRequest('http://localhost/api/v1/tabs?status=open', {
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].status).toBe('open')
    })

    it('should require authentication', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        headers: {} // No API key
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/tabs', () => {
    it('should create a tab with line items', async () => {
      const tabData = {
        customerName: 'Test Customer',
        customerEmail: 'test@customer.com',
        currency: 'USD',
        lineItems: [
          {
            description: 'Product A',
            quantity: 2,
            unitPrice: 25.50
          },
          {
            description: 'Product B',
            quantity: 1,
            unitPrice: 50.00
          }
        ]
      }

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': testOrg.apiKey
        },
        body: JSON.stringify(tabData)
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.customerName).toBe('Test Customer')
      expect(data.totalAmount).toBe('111.10') // (51 + 50) * 1.1 (tax)
      expect(data.lineItems).toHaveLength(2)
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': testOrg.apiKey
        },
        body: JSON.stringify({
          // Missing required fields
          customerName: 'Test'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('validation')
    })

    it('should validate email format', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': testOrg.apiKey
        },
        body: JSON.stringify({
          customerName: 'Test Customer',
          customerEmail: 'invalid-email',
          lineItems: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('email')
    })
  })

  describe('GET /api/v1/tabs/[id]', () => {
    it('should retrieve a tab with line items', async () => {
      // Create a tab
      const [tab] = await testDb.insert(testDb.schema.tabs).values({
        id: 'tab_test_123',
        organizationId: testOrg.organization.id,
        customerName: 'Test Customer',
        customerEmail: 'test@customer.com',
        totalAmount: '110.00',
        subtotal: '100.00',
        taxAmount: '10.00',
        paidAmount: '0.00',
        status: 'open',
        currency: 'USD'
      }).returning()

      // Create line items
      await testDb.insert(testDb.schema.lineItems).values([
        {
          id: 'item_1',
          tabId: tab.id,
          organizationId: testOrg.organization.id,
          description: 'Item 1',
          quantity: '1',
          unitPrice: '50.00',
          totalPrice: '50.00'
        },
        {
          id: 'item_2',
          tabId: tab.id,
          organizationId: testOrg.organization.id,
          description: 'Item 2',
          quantity: '1',
          unitPrice: '50.00',
          totalPrice: '50.00'
        }
      ])

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tab.id}`, {
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await getTab(request, { params: { id: tab.id } })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.id).toBe(tab.id)
      expect(data.lineItems).toHaveLength(2)
      expect(data.customerName).toBe('Test Customer')
    })

    it('should return 404 for non-existent tab', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs/non_existent', {
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await getTab(request, { params: { id: 'non_existent' } })
      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/v1/tabs/[id]', () => {
    it('should update tab details', async () => {
      // Create a tab
      const [tab] = await testDb.insert(testDb.schema.tabs).values({
        id: 'tab_update_test',
        organizationId: testOrg.organization.id,
        customerName: 'Original Name',
        customerEmail: 'original@test.com',
        totalAmount: '100.00',
        subtotal: '90.91',
        taxAmount: '9.09',
        paidAmount: '0.00',
        status: 'open',
        currency: 'USD'
      }).returning()

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tab.id}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-api-key': testOrg.apiKey
        },
        body: JSON.stringify({
          customerName: 'Updated Name',
          customerEmail: 'updated@test.com'
        })
      })

      const response = await updateTab(request, { params: { id: tab.id } })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.customerName).toBe('Updated Name')
      expect(data.customerEmail).toBe('updated@test.com')
    })

    it('should not update closed tabs', async () => {
      // Create a closed tab
      const [tab] = await testDb.insert(testDb.schema.tabs).values({
        id: 'tab_closed_test',
        organizationId: testOrg.organization.id,
        customerName: 'Closed Tab',
        totalAmount: '100.00',
        subtotal: '90.91',
        taxAmount: '9.09',
        paidAmount: '100.00',
        status: 'closed',
        currency: 'USD'
      }).returning()

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tab.id}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-api-key': testOrg.apiKey
        },
        body: JSON.stringify({
          customerName: 'Should Not Update'
        })
      })

      const response = await updateTab(request, { params: { id: tab.id } })
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('closed')
    })
  })

  describe('DELETE /api/v1/tabs/[id]', () => {
    it('should delete a tab without payments', async () => {
      // Create a tab
      const [tab] = await testDb.insert(testDb.schema.tabs).values({
        id: 'tab_delete_test',
        organizationId: testOrg.organization.id,
        customerName: 'Delete Me',
        totalAmount: '100.00',
        subtotal: '90.91',
        taxAmount: '9.09',
        paidAmount: '0.00',
        status: 'open',
        currency: 'USD'
      }).returning()

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tab.id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await deleteTab(request, { params: { id: tab.id } })
      expect(response.status).toBe(204)

      // Verify tab is deleted
      const deletedTab = await testDb.query.tabs.findFirst({
        where: (tabs: any, { eq }: any) => eq(tabs.id, tab.id)
      })
      expect(deletedTab).toBeUndefined()
    })

    it('should not delete tabs with payments', async () => {
      // Create a tab with payment
      const [tab] = await testDb.insert(testDb.schema.tabs).values({
        id: 'tab_with_payment',
        organizationId: testOrg.organization.id,
        customerName: 'Has Payment',
        totalAmount: '100.00',
        subtotal: '90.91',
        taxAmount: '9.09',
        paidAmount: '50.00',
        status: 'open',
        currency: 'USD'
      }).returning()

      // Create a payment
      await testDb.insert(testDb.schema.payments).values({
        id: 'payment_1',
        tabId: tab.id,
        organizationId: testOrg.organization.id,
        amount: '50.00',
        currency: 'USD',
        status: 'succeeded',
        processor: 'stripe',
        processorPaymentId: 'pi_test'
      })

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tab.id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': testOrg.apiKey
        }
      })

      const response = await deleteTab(request, { params: { id: tab.id } })
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('payments')
    })
  })
})