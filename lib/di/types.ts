/**
 * Dependency Injection Types and Interfaces
 */

import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { Redis } from '@upstash/redis'
import type Stripe from 'stripe'

// Base repository interface
export interface IRepository {
  readonly name: string
}

// Base service interface  
export interface IService {
  readonly name: string
}

// DI Token types for type-safe dependency resolution
export const DITokens = {
  // Clients
  Database: Symbol('Database'),
  Redis: Symbol('Redis'),
  Stripe: Symbol('Stripe'),
  
  // Repositories
  TabRepository: Symbol('TabRepository'),
  LineItemRepository: Symbol('LineItemRepository'),
  PaymentRepository: Symbol('PaymentRepository'),
  OrganizationRepository: Symbol('OrganizationRepository'),
  BillingGroupRepository: Symbol('BillingGroupRepository'),
  InvoiceRepository: Symbol('InvoiceRepository'),
  ApiKeyRepository: Symbol('ApiKeyRepository'),
  
  // Services
  TabService: Symbol('TabService'),
  PaymentService: Symbol('PaymentService'),
  InvoiceService: Symbol('InvoiceService'),
  EmailService: Symbol('EmailService'),
  StripeService: Symbol('StripeService'),
  BillingGroupService: Symbol('BillingGroupService'),
  OrganizationService: Symbol('OrganizationService'),
  
  // Utilities
  Logger: Symbol('Logger'),
  FeatureFlags: Symbol('FeatureFlags'),
  Cache: Symbol('Cache'),
} as const

// Type-safe token type
export type DIToken = typeof DITokens[keyof typeof DITokens]

// Dependency configuration
export interface DependencyConfig {
  token: DIToken
  factory: (container: IDIContainer) => any
  singleton?: boolean
}

// DI Container interface
export interface IDIContainer {
  register<T>(token: DIToken, factory: () => T, singleton?: boolean): void
  resolve<T>(token: DIToken): T
  createScope(): IDIContainer
}

// Request context for request-scoped dependencies
export interface IRequestContext {
  organizationId: string
  userId?: string
  apiKeyId?: string
  scope: 'merchant' | 'corporate' | 'full'
  container: IDIContainer
}