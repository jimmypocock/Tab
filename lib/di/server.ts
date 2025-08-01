/**
 * Server Component DI Helper
 * Provides DI services for server components and server actions
 */

import { getGlobalContainer } from './container'
import { productionConfig } from './config'
import { DITokens } from './types'
import type { TabManagementService } from '@/lib/services/tab-management.service'
import type { PaymentService } from '@/lib/services/payment.service'
import type { InvoiceManagementService } from '@/lib/services/invoice-management.service'
import type { OrganizationManagementService } from '@/lib/services/organization-management.service'
import type { BillingGroupService } from '@/lib/services/billing-group.service'

/**
 * Server DI Context - provides services for server components
 */
export class ServerDIContext {
  private container = getGlobalContainer()

  constructor() {
    // Ensure container is configured
    if (!this.container.isConfigured()) {
      productionConfig.forEach(config => {
        this.container.register(config.token, config.factory, config.singleton)
      })
    }
  }

  get tabService(): TabManagementService {
    return this.container.resolve(DITokens.TabService)
  }

  get paymentService(): PaymentService {
    return this.container.resolve(DITokens.PaymentService)
  }

  get invoiceService(): InvoiceManagementService {
    return this.container.resolve(DITokens.InvoiceService)
  }

  get organizationService(): OrganizationManagementService {
    return this.container.resolve(DITokens.OrganizationService)
  }

  get billingGroupService(): BillingGroupService {
    return this.container.resolve(DITokens.BillingGroupService)
  }
}

/**
 * Get DI services for server components
 */
export function getServerDI(): ServerDIContext {
  return new ServerDIContext()
}