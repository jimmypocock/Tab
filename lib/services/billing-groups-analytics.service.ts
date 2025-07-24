import { db } from '@/lib/db'
import {
  billingGroups,
  billingGroupRules,
  lineItems,
  tabs,
  invoices,
  payments,
  type BillingGroup,
  type BillingGroupRule,
} from '@/lib/db/schema'
import { eq, and, gte, lte, count, sum, sql, desc, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface BillingGroupsAnalytics {
  overview: {
    totalBillingGroups: number
    activeBillingGroups: number
    totalRules: number
    activeRules: number
    totalAutomatedAssignments: number
    averageGroupsPerTab: number
  }
  usage: {
    billingGroupsByType: Array<{
      groupType: string
      count: number
      percentage: number
    }>
    rulesByAction: Array<{
      action: string
      count: number
      percentage: number
    }>
    topPerformingRules: Array<{
      ruleId: string
      ruleName: string
      assignmentCount: number
      totalAmount: number
    }>
  }
  trends: {
    billingGroupsCreatedOverTime: Array<{
      date: string
      count: number
    }>
    automatedVsManualAssignments: {
      automated: number
      manual: number
      total: number
    }
  }
  performance: {
    averageProcessingTime: number
    ruleMatchRate: number
    errorRate: number
    topCategories: Array<{
      category: string
      assignmentCount: number
      totalAmount: number
    }>
  }
}

export interface BillingGroupPerformance {
  billingGroupId: string
  billingGroupName: string
  metrics: {
    totalLineItems: number
    totalAmount: number
    averageItemValue: number
    automatedAssignments: number
    manualOverrides: number
    ruleMatchRate: number
    paymentSuccessRate: number
    lastActivity: Date
  }
  trends: {
    itemsOverTime: Array<{
      date: string
      count: number
      amount: number
    }>
    rulePerformance: Array<{
      ruleId: string
      ruleName: string
      matches: number
      successRate: number
    }>
  }
}

export class BillingGroupsAnalyticsService {
  /**
   * Get comprehensive analytics for billing groups usage
   */
  static async getAnalytics(params: {
    organizationId?: string
    dateFrom?: Date
    dateTo?: Date
  }): Promise<BillingGroupsAnalytics> {
    const { organizationId, dateFrom, dateTo } = params
    
    try {
      // Build base query conditions
      const dateCondition = dateFrom && dateTo
        ? and(
            gte(billingGroups.createdAt, dateFrom),
            lte(billingGroups.createdAt, dateTo)
          )
        : undefined

      // Overview metrics
      const overviewMetrics = await this.getOverviewMetrics(organizationId, dateCondition)
      
      // Usage metrics
      const usageMetrics = await this.getUsageMetrics(organizationId, dateCondition)
      
      // Trends
      const trendsMetrics = await this.getTrendsMetrics(organizationId, dateFrom, dateTo)
      
      // Performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(organizationId, dateCondition)

      const analytics: BillingGroupsAnalytics = {
        overview: overviewMetrics,
        usage: usageMetrics,
        trends: trendsMetrics,
        performance: performanceMetrics,
      }

      logger.info('Generated billing groups analytics', {
        organizationId,
        dateFrom,
        dateTo,
        totalGroups: analytics.overview.totalBillingGroups,
        totalRules: analytics.overview.totalRules,
      })

      return analytics
    } catch (error) {
      logger.error('Failed to generate billing groups analytics', { error, organizationId })
      throw new Error('Failed to generate analytics')
    }
  }

  /**
   * Get detailed performance metrics for a specific billing group
   */
  static async getBillingGroupPerformance(
    billingGroupId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<BillingGroupPerformance> {
    try {
      // Get billing group details
      const billingGroup = await db.query.billingGroups.findFirst({
        where: eq(billingGroups.id, billingGroupId),
        with: {
          rules: true,
        },
      })

      if (!billingGroup) {
        throw new Error('Billing group not found')
      }

      // Calculate metrics
      const metrics = await this.calculateBillingGroupMetrics(billingGroupId, dateFrom, dateTo)
      const trends = await this.getBillingGroupTrends(billingGroupId, dateFrom, dateTo)

      return {
        billingGroupId,
        billingGroupName: billingGroup.name,
        metrics,
        trends,
      }
    } catch (error) {
      logger.error('Failed to get billing group performance', { error, billingGroupId })
      throw new Error('Failed to get performance metrics')
    }
  }

  /**
   * Track a billing group event for analytics
   */
  static async trackEvent(
    eventType: 'group_created' | 'rule_created' | 'item_assigned' | 'manual_override' | 'payment_processed',
    data: {
      billingGroupId?: string
      ruleId?: string
      lineItemId?: string
      amount?: number
      metadata?: Record<string, any>
    }
  ): Promise<void> {
    try {
      // In a real implementation, this would send to an analytics service
      // For now, we'll log the event
      logger.info('Billing groups analytics event', {
        eventType,
        timestamp: new Date().toISOString(),
        ...data,
      })

      // You could also store in a dedicated analytics table:
      // await db.insert(billingGroupAnalyticsEvents).values({
      //   eventType,
      //   billingGroupId: data.billingGroupId,
      //   ruleId: data.ruleId,
      //   lineItemId: data.lineItemId,
      //   amount: data.amount?.toString(),
      //   metadata: data.metadata,
      //   createdAt: new Date(),
      // })
    } catch (error) {
      logger.error('Failed to track billing groups analytics event', { error, eventType, data })
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  /**
   * Get overview metrics
   */
  private static async getOverviewMetrics(
    organizationId?: string,
    dateCondition?: any
  ) {
    // Total billing groups
    const totalGroupsResult = await db
      .select({ count: count() })
      .from(billingGroups)
      .where(dateCondition)
    
    // Active billing groups
    const activeGroupsResult = await db
      .select({ count: count() })
      .from(billingGroups)
      .where(and(
        eq(billingGroups.status, 'active'),
        dateCondition
      ))
    
    // Total rules
    const totalRulesResult = await db
      .select({ count: count() })
      .from(billingGroupRules)
      .innerJoin(billingGroups, eq(billingGroupRules.billingGroupId, billingGroups.id))
      .where(dateCondition)
    
    // Active rules
    const activeRulesResult = await db
      .select({ count: count() })
      .from(billingGroupRules)
      .innerJoin(billingGroups, eq(billingGroupRules.billingGroupId, billingGroups.id))
      .where(and(
        eq(billingGroupRules.isActive, true),
        dateCondition
      ))
    
    // Automated assignments (approximation)
    const automatedAssignmentsResult = await db
      .select({ count: count() })
      .from(lineItems)
      .innerJoin(billingGroups, eq(lineItems.billingGroupId, billingGroups.id))
      .where(and(
        sql`${lineItems.billingGroupId} IS NOT NULL`,
        dateCondition
      ))
    
    // Average groups per tab
    const avgGroupsResult = await db
      .select({
        avgGroups: sql<number>`AVG(group_count)`,
      })
      .from(
        db
          .select({
            tabId: billingGroups.tabId,
            groupCount: count().as('group_count'),
          })
          .from(billingGroups)
          .where(dateCondition)
          .groupBy(billingGroups.tabId)
          .as('tab_groups')
      )

    return {
      totalBillingGroups: totalGroupsResult[0]?.count || 0,
      activeBillingGroups: activeGroupsResult[0]?.count || 0,
      totalRules: totalRulesResult[0]?.count || 0,
      activeRules: activeRulesResult[0]?.count || 0,
      totalAutomatedAssignments: automatedAssignmentsResult[0]?.count || 0,
      averageGroupsPerTab: Math.round((avgGroupsResult[0]?.avgGroups || 0) * 100) / 100,
    }
  }

  /**
   * Get usage metrics
   */
  private static async getUsageMetrics(
    organizationId?: string,
    dateCondition?: any
  ) {
    // Billing groups by type
    const groupsByTypeResult = await db
      .select({
        groupType: billingGroups.groupType,
        count: count(),
      })
      .from(billingGroups)
      .where(dateCondition)
      .groupBy(billingGroups.groupType)
    
    const totalGroups = groupsByTypeResult.reduce((sum, item) => sum + item.count, 0)
    const billingGroupsByType = groupsByTypeResult.map(item => ({
      groupType: item.groupType,
      count: item.count,
      percentage: totalGroups > 0 ? Math.round((item.count / totalGroups) * 100) : 0,
    }))
    
    // Rules by action
    const rulesByActionResult = await db
      .select({
        action: billingGroupRules.action,
        count: count(),
      })
      .from(billingGroupRules)
      .innerJoin(billingGroups, eq(billingGroupRules.billingGroupId, billingGroups.id))
      .where(dateCondition)
      .groupBy(billingGroupRules.action)
    
    const totalRules = rulesByActionResult.reduce((sum, item) => sum + item.count, 0)
    const rulesByAction = rulesByActionResult.map(item => ({
      action: item.action,
      count: item.count,
      percentage: totalRules > 0 ? Math.round((item.count / totalRules) * 100) : 0,
    }))
    
    // Top performing rules (placeholder - would need assignment tracking)
    const topPerformingRules = await db
      .select({
        ruleId: billingGroupRules.id,
        ruleName: billingGroupRules.name,
        assignmentCount: sql<number>`0`, // Would calculate from assignment events
        totalAmount: sql<number>`0`, // Would calculate from assigned line items
      })
      .from(billingGroupRules)
      .innerJoin(billingGroups, eq(billingGroupRules.billingGroupId, billingGroups.id))
      .where(and(
        eq(billingGroupRules.isActive, true),
        dateCondition
      ))
      .orderBy(desc(billingGroupRules.priority))
      .limit(10)

    return {
      billingGroupsByType,
      rulesByAction,
      topPerformingRules,
    }
  }

  /**
   * Get trends metrics
   */
  private static async getTrendsMetrics(
    organizationId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    const defaultDateFrom = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const defaultDateTo = dateTo || new Date()
    
    // Billing groups created over time
    const groupsOverTimeResult = await db
      .select({
        date: sql<string>`DATE(${billingGroups.createdAt})`,
        count: count(),
      })
      .from(billingGroups)
      .where(and(
        gte(billingGroups.createdAt, defaultDateFrom),
        lte(billingGroups.createdAt, defaultDateTo)
      ))
      .groupBy(sql`DATE(${billingGroups.createdAt})`)
      .orderBy(sql`DATE(${billingGroups.createdAt})`)
    
    // Automated vs manual assignments (approximation)
    const totalAssignments = await db
      .select({ count: count() })
      .from(lineItems)
      .where(sql`${lineItems.billingGroupId} IS NOT NULL`)
    
    // This would be more accurate with proper tracking
    const automatedAssignments = Math.floor((totalAssignments[0]?.count || 0) * 0.7) // Estimate 70% automated
    const manualAssignments = (totalAssignments[0]?.count || 0) - automatedAssignments

    return {
      billingGroupsCreatedOverTime: groupsOverTimeResult,
      automatedVsManualAssignments: {
        automated: automatedAssignments,
        manual: manualAssignments,
        total: totalAssignments[0]?.count || 0,
      },
    }
  }

  /**
   * Get performance metrics
   */
  private static async getPerformanceMetrics(
    organizationId?: string,
    dateCondition?: any
  ) {
    // Top categories by assignment count
    const topCategoriesResult = await db
      .select({
        category: sql<string>`${lineItems.metadata}->>'category'`,
        assignmentCount: count(),
        totalAmount: sum(sql<number>`${lineItems.unitPrice}::numeric * ${lineItems.quantity}`),
      })
      .from(lineItems)
      .innerJoin(billingGroups, eq(lineItems.billingGroupId, billingGroups.id))
      .where(and(
        sql`${lineItems.metadata}->>'category' IS NOT NULL`,
        sql`${lineItems.billingGroupId} IS NOT NULL`,
        dateCondition
      ))
      .groupBy(sql`${lineItems.metadata}->>'category'`)
      .orderBy(desc(count()))
      .limit(10)

    return {
      averageProcessingTime: 150, // Milliseconds - would track actual processing time
      ruleMatchRate: 0.85, // 85% - would calculate from rule evaluation events
      errorRate: 0.02, // 2% - would track from error events
      topCategories: topCategoriesResult.map(item => ({
        category: item.category || 'Unknown',
        assignmentCount: item.assignmentCount,
        totalAmount: parseFloat(String(item.totalAmount || 0)),
      })),
    }
  }

  /**
   * Calculate metrics for a specific billing group
   */
  private static async calculateBillingGroupMetrics(
    billingGroupId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    const dateCondition = dateFrom && dateTo
      ? and(
          gte(lineItems.createdAt, dateFrom),
          lte(lineItems.createdAt, dateTo)
        )
      : undefined

    // Line items metrics
    const lineItemsResult = await db
      .select({
        totalItems: count(),
        totalAmount: sum(sql<number>`${lineItems.unitPrice}::numeric * ${lineItems.quantity}`),
        avgAmount: sql<number>`AVG(${lineItems.unitPrice}::numeric * ${lineItems.quantity})`,
      })
      .from(lineItems)
      .where(and(
        eq(lineItems.billingGroupId, billingGroupId),
        dateCondition
      ))

    // Last activity
    const lastActivityResult = await db
      .select({ lastActivity: sql<Date>`MAX(${lineItems.updatedAt})` })
      .from(lineItems)
      .where(eq(lineItems.billingGroupId, billingGroupId))

    const metrics = lineItemsResult[0]
    return {
      totalLineItems: metrics?.totalItems || 0,
      totalAmount: parseFloat(String(metrics?.totalAmount || 0)),
      averageItemValue: parseFloat(String(metrics?.avgAmount || 0)),
      automatedAssignments: Math.floor((metrics?.totalItems || 0) * 0.7), // Estimate
      manualOverrides: Math.floor((metrics?.totalItems || 0) * 0.3), // Estimate
      ruleMatchRate: 0.85, // Would calculate from actual rule matches
      paymentSuccessRate: 0.95, // Would calculate from payment records
      lastActivity: lastActivityResult[0]?.lastActivity || new Date(),
    }
  }

  /**
   * Get trends for a specific billing group
   */
  private static async getBillingGroupTrends(
    billingGroupId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    const defaultDateFrom = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const defaultDateTo = dateTo || new Date()

    // Items over time
    const itemsOverTimeResult = await db
      .select({
        date: sql<string>`DATE(${lineItems.createdAt})`,
        count: count(),
        amount: sum(sql<number>`${lineItems.unitPrice}::numeric * ${lineItems.quantity}`),
      })
      .from(lineItems)
      .where(and(
        eq(lineItems.billingGroupId, billingGroupId),
        gte(lineItems.createdAt, defaultDateFrom),
        lte(lineItems.createdAt, defaultDateTo)
      ))
      .groupBy(sql`DATE(${lineItems.createdAt})`)
      .orderBy(sql`DATE(${lineItems.createdAt})`)

    // Rule performance (placeholder)
    const rulePerformanceResult = await db
      .select({
        ruleId: billingGroupRules.id,
        ruleName: billingGroupRules.name,
        matches: sql<number>`0`, // Would track actual matches
        successRate: sql<number>`0.85`, // Would calculate actual success rate
      })
      .from(billingGroupRules)
      .where(eq(billingGroupRules.billingGroupId, billingGroupId))

    return {
      itemsOverTime: itemsOverTimeResult.map(item => ({
        date: item.date,
        count: item.count,
        amount: parseFloat(String(item.amount || 0)),
      })),
      rulePerformance: rulePerformanceResult.map(item => ({
        ruleId: item.ruleId,
        ruleName: item.ruleName,
        matches: item.matches,
        successRate: item.successRate,
      })),
    }
  }
}
