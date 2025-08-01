import { db } from '@/lib/db'
import {
  billingGroups,
  billingGroupRules,
  billingGroupOverrides,
  lineItems,
  invoiceLineItems,
  tabs,
  invoices,
  organizations,
  type NewBillingGroup,
  type NewBillingGroupRule,
  type BillingGroup,
  type BillingGroupRule,
  type LineItem,
  type InvoiceLineItem,
} from '@/lib/db/schema'
import { eq, and, or, desc, asc, sql, gte, lte, ilike } from 'drizzle-orm'
import { generateId } from '@/lib/utils/index'
import { logger } from '@/lib/logger'

export interface BillingGroupWithRelations extends BillingGroup {
  rules?: BillingGroupRule[]
  payerOrganization?: any
  lineItems?: LineItem[]
  invoice?: any
  tab?: any
}

export interface RuleConditions {
  category?: string[]
  amount?: { min?: number; max?: number }
  time?: { start?: string; end?: string }
  dayOfWeek?: number[]
  metadata?: Record<string, any>
}

export interface CreateBillingGroupParams {
  invoiceId?: string
  tabId?: string
  name: string
  groupType: string
  payerOrganizationId?: string
  payerEmail?: string
  creditLimit?: string
  depositAmount?: string
  authorizationCode?: string
  poNumber?: string
  metadata?: Record<string, any>
}

export interface UpdateBillingGroupParams {
  name?: string
  status?: string
  creditLimit?: string
  depositAmount?: string
  authorizationCode?: string
  poNumber?: string
  metadata?: Record<string, any>
}

export interface CreateRuleParams {
  billingGroupId: string
  name: string
  priority?: number
  conditions: RuleConditions
  action?: string
  metadata?: Record<string, any>
}

export class BillingGroupService {
  /**
   * Create a new billing group
   */
  static async createBillingGroup(params: CreateBillingGroupParams): Promise<BillingGroup> {
    const groupNumber = `BG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    
    const [billingGroup] = await db
      .insert(billingGroups)
      .values({
        ...params,
        groupNumber,
        currentBalance: '0',
        depositApplied: '0',
      })
      .returning()
    
    logger.info('Created billing group', { 
      billingGroupId: billingGroup.id, 
      groupNumber: billingGroup.groupNumber,
      groupType: billingGroup.groupType 
    })
    
    return billingGroup
  }

  /**
   * Get a single billing group by ID
   */
  static async getBillingGroupById(id: string): Promise<BillingGroupWithRelations | undefined> {
    const billingGroup = await db.query.billingGroups.findFirst({
      where: eq(billingGroups.id, id),
      with: {
        payerOrganization: true,
        rules: { where: eq(billingGroupRules.isActive, true) },
        lineItems: true,
        invoice: true,
        tab: true,
      },
    })
    
    return billingGroup
  }

  /**
   * Get billing groups for a tab or invoice
   */
  static async getBillingGroups(params: {
    tabId?: string
    invoiceId?: string
    includeRules?: boolean
    includeLineItems?: boolean
  }): Promise<BillingGroupWithRelations[]> {
    let query = db.query.billingGroups.findMany({
      where: and(
        params.tabId ? eq(billingGroups.tabId, params.tabId) : undefined,
        params.invoiceId ? eq(billingGroups.invoiceId, params.invoiceId) : undefined
      ),
      with: {
        payerOrganization: true,
        rules: params.includeRules ? { where: eq(billingGroupRules.isActive, true) } : false,
        lineItems: params.includeLineItems,
        invoice: true,
        tab: true,
      },
      orderBy: [asc(billingGroups.groupNumber)],
    })
    
    return await query
  }

  /**
   * Get a single billing group by ID
   */
  static async getBillingGroupById(
    id: string, 
    options?: { includeRules?: boolean; includeLineItems?: boolean }
  ): Promise<BillingGroupWithRelations | null> {
    const billingGroup = await db.query.billingGroups.findFirst({
      where: eq(billingGroups.id, id),
      with: {
        payerOrganization: true,
        rules: options?.includeRules ? { 
          where: eq(billingGroupRules.isActive, true),
          orderBy: [asc(billingGroupRules.priority)],
        } : false,
        lineItems: options?.includeLineItems,
        invoice: true,
        tab: true,
        parentGroup: true,
        childGroups: true,
      },
    })
    
    return billingGroup || null
  }

  /**
   * Update a billing group
   */
  static async updateBillingGroup(
    id: string, 
    params: UpdateBillingGroupParams
  ): Promise<BillingGroup> {
    const [updated] = await db
      .update(billingGroups)
      .set({
        ...params,
        updatedAt: new Date(),
      })
      .where(eq(billingGroups.id, id))
      .returning()
    
    logger.info('Updated billing group', { billingGroupId: id, updates: params })
    
    return updated
  }

  /**
   * Calculate and update the current balance for a billing group
   */
  static async updateBillingGroupBalance(billingGroupId: string): Promise<void> {
    // Calculate total from assigned line items
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${lineItems.total}::numeric), 0)`,
      })
      .from(lineItems)
      .where(eq(lineItems.billingGroupId, billingGroupId))
    
    const lineItemTotal = result[0]?.total || 0
    
    // Calculate total from invoice line items
    const invoiceResult = await db
      .select({
        total: sql<number>`COALESCE(SUM((${invoiceLineItems.quantity}::numeric * ${invoiceLineItems.unitPrice}::numeric) * (1 + ${invoiceLineItems.taxRate}::numeric / 100) * (1 - ${invoiceLineItems.discountPercentage}::numeric / 100)), 0)`,
      })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.billingGroupId, billingGroupId))
    
    const invoiceItemTotal = invoiceResult[0]?.total || 0
    
    // Update the balance
    await db
      .update(billingGroups)
      .set({
        currentBalance: (lineItemTotal + invoiceItemTotal).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(billingGroups.id, billingGroupId))
    
    logger.info('Updated billing group balance', { 
      billingGroupId, 
      lineItemTotal, 
      invoiceItemTotal,
      totalBalance: lineItemTotal + invoiceItemTotal 
    })
  }

  /**
   * Create a billing group rule
   */
  static async createRule(params: CreateRuleParams): Promise<BillingGroupRule> {
    const [rule] = await db
      .insert(billingGroupRules)
      .values({
        ...params,
        priority: params.priority || 100,
        conditions: params.conditions as any,
        action: params.action || 'auto_assign',
        isActive: true,
      })
      .returning()
    
    logger.info('Created billing group rule', { 
      ruleId: rule.id, 
      billingGroupId: rule.billingGroupId,
      ruleName: rule.name 
    })
    
    return rule
  }

  /**
   * Update a billing group rule
   */
  static async updateRule(
    ruleId: string, 
    updates: Partial<NewBillingGroupRule>
  ): Promise<BillingGroupRule> {
    const [updated] = await db
      .update(billingGroupRules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(billingGroupRules.id, ruleId))
      .returning()
    
    return updated
  }

  /**
   * Delete a billing group rule
   */
  static async deleteRule(ruleId: string): Promise<void> {
    await db
      .delete(billingGroupRules)
      .where(eq(billingGroupRules.id, ruleId))
    
    logger.info('Deleted billing group rule', { ruleId })
  }

  /**
   * Evaluate rules and assign a line item to a billing group
   */
  static async assignLineItemToBillingGroup(
    lineItem: LineItem & { tab?: any },
    tabBillingGroups: BillingGroupWithRelations[]
  ): Promise<{ billingGroupId: string; matchedRuleId?: string }> {
    // Get all active rules from all billing groups
    const allRules: Array<BillingGroupRule & { billingGroupId: string }> = []
    
    for (const group of tabBillingGroups) {
      if (group.rules) {
        allRules.push(...group.rules.map(rule => ({ ...rule, billingGroupId: group.id })))
      }
    }
    
    // Sort rules by priority (lower number = higher priority)
    allRules.sort((a, b) => a.priority - b.priority)
    
    // Evaluate each rule
    for (const rule of allRules) {
      if (this.evaluateRule(lineItem, rule.conditions as RuleConditions)) {
        return { 
          billingGroupId: rule.billingGroupId, 
          matchedRuleId: rule.id 
        }
      }
    }
    
    // If no rules match, assign to the first billing group (or a default one)
    const defaultGroup = tabBillingGroups.find(g => g.groupType === 'personal') || tabBillingGroups[0]
    
    if (!defaultGroup) {
      throw new Error('No billing groups available for assignment')
    }
    
    return { billingGroupId: defaultGroup.id }
  }

  /**
   * Evaluate if a line item matches rule conditions
   */
  private static evaluateRule(
    lineItem: LineItem & { metadata?: any },
    conditions: RuleConditions
  ): boolean {
    // Check category
    if (conditions.category && conditions.category.length > 0) {
      const itemCategory = lineItem.metadata?.category
      if (!itemCategory || !conditions.category.includes(itemCategory)) {
        return false
      }
    }
    
    // Check amount range
    if (conditions.amount) {
      const itemAmount = parseFloat(lineItem.total)
      if (conditions.amount.min !== undefined && itemAmount < conditions.amount.min) {
        return false
      }
      if (conditions.amount.max !== undefined && itemAmount > conditions.amount.max) {
        return false
      }
    }
    
    // Check time range
    if (conditions.time) {
      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      
      if (conditions.time.start && currentTime < conditions.time.start) {
        return false
      }
      if (conditions.time.end && currentTime > conditions.time.end) {
        return false
      }
    }
    
    // Check day of week
    if (conditions.dayOfWeek && conditions.dayOfWeek.length > 0) {
      const currentDay = new Date().getDay()
      if (!conditions.dayOfWeek.includes(currentDay)) {
        return false
      }
    }
    
    // Check metadata
    if (conditions.metadata) {
      for (const [key, value] of Object.entries(conditions.metadata)) {
        if (lineItem.metadata?.[key] !== value) {
          return false
        }
      }
    }
    
    // All conditions passed
    return true
  }

  /**
   * Assign a line item to a billing group with optional override
   */
  static async assignLineItem(
    lineItemId: string,
    billingGroupId: string,
    options?: {
      overriddenBy?: string
      reason?: string
      ruleId?: string
    }
  ): Promise<void> {
    // Get current assignment
    const [lineItem] = await db
      .select()
      .from(lineItems)
      .where(eq(lineItems.id, lineItemId))
      .limit(1)
    
    if (!lineItem) {
      throw new Error('Line item not found')
    }
    
    const originalGroupId = lineItem.billingGroupId
    
    // Update line item
    await db
      .update(lineItems)
      .set({ billingGroupId })
      .where(eq(lineItems.id, lineItemId))
    
    // Record override if this is a manual assignment
    if (options?.overriddenBy && originalGroupId !== billingGroupId) {
      await db.insert(billingGroupOverrides).values({
        lineItemId,
        originalGroupId,
        assignedGroupId: billingGroupId,
        ruleId: options.ruleId,
        reason: options.reason,
        overriddenBy: options.overriddenBy,
      })
    }
    
    // Update billing group balance
    if (originalGroupId) {
      await this.updateBillingGroupBalance(originalGroupId)
    }
    await this.updateBillingGroupBalance(billingGroupId)
    
    logger.info('Assigned line item to billing group', {
      lineItemId,
      billingGroupId,
      originalGroupId,
      overriddenBy: options?.overriddenBy,
    })
  }

  /**
   * Bulk assign line items to billing groups
   */
  static async bulkAssignLineItems(
    assignments: Array<{
      lineItemId: string
      billingGroupId: string
    }>,
    overriddenBy?: string
  ): Promise<void> {
    for (const assignment of assignments) {
      await this.assignLineItem(
        assignment.lineItemId,
        assignment.billingGroupId,
        { overriddenBy }
      )
    }
  }

  /**
   * Get billing summary for a tab
   */
  static async getTabBillingSummary(tabId: string): Promise<{
    groups: Array<{
      billingGroup: BillingGroup
      lineItems: LineItem[]
      total: number
      depositRemaining: number
    }>
    unassignedItems: LineItem[]
    totalAmount: number
  }> {
    // Get all billing groups for the tab
    const groups = await this.getBillingGroups({ 
      tabId, 
      includeLineItems: true 
    })
    
    // Get unassigned line items
    const unassignedItems = await db
      .select()
      .from(lineItems)
      .where(and(
        eq(lineItems.tabId, tabId),
        eq(lineItems.billingGroupId, sql`NULL`)
      ))
    
    // Calculate totals
    const groupSummaries = groups.map(group => {
      const items = group.lineItems || []
      const total = items.reduce((sum, item) => sum + parseFloat(item.total), 0)
      const depositRemaining = parseFloat(group.depositAmount || '0') - parseFloat(group.depositApplied || '0')
      
      return {
        billingGroup: group,
        lineItems: items,
        total,
        depositRemaining,
      }
    })
    
    const totalAmount = groupSummaries.reduce((sum, g) => sum + g.total, 0) +
      unassignedItems.reduce((sum, item) => sum + parseFloat(item.total), 0)
    
    return {
      groups: groupSummaries,
      unassignedItems,
      totalAmount,
    }
  }

  /**
   * Create default billing groups for common scenarios
   */
  static async createDefaultBillingGroups(params: {
    tabId?: string
    invoiceId?: string
    organizationId: string
    customerEmail?: string
    customerName?: string
  }): Promise<BillingGroup[]> {
    const groups: BillingGroup[] = []
    
    // Create a personal billing group for the primary customer
    if (params.customerEmail || params.customerName) {
      const personalGroup = await this.createBillingGroup({
        tabId: params.tabId,
        invoiceId: params.invoiceId,
        name: params.customerName || 'Personal Charges',
        groupType: 'personal',
        payerEmail: params.customerEmail,
        metadata: { isDefault: true },
      })
      groups.push(personalGroup)
    }
    
    return groups
  }

  /**
   * Apply deposit to a billing group
   */
  static async applyDeposit(
    billingGroupId: string,
    amount: number
  ): Promise<void> {
    const group = await this.getBillingGroupById(billingGroupId)
    if (!group) {
      throw new Error('Billing group not found')
    }
    
    const currentApplied = parseFloat(group.depositApplied || '0')
    const maxApplicable = parseFloat(group.depositAmount || '0') - currentApplied
    const amountToApply = Math.min(amount, maxApplicable)
    
    if (amountToApply <= 0) {
      throw new Error('No deposit available to apply')
    }
    
    await db
      .update(billingGroups)
      .set({
        depositApplied: (currentApplied + amountToApply).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(billingGroups.id, billingGroupId))
    
    logger.info('Applied deposit to billing group', {
      billingGroupId,
      amountApplied: amountToApply,
      remainingDeposit: maxApplicable - amountToApply,
    })
  }

  /**
   * Enable billing groups for a tab (progressive enhancement)
   */
  static async enableBillingGroups(
    tabId: string,
    options?: {
      template?: 'hotel' | 'restaurant' | 'corporate' | 'custom'
      defaultGroups?: Array<{ name: string; type: string }>
    }
  ): Promise<BillingGroup[]> {
    const groups: BillingGroup[] = []
    
    if (options?.defaultGroups) {
      // Use custom groups
      for (const groupDef of options.defaultGroups) {
        const group = await this.createBillingGroup({
          tabId,
          name: groupDef.name,
          groupType: groupDef.type,
        })
        groups.push(group)
      }
    } else {
      // Use template-based groups
      switch (options?.template) {
        case 'hotel':
          groups.push(
            await this.createBillingGroup({ tabId, name: 'Room Charges', groupType: 'standard' }),
            await this.createBillingGroup({ tabId, name: 'Restaurant & Bar', groupType: 'standard' }),
            await this.createBillingGroup({ tabId, name: 'Spa & Activities', groupType: 'standard' }),
            await this.createBillingGroup({ tabId, name: 'Incidentals', groupType: 'standard' })
          )
          break
          
        case 'restaurant':
          groups.push(
            await this.createBillingGroup({ tabId, name: 'Food', groupType: 'standard' }),
            await this.createBillingGroup({ tabId, name: 'Beverages', groupType: 'standard' }),
            await this.createBillingGroup({ tabId, name: 'Service & Tips', groupType: 'standard' })
          )
          break
          
        case 'corporate':
          groups.push(
            await this.createBillingGroup({ tabId, name: 'Business Expenses', groupType: 'corporate' }),
            await this.createBillingGroup({ tabId, name: 'Personal Expenses', groupType: 'standard' })
          )
          break
          
        default:
          // Create a single default group
          groups.push(
            await this.createBillingGroup({ tabId, name: 'General', groupType: 'standard' })
          )
      }
    }
    
    logger.info('Enabled billing groups for tab', { tabId, groupsCreated: groups.length })
    return groups
  }

  /**
   * Get tab billing summary
   */
  static async getTabBillingSummary(tabId: string): Promise<{
    groups: Array<{
      billingGroup: BillingGroup
      lineItems: LineItem[]
      total: number
      depositRemaining: number
    }>
    unassignedItems: LineItem[]
    totalAmount: number
  }> {
    // Get all billing groups for the tab
    const tabBillingGroups = await this.getTabBillingGroups(tabId)
    
    // Get all line items for the tab
    const tabLineItems = await db
      .select()
      .from(lineItems)
      .where(eq(lineItems.tabId, tabId))
    
    // Group line items by billing group
    const groupSummaries = tabBillingGroups.map(group => {
      const groupItems = tabLineItems.filter(item => item.billingGroupId === group.id)
      const total = groupItems.reduce((sum, item) => {
        return sum + (parseFloat(item.unitPrice) * item.quantity)
      }, 0)
      
      const depositRemaining = group.depositAmount 
        ? parseFloat(group.depositAmount) - parseFloat(group.depositApplied || '0')
        : 0
      
      return {
        billingGroup: group,
        lineItems: groupItems,
        total,
        depositRemaining,
      }
    })
    
    // Find unassigned items
    const unassignedItems = tabLineItems.filter(item => !item.billingGroupId)
    
    // Calculate total amount
    const totalAmount = tabLineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.unitPrice) * item.quantity)
    }, 0)
    
    return {
      groups: groupSummaries,
      unassignedItems,
      totalAmount,
    }
  }

  /**
   * Assign a single line item to a billing group
   */
  static async assignLineItem(
    lineItemId: string,
    billingGroupId: string,
    options?: {
      overriddenBy?: string
      reason?: string
    }
  ): Promise<void> {
    // Update the line item
    await db
      .update(lineItems)
      .set({
        billingGroupId,
        updatedAt: new Date(),
      })
      .where(eq(lineItems.id, lineItemId))
    
    // Create override record if manual assignment
    if (options?.overriddenBy) {
      await db.insert(billingGroupOverrides).values({
        id: generateId(),
        lineItemId,
        billingGroupId,
        overriddenBy: options.overriddenBy,
        reason: options.reason,
        createdAt: new Date(),
      })
    }
    
    logger.info('Assigned line item to billing group', { lineItemId, billingGroupId })
  }

  /**
   * Bulk assign line items to billing groups
   */
  static async bulkAssignLineItems(
    assignments: Array<{ line_item_id: string; billing_group_id: string }>,
    overriddenBy?: string
  ): Promise<void> {
    // Perform assignments in a transaction
    await db.transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx
          .update(lineItems)
          .set({
            billingGroupId: assignment.billing_group_id,
            updatedAt: new Date(),
          })
          .where(eq(lineItems.id, assignment.line_item_id))
        
        if (overriddenBy) {
          await tx.insert(billingGroupOverrides).values({
            id: generateId(),
            lineItemId: assignment.line_item_id,
            billingGroupId: assignment.billing_group_id,
            overriddenBy,
            createdAt: new Date(),
          })
        }
      }
    })
    
    logger.info('Bulk assigned line items', { count: assignments.length })
  }

  /**
   * Get billing groups for a tab
   */
  static async getTabBillingGroups(tabId: string): Promise<BillingGroup[]> {
    return await db
      .select()
      .from(billingGroups)
      .where(eq(billingGroups.tabId, tabId))
      .orderBy(asc(billingGroups.createdAt))
  }
}