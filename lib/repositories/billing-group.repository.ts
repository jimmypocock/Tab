/**
 * Billing Group Repository
 */

import { eq, and } from 'drizzle-orm'
import { billingGroups } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'

export class BillingGroupRepository extends BaseRepository {
  readonly name = 'BillingGroupRepository'

  async findDefault(organizationId: string) {
    return this.db.query.billingGroups.findFirst({
      where: and(
        eq(billingGroups.organizationId, organizationId),
        eq(billingGroups.isDefault, true)
      )
    })
  }

  async findById(id: string, organizationId: string) {
    return this.db.query.billingGroups.findFirst({
      where: and(
        eq(billingGroups.id, id),
        eq(billingGroups.organizationId, organizationId)
      )
    })
  }

  async findMany(organizationId: string) {
    return this.db.query.billingGroups.findMany({
      where: eq(billingGroups.organizationId, organizationId),
      orderBy: (groups: any, { asc }: any) => [asc(groups.displayOrder), asc(groups.name)]
    })
  }

  async create(data: any) {
    const [created] = await this.db.insert(billingGroups)
      .values(data)
      .returning()
    
    return created
  }
}