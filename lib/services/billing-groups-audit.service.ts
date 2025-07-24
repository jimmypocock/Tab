import { db } from '@/lib/db'
import {
  billingGroups,
  billingGroupRules,
  billingGroupOverrides,
  lineItems,
  type BillingGroup,
  type BillingGroupRule,
  type LineItem,
} from '@/lib/db/schema'
import { eq, and, desc, gte, lte, or, ilike } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { logger } from '@/lib/logger'

export interface AuditEvent {
  id: string
  entityType: 'billing_group' | 'billing_group_rule' | 'line_item_assignment'
  entityId: string
  action: 'created' | 'updated' | 'deleted' | 'assigned' | 'unassigned' | 'override'
  userId: string
  userEmail?: string
  changes: Record<string, { from: any; to: any }>
  metadata: Record<string, any>
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

export interface AuditTrailQuery {
  entityType?: 'billing_group' | 'billing_group_rule' | 'line_item_assignment'
  entityId?: string
  action?: string
  userId?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string
  limit?: number
  offset?: number
}

export interface AuditTrailResult {
  events: AuditEvent[]
  totalCount: number
  hasMore: boolean
}

// In a real implementation, this would be a database table
// For demonstration, we'll use in-memory storage with file persistence
const auditEvents: AuditEvent[] = []

export class BillingGroupsAuditService {
  /**
   * Record an audit event
   */
  static async recordEvent(params: {
    entityType: 'billing_group' | 'billing_group_rule' | 'line_item_assignment'
    entityId: string
    action: 'created' | 'updated' | 'deleted' | 'assigned' | 'unassigned' | 'override'
    userId: string
    userEmail?: string
    changes?: Record<string, { from: any; to: any }>
    metadata?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: generateId(),
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      userEmail: params.userEmail,
      changes: params.changes || {},
      metadata: params.metadata || {},
      timestamp: new Date(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    }

    // In a real implementation, insert into database
    auditEvents.push(event)
    
    // Keep only last 10000 events in memory
    if (auditEvents.length > 10000) {
      auditEvents.shift()
    }

    logger.info('Recorded billing groups audit event', {
      eventId: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId,
    })

    return event
  }

  /**
   * Query audit trail
   */
  static async queryAuditTrail(query: AuditTrailQuery): Promise<AuditTrailResult> {
    try {
      let filteredEvents = [...auditEvents]

      // Apply filters
      if (query.entityType) {
        filteredEvents = filteredEvents.filter(e => e.entityType === query.entityType)
      }

      if (query.entityId) {
        filteredEvents = filteredEvents.filter(e => e.entityId === query.entityId)
      }

      if (query.action) {
        filteredEvents = filteredEvents.filter(e => e.action === query.action)
      }

      if (query.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === query.userId)
      }

      if (query.dateFrom) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= query.dateFrom!)
      }

      if (query.dateTo) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= query.dateTo!)
      }

      if (query.search) {
        const searchLower = query.search.toLowerCase()
        filteredEvents = filteredEvents.filter(e => 
          e.entityId.toLowerCase().includes(searchLower) ||
          (e.userEmail && e.userEmail.toLowerCase().includes(searchLower)) ||
          Object.values(e.metadata).some(value => 
            String(value).toLowerCase().includes(searchLower)
          )
        )
      }

      // Sort by timestamp descending
      filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      const totalCount = filteredEvents.length
      const limit = query.limit || 50
      const offset = query.offset || 0
      
      const events = filteredEvents.slice(offset, offset + limit)
      const hasMore = offset + limit < totalCount

      return {
        events,
        totalCount,
        hasMore,
      }
    } catch (error) {
      logger.error('Failed to query audit trail', { error, query })
      throw new Error('Failed to query audit trail')
    }
  }

  /**
   * Get audit trail for a specific billing group
   */
  static async getBillingGroupAuditTrail(
    billingGroupId: string,
    options?: {
      includeRules?: boolean
      includeLineItems?: boolean
      dateFrom?: Date
      dateTo?: Date
      limit?: number
      offset?: number
    }
  ): Promise<AuditTrailResult> {
    try {
      const billingGroup = await db.query.billingGroups.findFirst({
        where: eq(billingGroups.id, billingGroupId),
        with: {
          rules: options?.includeRules,
        },
      })

      if (!billingGroup) {
        throw new Error('Billing group not found')
      }

      let entityIds = [billingGroupId]

      // Include rule IDs if requested
      if (options?.includeRules && billingGroup.rules) {
        entityIds.push(...billingGroup.rules.map(rule => rule.id))
      }

      // Include line item IDs if requested
      if (options?.includeLineItems) {
        const lineItemsResult = await db
          .select({ id: lineItems.id })
          .from(lineItems)
          .where(eq(lineItems.billingGroupId, billingGroupId))
        
        entityIds.push(...lineItemsResult.map(item => item.id))
      }

      // Query events for all related entities
      let filteredEvents = auditEvents.filter(event => 
        entityIds.includes(event.entityId)
      )

      // Apply date filters
      if (options?.dateFrom) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= options.dateFrom!)
      }

      if (options?.dateTo) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= options.dateTo!)
      }

      // Sort by timestamp descending
      filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      const totalCount = filteredEvents.length
      const limit = options?.limit || 50
      const offset = options?.offset || 0
      
      const events = filteredEvents.slice(offset, offset + limit)
      const hasMore = offset + limit < totalCount

      return {
        events,
        totalCount,
        hasMore,
      }
    } catch (error) {
      logger.error('Failed to get billing group audit trail', { error, billingGroupId })
      throw new Error('Failed to get audit trail')
    }
  }

  /**
   * Record billing group creation
   */
  static async recordBillingGroupCreated(
    billingGroup: BillingGroup,
    userId: string,
    userEmail?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent({
      entityType: 'billing_group',
      entityId: billingGroup.id,
      action: 'created',
      userId,
      userEmail,
      changes: {
        name: { from: null, to: billingGroup.name },
        groupType: { from: null, to: billingGroup.groupType },
        status: { from: null, to: billingGroup.status },
      },
      metadata: {
        tabId: billingGroup.tabId,
        groupNumber: billingGroup.groupNumber,
        ...metadata,
      },
    })
  }

  /**
   * Record billing group updates
   */
  static async recordBillingGroupUpdated(
    billingGroupId: string,
    changes: Record<string, { from: any; to: any }>,
    userId: string,
    userEmail?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent({
      entityType: 'billing_group',
      entityId: billingGroupId,
      action: 'updated',
      userId,
      userEmail,
      changes,
      metadata: metadata || {},
    })
  }

  /**
   * Record billing group rule creation
   */
  static async recordRuleCreated(
    rule: BillingGroupRule,
    userId: string,
    userEmail?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent({
      entityType: 'billing_group_rule',
      entityId: rule.id,
      action: 'created',
      userId,
      userEmail,
      changes: {
        name: { from: null, to: rule.name },
        action: { from: null, to: rule.action },
        priority: { from: null, to: rule.priority },
        conditions: { from: null, to: rule.conditions },
      },
      metadata: {
        billingGroupId: rule.billingGroupId,
        ...metadata,
      },
    })
  }

  /**
   * Record line item assignment
   */
  static async recordLineItemAssigned(
    lineItemId: string,
    billingGroupId: string,
    previousBillingGroupId: string | null,
    userId: string,
    userEmail?: string,
    isOverride: boolean = false,
    reason?: string
  ): Promise<void> {
    await this.recordEvent({
      entityType: 'line_item_assignment',
      entityId: lineItemId,
      action: isOverride ? 'override' : 'assigned',
      userId,
      userEmail,
      changes: {
        billingGroupId: {
          from: previousBillingGroupId,
          to: billingGroupId,
        },
      },
      metadata: {
        isOverride,
        reason,
        previousBillingGroupId,
        newBillingGroupId: billingGroupId,
      },
    })
  }

  /**
   * Get audit statistics
   */
  static async getAuditStatistics(params: {
    dateFrom?: Date
    dateTo?: Date
    entityType?: string
  }) {
    try {
      let filteredEvents = [...auditEvents]

      if (params.dateFrom) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= params.dateFrom!)
      }

      if (params.dateTo) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= params.dateTo!)
      }

      if (params.entityType) {
        filteredEvents = filteredEvents.filter(e => e.entityType === params.entityType)
      }

      // Calculate statistics
      const totalEvents = filteredEvents.length
      const uniqueUsers = new Set(filteredEvents.map(e => e.userId)).size
      const uniqueEntities = new Set(filteredEvents.map(e => e.entityId)).size

      const actionCounts = filteredEvents.reduce((acc, event) => {
        acc[event.action] = (acc[event.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const entityTypeCounts = filteredEvents.reduce((acc, event) => {
        acc[event.entityType] = (acc[event.entityType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const recentActivity = filteredEvents
        .slice(0, 10)
        .map(event => ({
          id: event.id,
          action: event.action,
          entityType: event.entityType,
          timestamp: event.timestamp,
          userEmail: event.userEmail,
        }))

      return {
        totalEvents,
        uniqueUsers,
        uniqueEntities,
        actionCounts,
        entityTypeCounts,
        recentActivity,
      }
    } catch (error) {
      logger.error('Failed to get audit statistics', { error, params })
      throw new Error('Failed to get audit statistics')
    }
  }

  /**
   * Export audit trail to CSV
   */
  static async exportAuditTrail(query: AuditTrailQuery): Promise<string> {
    try {
      const result = await this.queryAuditTrail({ ...query, limit: 10000 })
      
      const headers = [
        'Timestamp',
        'Entity Type',
        'Entity ID',
        'Action',
        'User Email',
        'Changes',
        'Metadata',
        'IP Address',
      ]

      const rows = result.events.map(event => [
        event.timestamp.toISOString(),
        event.entityType,
        event.entityId,
        event.action,
        event.userEmail || event.userId,
        JSON.stringify(event.changes),
        JSON.stringify(event.metadata),
        event.ipAddress || '',
      ])

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      return csvContent
    } catch (error) {
      logger.error('Failed to export audit trail', { error, query })
      throw new Error('Failed to export audit trail')
    }
  }
}
