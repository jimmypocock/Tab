/**
 * Request Context - Provides scoped DI container and services for each request
 */

import { NextRequest } from 'next/server'
import { createRequestContainer, DITokens } from '@/lib/di'
import type { IDIContainer } from '@/lib/di/types'
import type { OrganizationContext } from './organization-middleware'

// Import all services for type safety
import type { TabManagementService } from '@/lib/services/tab-management.service'
import type { PaymentService } from '@/lib/services/payment.service'
import type { InvoiceService } from '@/lib/services/invoice.service'
import type { BillingGroupService } from '@/lib/services/billing-group.service'
import type { OrganizationManagementService } from '@/lib/services/organization-management.service'
import type { EmailService } from '@/lib/services/email.service'
import type { FeatureFlagService } from '@/lib/services/feature-flag.service'

// Import repositories for direct access when needed
import type { TabRepository } from '@/lib/repositories/tab.repository'
import type { PaymentRepository } from '@/lib/repositories/payment.repository'
import type { OrganizationRepository } from '@/lib/repositories/organization.repository'
import type { InvoiceRepository } from '@/lib/repositories/invoice.repository'
import type { BillingGroupRepository } from '@/lib/repositories/billing-group.repository'
import type { ApiKeyRepository } from '@/lib/repositories/api-key.repository'
import type { LineItemRepository } from '@/lib/repositories/line-item.repository'

export class RequestContext {
  private container: IDIContainer
  
  constructor(
    public readonly request: NextRequest,
    public readonly organization: OrganizationContext,
    container?: IDIContainer
  ) {
    // Create request-scoped container
    this.container = container || createRequestContainer()
  }

  // Services
  get tabService(): TabManagementService {
    return this.container.resolve(DITokens.TabService)
  }

  get paymentService(): PaymentService {
    return this.container.resolve(DITokens.PaymentService)
  }

  get invoiceService(): InvoiceService {
    return this.container.resolve(DITokens.InvoiceService)
  }

  get billingGroupService(): BillingGroupService {
    return this.container.resolve(DITokens.BillingGroupService)
  }

  get organizationService(): OrganizationManagementService {
    return this.container.resolve(DITokens.OrganizationService)
  }

  get emailService(): EmailService {
    return this.container.resolve(DITokens.EmailService)
  }

  get featureFlags(): FeatureFlagService {
    return this.container.resolve(DITokens.FeatureFlags)
  }

  // Repositories (when direct access needed)
  get tabRepository(): TabRepository {
    return this.container.resolve(DITokens.TabRepository)
  }

  get paymentRepository(): PaymentRepository {
    return this.container.resolve(DITokens.PaymentRepository)
  }

  get organizationRepository(): OrganizationRepository {
    return this.container.resolve(DITokens.OrganizationRepository)
  }

  get invoiceRepository(): InvoiceRepository {
    return this.container.resolve(DITokens.InvoiceRepository)
  }

  get billingGroupRepository(): BillingGroupRepository {
    return this.container.resolve(DITokens.BillingGroupRepository)
  }

  get apiKeyRepository(): ApiKeyRepository {
    return this.container.resolve(DITokens.ApiKeyRepository)
  }

  get lineItemRepository(): LineItemRepository {
    return this.container.resolve(DITokens.LineItemRepository)
  }

  // Helper methods
  get organizationId(): string {
    return this.organization.organizationId
  }

  get userId(): string | undefined {
    return this.organization.userId
  }

  get userRole(): string | undefined {
    return this.organization.userRole
  }

  get scope(): 'merchant' | 'corporate' | 'full' {
    return this.organization.scope
  }

  /**
   * Check if feature is enabled for this context
   */
  async isFeatureEnabled(flag: string): Promise<boolean> {
    return this.featureFlags.isEnabled(flag, {
      organizationId: this.organizationId,
      userId: this.userId,
    })
  }

  /**
   * Check if user has required role
   */
  hasRole(requiredRole: 'owner' | 'admin' | 'member' | 'viewer'): boolean {
    const roleHierarchy = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    }

    const userLevel = roleHierarchy[this.userRole as keyof typeof roleHierarchy] || 0
    const requiredLevel = roleHierarchy[requiredRole] || 0

    return userLevel >= requiredLevel
  }
}