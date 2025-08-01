/**
 * Billing Group Service - Compatibility Layer
 * This provides backwards compatibility while we migrate to the new DI pattern
 * TODO: Remove this file after all clients are updated to use BillingGroupService directly
 */

import { getServerDI } from '@/lib/di/server'

export class BillingGroupService {
  /**
   * Get billing groups for tab
   * @deprecated Use new BillingGroupService directly
   */
  static async getBillingGroups(options: any) {
    const di = getServerDI()
    return di.billingGroupService.listBillingGroups('', {
      page: 1,
      pageSize: 50,
      filters: { tabId: options.tabId }
    })
  }

  /**
   * Create billing group
   * @deprecated Use new BillingGroupService directly
   */
  static async createBillingGroup(data: any) {
    const di = getServerDI()
    return di.billingGroupService.createBillingGroup('', {
      tabId: data.tabId,
      name: data.name,
      groupType: data.groupType,
      payerEmail: data.payerEmail,
      creditLimit: data.creditLimit,
      depositAmount: data.depositAmount,
      authorizationCode: data.authorizationCode,
      poNumber: data.poNumber,
      metadata: data.metadata,
    })
  }

  /**
   * Update billing group
   * @deprecated Use new BillingGroupService directly
   */
  static async updateBillingGroup(id: string, data: any) {
    const di = getServerDI()
    return di.billingGroupService.updateBillingGroup(id, '', data)
  }

  /**
   * Delete billing group
   * @deprecated Use new BillingGroupService directly
   */
  static async deleteBillingGroup(id: string, organizationId: string) {
    const di = getServerDI()
    return di.billingGroupService.deleteBillingGroup(id, organizationId)
  }

  /**
   * Get billing group by ID
   * @deprecated Use new BillingGroupService directly
   */
  static async getBillingGroupById(id: string, organizationId: string) {
    const di = getServerDI()
    return di.billingGroupService.getBillingGroup(id, organizationId)
  }
}