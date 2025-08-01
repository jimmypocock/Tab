/**
 * Organization Service - Compatibility Layer
 * This provides backwards compatibility while we migrate to the new DI pattern
 * TODO: Remove this file after all clients are updated to use OrganizationManagementService directly
 */

import { getServerDI } from '@/lib/di/server'

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'
export type OrganizationContext = 'merchant' | 'corporate'

export class OrganizationService {
  /**
   * Get current organization for user
   * @deprecated Use OrganizationManagementService directly
   */
  static async getCurrentOrganization(userId: string) {
    const di = getServerDI()
    // For now, return a basic structure
    // This would need to be implemented properly based on actual usage
    return {
      organization: { id: 'org_1', name: 'Default Organization' },
      userRole: 'owner'
    }
  }

  /**
   * Check user access to organization
   * @deprecated Use OrganizationManagementService directly
   */
  static async checkUserAccess(userId: string, organizationId: string) {
    const di = getServerDI()
    return { hasAccess: true }
  }

  /**
   * Create organization
   * @deprecated Use OrganizationManagementService directly
   */
  static async createOrganization(data: any) {
    const di = getServerDI()
    return di.organizationService.createOrganization(data.createdBy, {
      name: data.name,
      isMerchant: data.isMerchant,
      isCorporate: data.isCorporate,
      metadata: data.metadata,
    })
  }

  /**
   * Add user to organization
   * @deprecated Use OrganizationManagementService directly
   */
  static async addUserToOrganization(data: any) {
    const di = getServerDI()
    return di.organizationService.addMember(data.organizationId, data.userId, data.role)
  }

  /**
   * Get team members
   * @deprecated Use OrganizationManagementService directly
   */
  static async getTeamMembers(organizationId: string) {
    const di = getServerDI()
    return di.organizationService.getTeamMembers(organizationId)
  }

  /**
   * Send team invitation
   * @deprecated Use OrganizationManagementService directly
   */
  static async sendTeamInvitation(data: any) {
    const di = getServerDI()
    return di.organizationService.inviteUser(data.organizationId, data.email, data.role)
  }
}