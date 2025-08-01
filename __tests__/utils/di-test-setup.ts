/**
 * DI Test Setup Utilities
 * Provides testing utilities for the new DI pattern
 */

import { DIContainer } from '@/lib/di/container'
import { DITokens } from '@/lib/di/types'
import { RequestContext } from '@/lib/api/request-context'
import { NextRequest } from 'next/server'

/**
 * Create a test DI container with mocked dependencies
 */
export function createTestDIContainer(): DIContainer {
  const container = new DIContainer()

  // Mock Database
  container.register(DITokens.Database, () => ({
    query: {
      tabs: { 
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      lineItems: { 
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      payments: { 
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      organizations: { 
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      billingGroups: { 
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      invoices: { 
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'test-id' }])
      })
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'test-id' }])
        })
      })
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([])
    }),
    transaction: jest.fn().mockImplementation((cb) => cb(container.resolve(DITokens.Database))),
  }))

  // Mock Redis
  container.register(DITokens.Redis, () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
  }))

  // Mock Stripe
  container.register(DITokens.Stripe, () => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'cs_test_123', payment_status: 'paid' }),
      },
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_test_123', client_secret: 'pi_test_123_secret_123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' }),
    },
  }))

  // Mock Logger
  container.register(DITokens.Logger, () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }))

  // Register repositories with mocked database
  container.register(DITokens.TabRepository, () => {
    const { TabRepository } = require('@/lib/repositories/tab.repository')
    return new TabRepository(container.resolve(DITokens.Database))
  })

  container.register(DITokens.LineItemRepository, () => {
    const { LineItemRepository } = require('@/lib/repositories/line-item.repository')
    return new LineItemRepository(container.resolve(DITokens.Database))
  })

  container.register(DITokens.PaymentRepository, () => {
    const { PaymentRepository } = require('@/lib/repositories/payment.repository')
    return new PaymentRepository(container.resolve(DITokens.Database))
  })

  container.register(DITokens.OrganizationRepository, () => {
    const { OrganizationRepository } = require('@/lib/repositories/organization.repository')
    return new OrganizationRepository(container.resolve(DITokens.Database))
  })

  container.register(DITokens.BillingGroupRepository, () => {
    const { BillingGroupRepository } = require('@/lib/repositories/billing-group.repository')
    return new BillingGroupRepository(container.resolve(DITokens.Database))
  })

  container.register(DITokens.InvoiceRepository, () => {
    const { InvoiceRepository } = require('@/lib/repositories/invoice.repository')
    return new InvoiceRepository(container.resolve(DITokens.Database))
  })

  container.register(DITokens.ApiKeyRepository, () => {
    const { ApiKeyRepository } = require('@/lib/repositories/api-key.repository')
    return new ApiKeyRepository(container.resolve(DITokens.Database))
  })

  // Register services with mocked dependencies
  container.register(DITokens.TabService, () => {
    const { TabManagementService } = require('@/lib/services/tab-management.service')
    return new TabManagementService(container)
  }, false)

  container.register(DITokens.PaymentService, () => {
    const { PaymentService } = require('@/lib/services/payment.service')
    return new PaymentService(container)
  }, false)

  container.register(DITokens.InvoiceService, () => {
    const { InvoiceManagementService } = require('@/lib/services/invoice-management.service')
    return new InvoiceManagementService(container)
  }, false)

  container.register(DITokens.BillingGroupService, () => {
    const { BillingGroupService } = require('@/lib/services/billing-group.service')
    return new BillingGroupService(container)
  }, false)

  container.register(DITokens.OrganizationService, () => {
    const { OrganizationManagementService } = require('@/lib/services/organization-management.service')
    return new OrganizationManagementService(container)
  }, false)

  container.register(DITokens.EmailService, () => {
    const { EmailService } = require('@/lib/services/email.service')
    return new EmailService(container.resolve(DITokens.Logger))
  })

  container.register(DITokens.FeatureFlags, () => {
    const { FeatureFlagService } = require('@/lib/services/feature-flag.service')
    return new FeatureFlagService(container.resolve(DITokens.Redis))
  })

  return container
}

/**
 * Create a test request context with mocked organization
 */
export function createTestRequestContext(
  organizationId: string = 'test-org-123',
  userRole: string = 'owner'
): RequestContext {
  const mockRequest = new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-api-key': 'test-api-key' }
  })

  const mockOrgContext = {
    organizationId,
    organization: {
      id: organizationId,
      name: 'Test Organization',
      isMerchant: true,
      isCorporate: false,
    },
    userRole,
    userId: 'test-user-123',
    apiKey: 'test-api-key',
    authType: 'apiKey' as const,
    scope: 'merchant' as const,
  }

  return new RequestContext(mockRequest, mockOrgContext)
}

/**
 * Mock the DI middleware for tests
 */
export function mockDIMiddleware() {
  return {
    withMerchantDI: jest.fn((handler) => 
      jest.fn(async (request) => {
        const context = createTestRequestContext()
        return handler(context)
      })
    ),
    withAdminDI: jest.fn((handler) => 
      jest.fn(async (request) => {
        const context = createTestRequestContext('test-org-123', 'admin')
        return handler(context)
      })
    ),
    withOwnerDI: jest.fn((handler) => 
      jest.fn(async (request) => {
        const context = createTestRequestContext('test-org-123', 'owner')
        return handler(context)
      })
    ),
  }
}

/**
 * Mock data generators for tests
 */
export const testData = {
  tab: {
    id: 'tab_test_123',
    organizationId: 'test-org-123',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    totalAmount: '100.00',
    paidAmount: '0.00',
    status: 'open',
    currency: 'usd',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  lineItem: {
    id: 'li_test_123',
    tabId: 'tab_test_123',
    description: 'Test Item',
    quantity: 1,
    unitPrice: '50.00',
    totalPrice: '50.00',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  
  payment: {
    id: 'pay_test_123',
    tabId: 'tab_test_123',
    amount: '100.00',
    currency: 'usd',
    status: 'succeeded',
    processor: 'stripe',
    processorPaymentId: 'pi_test_123',
    createdAt: new Date(),
  },
  
  organization: {
    id: 'test-org-123',
    name: 'Test Organization',
    isMerchant: true,
    isCorporate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}