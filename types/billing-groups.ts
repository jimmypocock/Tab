/**
 * Billing Groups Type Definitions
 * 
 * This file contains all TypeScript types related to the billing groups feature.
 * These types ensure type safety across API endpoints, components, and services.
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * Billing group types that determine functionality and behavior
 */
export type BillingGroupType = 'standard' | 'corporate' | 'deposit' | 'credit'

/**
 * Billing group status
 */
export type BillingGroupStatus = 'active' | 'inactive' | 'suspended'

/**
 * Rule actions that can be taken when a rule matches
 */
export type RuleAction = 'auto_assign' | 'require_approval' | 'notify' | 'reject'

/**
 * Quick split templates for common scenarios
 */
export type QuickSplitTemplate = 'hotel' | 'restaurant' | 'corporate' | 'custom'

/**
 * Split types for quick splitting
 */
export type SplitType = 'even' | 'corporate_personal' | 'by_category'

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * Main billing group entity
 */
export interface BillingGroup {
  id: string
  tabId?: string
  invoiceId?: string
  name: string
  groupNumber?: number
  groupType: BillingGroupType
  status: BillingGroupStatus
  
  // Payer information
  payerOrganizationId?: string
  payerEmail?: string
  
  // Financial limits and balances
  creditLimit?: string
  currentBalance: string
  depositAmount?: string
  depositApplied?: string
  
  // Authorization and tracking
  authorizationCode?: string
  poNumber?: string
  
  // Additional data
  metadata?: Record<string, any>
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * Billing group with related data included
 */
export interface BillingGroupWithRelations extends BillingGroup {
  rules?: BillingGroupRule[]
  lineItems?: LineItemWithBillingGroup[]
  payerOrganization?: Organization
  tab?: Tab
  invoice?: Invoice
  overrides?: BillingGroupOverride[]
}

/**
 * Billing group rule for automatic assignment
 */
export interface BillingGroupRule {
  id: string
  billingGroupId: string
  name: string
  priority: number
  conditions: RuleConditions
  action: RuleAction
  isActive: boolean
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

/**
 * Conditions for rule matching
 */
export interface RuleConditions {
  // Item-based conditions
  category?: string[]
  amount?: {
    min?: number
    max?: number
  }
  
  // Time-based conditions
  time?: {
    start?: string // HH:MM format
    end?: string   // HH:MM format
  }
  dayOfWeek?: number[] // 0-6, Sunday=0
  
  // Custom metadata conditions
  metadata?: Record<string, any>
}

/**
 * Override record for manual assignments
 */
export interface BillingGroupOverride {
  id: string
  lineItemId: string
  billingGroupId: string
  previousBillingGroupId?: string
  overriddenBy?: string
  reason?: string
  createdAt: Date
}

/**
 * Line item with billing group information
 */
export interface LineItemWithBillingGroup {
  id: string
  tabId: string
  billingGroupId?: string
  description: string
  quantity: number
  unitPrice: string
  total: string
  category?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  
  // Relations
  billingGroup?: BillingGroup
  tab?: Tab
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to create a new billing group
 */
export interface CreateBillingGroupRequest {
  tabId?: string
  invoiceId?: string
  name: string
  group_type: BillingGroupType
  payer_email?: string
  payer_organization_id?: string
  credit_limit?: number | string
  deposit_amount?: number | string
  authorization_code?: string
  po_number?: string
  notes?: string
  metadata?: Record<string, any>
}

/**
 * Request to update a billing group
 */
export interface UpdateBillingGroupRequest {
  name?: string
  payer_email?: string
  payer_organization_id?: string
  credit_limit?: number | string
  deposit_amount?: number | string
  authorization_code?: string
  po_number?: string
  status?: BillingGroupStatus
  metadata?: Record<string, any>
}

/**
 * Request to enable billing groups for a tab
 */
export interface EnableBillingGroupsRequest {
  template?: QuickSplitTemplate
  default_groups?: Array<{
    name: string
    type: BillingGroupType
  }>
}

/**
 * Response when enabling billing groups
 */
export interface EnableBillingGroupsResponse {
  message: string
  groups: Array<{
    id: string
    name: string
    type: BillingGroupType
    status: BillingGroupStatus
  }>
}

/**
 * Request for quick splitting a tab
 */
export type QuickSplitRequest = 
  | {
      split_type: 'even'
      number_of_groups: number
    }
  | {
      split_type: 'corporate_personal'
      rules: {
        corporate: {
          categories?: string[]
          time_range?: {
            start: string
            end: string
          }
          weekdays_only?: boolean
        }
        personal: {
          categories?: string[]
        }
      }
    }
  | {
      split_type: 'by_category'
    }

/**
 * Response from quick split operation
 */
export interface QuickSplitResponse {
  message: string
  split_type: SplitType
  groups_created: number
  items_assigned: number
  groups: Array<{
    id: string
    name: string
    type: BillingGroupType
    items_count: number
  }>
}

/**
 * Request to assign a line item to a billing group
 */
export interface AssignLineItemRequest {
  billing_group_id: string
  reason?: string
}

/**
 * Request for bulk assignment of line items
 */
export interface BulkAssignLineItemsRequest {
  assignments: Array<{
    line_item_id: string
    billing_group_id: string
  }>
}

/**
 * Response from line item assignment
 */
export interface AssignLineItemResponse {
  message: string
  line_item_id: string
  billing_group_id?: string
}

/**
 * Response from bulk assignment
 */
export interface BulkAssignLineItemsResponse {
  message: string
  assignments_count: number
}

/**
 * Request to create a billing group rule
 */
export interface CreateBillingGroupRuleRequest {
  name: string
  priority?: number
  conditions: {
    category?: string[]
    amount?: {
      min?: number
      max?: number
    }
    time?: {
      start?: string
      end?: string
    }
    day_of_week?: number[]
    metadata?: Record<string, any>
  }
  action?: RuleAction
  metadata?: Record<string, any>
}

/**
 * Billing summary for a tab
 */
export interface BillingSummary {
  tab_id: string
  tab_status: string
  tab_total: number
  billing_summary: {
    groups: Array<{
      billing_group: {
        id: string
        name: string
        type: BillingGroupType
        status: BillingGroupStatus
        payer_email?: string
        payer_organization_id?: string
        credit_limit?: number
        current_balance: number
        deposit_amount?: number
        deposit_applied?: number
      }
      line_items_count: number
      total: number
      deposit_remaining?: number
    }>
    unassigned_items: Array<{
      id: string
      description: string
      quantity: number
      unit_price: number
      total: number
    }>
    unassigned_count: number
    total_amount: number
  }
}

// ============================================================================
// UI Component Props Types
// ============================================================================

/**
 * Props for BillingGroupsManager component
 */
export interface BillingGroupsManagerProps {
  tab: Tab
  billingGroups: BillingGroup[]
  lineItems: LineItemWithBillingGroup[]
  onUpdate: () => void
}

/**
 * Props for BillingGroupCard component
 */
export interface BillingGroupCardProps {
  group: BillingGroup & {
    rules_count?: number
  }
  lineItems: LineItemWithBillingGroup[]
  isSelected?: boolean
  onClick?: () => void
  onUpdate: () => void
}

/**
 * Props for LineItemAssignment component
 */
export interface LineItemAssignmentProps {
  lineItems: LineItemWithBillingGroup[]
  billingGroups: BillingGroup[]
  selectedGroupId: string | null
  onItemsAssigned: () => void
}

/**
 * Props for CreateBillingGroupDialog component
 */
export interface CreateBillingGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabId: string
  onCreated: () => void
}

/**
 * Props for BillingSummary component
 */
export interface BillingSummaryProps {
  groups: Array<{
    billing_group: BillingGroup
    line_items_count: number
    total: number
    deposit_remaining?: number
  }>
  unassignedItems: Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  totalAmount: number
  paymentMode?: 'full' | 'group'
  selectedGroupId?: string
}

/**
 * Props for QuickSplit component
 */
export interface QuickSplitProps {
  tabId: string
  onComplete: () => void
}

// ============================================================================
// Service Layer Types
// ============================================================================

/**
 * Options for creating billing groups
 */
export interface CreateBillingGroupOptions {
  tabId?: string
  invoiceId?: string
  name: string
  groupType: BillingGroupType
  payerOrganizationId?: string
  payerEmail?: string
  creditLimit?: string
  depositAmount?: string
  authorizationCode?: string
  poNumber?: string
  metadata?: Record<string, any>
}

/**
 * Options for getting billing group by ID
 */
export interface GetBillingGroupOptions {
  includeRules?: boolean
  includeLineItems?: boolean
  includePayerOrganization?: boolean
}

/**
 * Options for enabling billing groups
 */
export interface EnableBillingGroupsOptions {
  template?: QuickSplitTemplate
  defaultGroups?: Array<{
    name: string
    type: BillingGroupType
  }>
}

/**
 * Options for line item assignment
 */
export interface AssignLineItemOptions {
  overriddenBy?: string
  reason?: string
}

/**
 * Billing group summary data
 */
export interface BillingGroupSummary {
  groups: Array<{
    billingGroup: BillingGroup
    lineItems: LineItemWithBillingGroup[]
    total: number
    depositRemaining: number
  }>
  unassignedItems: LineItemWithBillingGroup[]
  totalAmount: number
}

// ============================================================================
// Drag and Drop Types
// ============================================================================

/**
 * Data structure for drag and drop operations
 */
export interface DragItem {
  lineItemId: string
  sourceBillingGroupId: string | null
}

/**
 * Drop result for drag and drop operations
 */
export interface DropResult {
  sourceGroupId: string | null
  targetGroupId: string | null
  lineItemIds: string[]
}

// ============================================================================
// Audit and Analytics Types
// ============================================================================

/**
 * Billing group activity log entry
 */
export interface BillingGroupActivity {
  id: string
  billingGroupId: string
  action: 'created' | 'updated' | 'deleted' | 'item_assigned' | 'item_unassigned' | 'rule_applied'
  details: Record<string, any>
  performedBy?: string
  createdAt: Date
}

/**
 * Billing group analytics data
 */
export interface BillingGroupAnalytics {
  totalGroups: number
  activeGroups: number
  totalAssignments: number
  rulesApplied: number
  manualOverrides: number
  averageGroupSize: number
  mostUsedGroupType: BillingGroupType
  groupsByType: Record<BillingGroupType, number>
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Billing group specific error codes
 */
export type BillingGroupErrorCode = 
  | 'BILLING_GROUP_NOT_FOUND'
  | 'BILLING_GROUP_ALREADY_EXISTS'
  | 'INSUFFICIENT_CREDIT_LIMIT'
  | 'INSUFFICIENT_DEPOSIT'
  | 'INVALID_RULE_CONDITIONS'
  | 'RULE_EVALUATION_FAILED'
  | 'ASSIGNMENT_FAILED'

/**
 * Billing group error with additional context
 */
export interface BillingGroupError extends Error {
  code: BillingGroupErrorCode
  context?: Record<string, any>
}

// ============================================================================
// External Type References (assumed to exist)
// ============================================================================

/**
 * References to types from other parts of the application
 * These would typically be imported from their respective modules
 */
interface Tab {
  id: string
  name?: string
  // ... other tab properties
}

interface Invoice {
  id: string
  // ... other invoice properties
}

interface Organization {
  id: string
  name: string
  // ... other organization properties
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial type for updating billing groups
 */
export type PartialBillingGroup = Partial<Omit<BillingGroup, 'id' | 'createdAt' | 'updatedAt'>>

/**
 * Type for billing group with computed fields
 */
export type BillingGroupWithComputed = BillingGroup & {
  depositRemaining: number
  creditUsagePercentage: number
  itemCount: number
  totalAmount: number
}

/**
 * Type guard for billing group types
 */
export function isBillingGroupType(value: string): value is BillingGroupType {
  return ['standard', 'corporate', 'deposit', 'credit'].includes(value)
}

/**
 * Type guard for rule actions
 */
export function isRuleAction(value: string): value is RuleAction {
  return ['auto_assign', 'require_approval', 'notify', 'reject'].includes(value)
}