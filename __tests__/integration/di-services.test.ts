/**
 * DI Services Integration Tests
 * 
 * Tests the DI container and services with proper mocking
 * to ensure the dependency injection architecture works correctly.
 */

import { DIContainer } from '@/lib/di/container'
import { DITokens } from '@/lib/di/types'
import { TabManagementService } from '@/lib/services/tab-management.service'
import { PaymentService } from '@/lib/services/payment.service'
import { InvoiceManagementService } from '@/lib/services/invoice-management.service'

describe('DI Services Integration Tests', () => {
  let container: DIContainer
  let mockDb: any
  let mockRedis: any
  let mockStripe: any
  let mockLogger: any

  beforeEach(() => {
    // Create fresh container for each test
    container = new DIContainer()

    // Create comprehensive mocks
    mockDb = {
      query: {
        tabs: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null)
        },
        lineItems: {
          findMany: jest.fn().mockResolvedValue([])
        },
        payments: {
          findMany: jest.fn().mockResolvedValue([])
        },
        invoices: {
          findMany: jest.fn().mockResolvedValue([])
        },
        organizations: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'test-org-123',
            name: 'Test Organization'
          })
        }
      },
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([{
            id: 'test-id-123',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        }))
      })),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            execute: jest.fn().mockResolvedValue([{ count: '0' }])
          }))
        }))
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([])
          }))
        }))
      })),
      transaction: jest.fn(async (callback) => {
        return await callback(mockDb)
      })
    }

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      hget: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(1)
    }

    mockStripe = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test_123',
          client_secret: 'pi_test_123_secret'
        })
      },
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/test'
          })
        }
      }
    }

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }

    // Register all dependencies
    container.register(DITokens.Database, () => mockDb)
    container.register(DITokens.Redis, () => mockRedis)
    container.register(DITokens.Stripe, () => mockStripe)
    container.register(DITokens.Logger, () => mockLogger)

    // Register repositories
    const { TabRepository } = require('@/lib/repositories/tab.repository')
    const { LineItemRepository } = require('@/lib/repositories/line-item.repository')
    const { PaymentRepository } = require('@/lib/repositories/payment.repository')
    const { InvoiceRepository } = require('@/lib/repositories/invoice.repository')
    const { OrganizationRepository } = require('@/lib/repositories/organization.repository')
    const { BillingGroupRepository } = require('@/lib/repositories/billing-group.repository')
    const { ApiKeyRepository } = require('@/lib/repositories/api-key.repository')

    container.register(DITokens.TabRepository, () => new TabRepository(mockDb))
    container.register(DITokens.LineItemRepository, () => new LineItemRepository(mockDb))
    container.register(DITokens.PaymentRepository, () => new PaymentRepository(mockDb))
    container.register(DITokens.InvoiceRepository, () => new InvoiceRepository(mockDb))
    container.register(DITokens.OrganizationRepository, () => new OrganizationRepository(mockDb))
    container.register(DITokens.BillingGroupRepository, () => new BillingGroupRepository(mockDb))
    container.register(DITokens.ApiKeyRepository, () => new ApiKeyRepository(mockDb))

    // Register email service
    const { EmailService } = require('@/lib/services/email.service')
    container.register(DITokens.EmailService, () => new EmailService(mockLogger))

    // Register feature flags
    const { FeatureFlagService } = require('@/lib/services/feature-flag.service')
    container.register(DITokens.FeatureFlags, () => new FeatureFlagService(mockRedis))

    // Register services (non-singleton to test fresh instances)
    container.register(DITokens.TabService, () => new TabManagementService(container), false)
    container.register(DITokens.PaymentService, () => new PaymentService(container), false)
    container.register(DITokens.InvoiceService, () => new InvoiceManagementService(container), false)
  })

  describe('DI Container', () => {
    it('should register and resolve dependencies correctly', () => {
      const tabService = container.resolve(DITokens.TabService)
      const paymentService = container.resolve(DITokens.PaymentService)
      const invoiceService = container.resolve(DITokens.InvoiceService)

      expect(tabService).toBeInstanceOf(TabManagementService)
      expect(paymentService).toBeInstanceOf(PaymentService)
      expect(invoiceService).toBeInstanceOf(InvoiceManagementService)
    })

    it('should create new instances for non-singleton services', () => {
      const tabService1 = container.resolve(DITokens.TabService)
      const tabService2 = container.resolve(DITokens.TabService)

      expect(tabService1).not.toBe(tabService2) // Different instances
      expect(tabService1).toBeInstanceOf(TabManagementService)
      expect(tabService2).toBeInstanceOf(TabManagementService)
    })

    it('should reuse singleton instances', () => {
      const db1 = container.resolve(DITokens.Database)
      const db2 = container.resolve(DITokens.Database)

      expect(db1).toBe(db2) // Same instance
    })

    it('should handle dependency chains correctly', () => {
      const tabService = container.resolve(DITokens.TabService)
      
      // The service should have access to its dependencies
      expect(tabService).toBeDefined()
      
      // Should be able to call methods without errors (dependencies injected)
      expect(() => {
        // This would fail if dependencies weren't properly injected
        const tabRepo = container.resolve(DITokens.TabRepository)
        expect(tabRepo).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('TabManagementService', () => {
    it('should list tabs with pagination', async () => {
      const tabService = container.resolve(DITokens.TabService) as TabManagementService

      const mockTabs = [
        {
          id: 'tab_1',
          organizationId: 'test-org-123',
          customerName: 'Customer 1',
          totalAmount: '100.00',
          status: 'open'
        }
      ]

      mockDb.query.tabs.findMany.mockResolvedValue(mockTabs)
      mockDb.select().from().where().execute.mockResolvedValue([{ count: '1' }])

      const result = await tabService.listTabs('test-org-123', {
        page: 1,
        pageSize: 20
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].customerName).toBe('Customer 1')
      expect(result.pagination.totalItems).toBe(1)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.pageSize).toBe(20)

      // Verify repository was called
      expect(mockDb.query.tabs.findMany).toHaveBeenCalled()
    })

    it('should create a new tab', async () => {
      const tabService = container.resolve(DITokens.TabService) as TabManagementService

      const createInput = {
        customerName: 'New Customer',
        customerEmail: 'new@example.com',
        currency: 'usd' as const,
        lineItems: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: 25.00
          }
        ]
      }

      const createdTab = {
        id: 'tab_new_123',
        organizationId: 'test-org-123',
        ...createInput,
        totalAmount: '25.00',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDb.insert().values().returning.mockResolvedValue([createdTab])

      const result = await tabService.createTab('test-org-123', createInput)

      expect(result.id).toBe('tab_new_123')
      expect(result.customerName).toBe('New Customer')
      expect(result.totalAmount).toBe('25.00')

      // Verify database operations
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should handle business rule validation', async () => {
      const tabService = container.resolve(DITokens.TabService) as TabManagementService

      const invalidInput = {
        customerName: '', // Invalid - empty name
        customerEmail: 'invalid-email', // Invalid email
        currency: 'usd' as const,
        lineItems: [] // Invalid - no line items
      }

      await expect(
        tabService.createTab('test-org-123', invalidInput)
      ).rejects.toThrow() // Should throw validation error

      // Database should not be called for invalid input
      expect(mockDb.insert).not.toHaveBeenCalled()
    })
  })

  describe('PaymentService', () => {
    it('should list payments', async () => {
      const paymentService = container.resolve(DITokens.PaymentService) as PaymentService

      const mockPayments = [
        {
          id: 'pay_1',
          organizationId: 'test-org-123',
          amount: '50.00',
          status: 'succeeded'
        }
      ]

      mockDb.query.payments.findMany.mockResolvedValue(mockPayments)

      const result = await paymentService.listPayments('test-org-123', {
        page: 1,
        pageSize: 20
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].amount).toBe('50.00')
      expect(result.data[0].status).toBe('succeeded')

      // Verify repository was called
      expect(mockDb.query.payments.findMany).toHaveBeenCalled()
    })

    it('should create payment intent', async () => {
      const paymentService = container.resolve(DITokens.PaymentService) as PaymentService

      // Mock tab exists
      mockDb.query.tabs.findFirst.mockResolvedValue({
        id: 'tab_test_123',
        organizationId: 'test-org-123',
        totalAmount: '100.00',
        paidAmount: '0.00',
        status: 'open'
      })

      const result = await paymentService.createPaymentIntent('test-org-123', {
        tabId: 'tab_test_123',
        amount: 5000 // $50.00 in cents
      })

      expect(result.id).toBe('pi_test_123')
      expect(result.client_secret).toBe('pi_test_123_secret')

      // Verify Stripe was called
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          metadata: expect.objectContaining({
            tabId: 'tab_test_123',
            organizationId: 'test-org-123'
          })
        })
      )
    })
  })

  describe('InvoiceManagementService', () => {
    it('should list invoices', async () => {
      const invoiceService = container.resolve(DITokens.InvoiceService) as InvoiceManagementService

      const mockInvoices = [
        {
          id: 'inv_1',
          organizationId: 'test-org-123',
          invoiceNumber: 'INV-001',
          totalAmount: '100.00',
          status: 'sent'
        }
      ]

      mockDb.query.invoices.findMany.mockResolvedValue(mockInvoices)

      const result = await invoiceService.listInvoices('test-org-123', {
        page: 1,
        pageSize: 20
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].invoiceNumber).toBe('INV-001')
      expect(result.data[0].status).toBe('sent')

      // Verify repository was called
      expect(mockDb.query.invoices.findMany).toHaveBeenCalled()
    })

    it('should create invoice from tab', async () => {
      const invoiceService = container.resolve(DITokens.InvoiceService) as InvoiceManagementService

      // Mock tab exists
      mockDb.query.tabs.findFirst.mockResolvedValue({
        id: 'tab_test_123',
        organizationId: 'test-org-123',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        totalAmount: '100.00',
        lineItems: [
          { description: 'Service', totalPrice: '100.00' }
        ]
      })

      // Mock invoice count for auto-numbering
      mockDb.select().from().where().execute.mockResolvedValue([{ count: '5' }])

      const createdInvoice = {
        id: 'inv_new_123',
        organizationId: 'test-org-123',
        tabId: 'tab_test_123',
        invoiceNumber: 'INV-006',
        totalAmount: '100.00',
        status: 'draft'
      }

      mockDb.insert().values().returning.mockResolvedValue([createdInvoice])

      const result = await invoiceService.createInvoice('test-org-123', {
        tabId: 'tab_test_123',
        dueDate: new Date('2024-12-31'),
        sendEmail: false
      })

      expect(result.id).toBe('inv_new_123')
      expect(result.invoiceNumber).toBe('INV-006')
      expect(result.tabId).toBe('tab_test_123')

      // Verify database operations
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('Cross-Service Integration', () => {
    it('should handle tab -> invoice -> payment workflow', async () => {
      const tabService = container.resolve(DITokens.TabService) as TabManagementService
      const invoiceService = container.resolve(DITokens.InvoiceService) as InvoiceManagementService
      const paymentService = container.resolve(DITokens.PaymentService) as PaymentService

      // Step 1: Create tab
      const createTabInput = {
        customerName: 'Integration Customer',
        customerEmail: 'integration@example.com',
        currency: 'usd' as const,
        lineItems: [
          { description: 'Integration Test', quantity: 1, unitPrice: 100.00 }
        ]
      }

      const createdTab = {
        id: 'tab_integration_123',
        organizationId: 'test-org-123',
        ...createTabInput,
        totalAmount: '100.00',
        status: 'open'
      }

      mockDb.insert().values().returning.mockResolvedValue([createdTab])

      const tab = await tabService.createTab('test-org-123', createTabInput)
      expect(tab.id).toBe('tab_integration_123')

      // Step 2: Create invoice from tab
      mockDb.query.tabs.findFirst.mockResolvedValue(createdTab)
      
      const createdInvoice = {
        id: 'inv_integration_123',
        organizationId: 'test-org-123',
        tabId: 'tab_integration_123',
        invoiceNumber: 'INV-001',
        totalAmount: '100.00',
        status: 'draft'
      }

      mockDb.insert().values().returning.mockResolvedValue([createdInvoice])

      const invoice = await invoiceService.createInvoice('test-org-123', {
        tabId: 'tab_integration_123',
        dueDate: new Date('2024-12-31'),
        sendEmail: false
      })

      expect(invoice.tabId).toBe('tab_integration_123')

      // Step 3: Create payment for tab
      const paymentIntent = await paymentService.createPaymentIntent('test-org-123', {
        tabId: 'tab_integration_123',
        amount: 10000 // $100.00
      })

      expect(paymentIntent.id).toBe('pi_test_123')

      // All services should have been called
      expect(mockDb.insert).toHaveBeenCalledTimes(2) // Tab + Invoice
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should propagate database errors correctly', async () => {
      const tabService = container.resolve(DITokens.TabService) as TabManagementService

      mockDb.query.tabs.findMany.mockRejectedValue(new Error('Database connection failed'))

      await expect(
        tabService.listTabs('test-org-123', { page: 1, pageSize: 20 })
      ).rejects.toThrow('Database connection failed')

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should handle Stripe API errors', async () => {
      const paymentService = container.resolve(DITokens.PaymentService) as PaymentService

      mockDb.query.tabs.findFirst.mockResolvedValue({
        id: 'tab_test_123',
        organizationId: 'test-org-123',
        totalAmount: '100.00',
        status: 'open'
      })

      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Card declined'))

      await expect(
        paymentService.createPaymentIntent('test-org-123', {
          tabId: 'tab_test_123',
          amount: 5000
        })
      ).rejects.toThrow('Card declined')
    })
  })

  describe('Dependency Scoping', () => {
    it('should create request-scoped containers correctly', () => {
      const scope1 = container.createScope()
      const scope2 = container.createScope()

      const tabService1 = scope1.resolve(DITokens.TabService)
      const tabService2 = scope2.resolve(DITokens.TabService)

      // Services should be different instances (request-scoped)
      expect(tabService1).not.toBe(tabService2)

      // But should share singleton dependencies like database
      const db1 = scope1.resolve(DITokens.Database)
      const db2 = scope2.resolve(DITokens.Database)
      expect(db1).toBe(db2)
    })
  })
})