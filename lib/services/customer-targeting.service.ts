import { createClient } from '@/lib/supabase/server'
import type { Tab, Organization } from '@/lib/db/schema'

interface CustomerTargeting {
  type: 'individual' | 'organization'
  effectiveBillingEmail: string
  customerName?: string
  organization?: {
    id: string
    name: string
    billingEmail: string | null
  }
}

/**
 * Resolves customer targeting information for a tab
 * Handles both individual customers and organization customers with email override logic
 */
export class CustomerTargetingService {
  /**
   * Get effective billing information for a tab
   */
  static async getCustomerTargeting(tab: Tab): Promise<CustomerTargeting> {
    if (tab.customerOrganizationId) {
      // Organization customer
      const supabase = await createClient()
      
      const { data: organization } = await supabase
        .from('organizations')
        .select('id, name, billing_email')
        .eq('id', tab.customerOrganizationId)
        .single()
      
      if (!organization) {
        throw new Error(`Organization not found: ${tab.customerOrganizationId}`)
      }

      // Use customerEmail override if provided, otherwise use organization's billing email
      const effectiveBillingEmail = tab.customerEmail || organization.billing_email
      
      if (!effectiveBillingEmail) {
        throw new Error(`No billing email available for organization ${organization.name}. Either set organization billing email or provide customerEmail override.`)
      }

      return {
        type: 'organization',
        effectiveBillingEmail,
        customerName: tab.customerName || organization.name,
        organization: {
          id: organization.id,
          name: organization.name,
          billingEmail: organization.billing_email,
        }
      }
    } else {
      // Individual customer
      if (!tab.customerEmail) {
        throw new Error('customerEmail is required for individual customers')
      }

      return {
        type: 'individual',
        effectiveBillingEmail: tab.customerEmail,
        customerName: tab.customerName,
      }
    }
  }

  /**
   * Validate customer targeting data before creating a tab
   */
  static validateCustomerTargeting(data: {
    customerEmail?: string
    customerName?: string
    customerOrganizationId?: string
  }): { isValid: boolean; error?: string } {
    const { customerEmail, customerOrganizationId } = data

    // Must specify either individual or organization customer
    if (!customerEmail && !customerOrganizationId) {
      return {
        isValid: false,
        error: 'Must specify either customerEmail (for individuals) or customerOrganizationId (for organizations)'
      }
    }

    // Cannot specify both individual and organization targeting
    if (customerEmail && customerOrganizationId) {
      // This is actually allowed - customerEmail can be an override for organization billing
      // So we don't treat this as an error
    }

    // If targeting organization only (no email override), we'll validate the org has billing email at creation time
    return { isValid: true }
  }

  /**
   * Get display name for customer
   */
  static getCustomerDisplayName(targeting: CustomerTargeting): string {
    if (targeting.type === 'organization' && targeting.organization) {
      return targeting.customerName || targeting.organization.name
    }
    return targeting.customerName || targeting.effectiveBillingEmail
  }

  /**
   * Get billing context for invoice generation
   */
  static getBillingContext(targeting: CustomerTargeting) {
    return {
      billingEmail: targeting.effectiveBillingEmail,
      customerName: targeting.customerName,
      isOrganization: targeting.type === 'organization',
      organizationName: targeting.organization?.name,
      hasEmailOverride: targeting.type === 'organization' && 
                       targeting.organization?.billingEmail !== targeting.effectiveBillingEmail
    }
  }
}