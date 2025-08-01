/**
 * Dependency Injection Configuration
 */

import { DITokens, DependencyConfig } from './types'
import { db } from '@/lib/db/client'
import { stripe } from '@/lib/stripe/client'
import { redis } from '@/lib/redis/client'
import { logger } from '@/lib/logger'

// Repositories
import { TabRepository } from '@/lib/repositories/tab.repository'
import { LineItemRepository } from '@/lib/repositories/line-item.repository'
import { PaymentRepository } from '@/lib/repositories/payment.repository'
import { OrganizationRepository } from '@/lib/repositories/organization.repository'
import { BillingGroupRepository } from '@/lib/repositories/billing-group.repository'
import { InvoiceRepository } from '@/lib/repositories/invoice.repository'
import { ApiKeyRepository } from '@/lib/repositories/api-key.repository'

// Services
import { TabManagementService } from '@/lib/services/tab-management.service'
import { PaymentService } from '@/lib/services/payment.service'
import { InvoiceManagementService } from '@/lib/services/invoice-management.service'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { OrganizationManagementService } from '@/lib/services/organization-management.service'
import { EmailService } from '@/lib/services/email.service'
import { FeatureFlagService } from '@/lib/services/feature-flag.service'

/**
 * Production dependencies configuration
 */
export const productionConfig: DependencyConfig[] = [
  // Clients (singletons)
  {
    token: DITokens.Database,
    factory: () => db,
    singleton: true,
  },
  {
    token: DITokens.Redis,
    factory: () => redis,
    singleton: true,
  },
  {
    token: DITokens.Stripe,
    factory: () => stripe,
    singleton: true,
  },
  {
    token: DITokens.Logger,
    factory: () => logger,
    singleton: true,
  },

  // Repositories (singletons)
  {
    token: DITokens.TabRepository,
    factory: (container) => new TabRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  {
    token: DITokens.LineItemRepository,
    factory: (container) => new LineItemRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  {
    token: DITokens.PaymentRepository,
    factory: (container) => new PaymentRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  {
    token: DITokens.OrganizationRepository,
    factory: (container) => new OrganizationRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  {
    token: DITokens.BillingGroupRepository,
    factory: (container) => new BillingGroupRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  {
    token: DITokens.InvoiceRepository,
    factory: (container) => new InvoiceRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  {
    token: DITokens.ApiKeyRepository,
    factory: (container) => new ApiKeyRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },

  // Services (request-scoped)
  {
    token: DITokens.TabService,
    factory: (container) => new TabManagementService(container),
    singleton: false, // New instance per request
  },
  {
    token: DITokens.PaymentService,
    factory: (container) => new PaymentService(container),
    singleton: false,
  },
  {
    token: DITokens.InvoiceService,
    factory: (container) => new InvoiceManagementService(container),
    singleton: false,
  },
  {
    token: DITokens.BillingGroupService,
    factory: (container) => new BillingGroupService(container),
    singleton: false,
  },
  {
    token: DITokens.OrganizationService,
    factory: (container) => new OrganizationManagementService(container),
    singleton: false,
  },
  {
    token: DITokens.EmailService,
    factory: (container) => new EmailService(container.resolve(DITokens.Logger)),
    singleton: true,
  },
  {
    token: DITokens.FeatureFlags,
    factory: (container) => new FeatureFlagService(container.resolve(DITokens.Redis)),
    singleton: true,
  },
]

/**
 * Test dependencies configuration
 */
export const testConfig: DependencyConfig[] = [
  // Mock clients
  {
    token: DITokens.Database,
    factory: () => ({
      query: {
        tabs: { findMany: jest.fn(), findFirst: jest.fn() },
        lineItems: { findMany: jest.fn(), findFirst: jest.fn() },
        payments: { findMany: jest.fn(), findFirst: jest.fn() },
        organizations: { findMany: jest.fn(), findFirst: jest.fn() },
        billingGroups: { findMany: jest.fn(), findFirst: jest.fn() },
      },
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn((cb) => cb({
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        }),
        query: {
          tabs: { findFirst: jest.fn() },
          billingGroups: { findFirst: jest.fn() },
        }
      })),
    }),
    singleton: true,
  },
  {
    token: DITokens.Redis,
    factory: () => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
    }),
    singleton: true,
  },
  {
    token: DITokens.Stripe,
    factory: () => ({
      checkout: {
        sessions: {
          create: jest.fn(),
          retrieve: jest.fn(),
        },
      },
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    }),
    singleton: true,
  },
  {
    token: DITokens.Logger,
    factory: () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
    singleton: true,
  },

  // Use real repositories with mock database
  {
    token: DITokens.TabRepository,
    factory: (container) => new TabRepository(container.resolve(DITokens.Database)),
    singleton: true,
  },
  // ... other repositories

  // Use real services with mock dependencies
  {
    token: DITokens.TabService,
    factory: (container) => new TabManagementService(container),
    singleton: false,
  },
  // ... other services
]