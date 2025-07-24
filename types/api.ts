/**
 * API Types
 * 
 * This file contains TypeScript types for all API requests and responses.
 * These types ensure consistency between frontend and backend API contracts.
 */

// Re-export billing groups API types
export type {
  // Request types
  CreateBillingGroupRequest,
  UpdateBillingGroupRequest,
  EnableBillingGroupsRequest,
  QuickSplitRequest,
  AssignLineItemRequest,
  BulkAssignLineItemsRequest,
  CreateBillingGroupRuleRequest,
  
  // Response types
  EnableBillingGroupsResponse,
  QuickSplitResponse,
  AssignLineItemResponse,
  BulkAssignLineItemsResponse,
  BillingSummary,
  
  // Utility types
  SplitType,
  QuickSplitTemplate,
  RuleAction,
  BillingGroupType,
  BillingGroupStatus
} from './billing-groups'

// ============================================================================
// Common API Types
// ============================================================================

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string
  details?: any
  code?: string
}

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = any> {
  success: true
  data?: T
  message?: string
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    has_next: boolean
    has_previous: boolean
  }
}

/**
 * API response wrapper
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// Tab API Types
// ============================================================================

/**
 * Tab entity from API
 */
export interface Tab {
  id: string
  name?: string
  customer_email: string
  customer_name?: string
  customer_organization_id?: string
  external_reference?: string
  status: 'open' | 'paid' | 'partial' | 'cancelled'
  subtotal: string
  tax_amount: string
  total_amount: string
  paid_amount: string
  created_at: string
  updated_at: string
}

/**
 * Request to create a new tab
 */
export interface CreateTabRequest {
  customer_email: string
  customer_name?: string
  customer_organization_id?: string
  external_reference?: string
}

/**
 * Request to update a tab
 */
export interface UpdateTabRequest {
  customer_name?: string
  customer_organization_id?: string
  external_reference?: string
  status?: 'open' | 'paid' | 'partial' | 'cancelled'
}

// ============================================================================
// Line Items API Types
// ============================================================================

/**
 * Line item entity from API
 */
export interface LineItem {
  id: string
  tab_id: string
  billing_group_id?: string
  description: string
  quantity: number
  unit_price: string
  total: string
  category?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Request to create a line item
 */
export interface CreateLineItemRequest {
  description: string
  quantity: number
  unit_price: number
  category?: string
  billing_group_id?: string
  metadata?: Record<string, any>
}

/**
 * Request to update a line item
 */
export interface UpdateLineItemRequest {
  description?: string
  quantity?: number
  unit_price?: number
  category?: string
  billing_group_id?: string
  metadata?: Record<string, any>
}

// ============================================================================
// Payment API Types
// ============================================================================

/**
 * Payment entity from API
 */
export interface Payment {
  id: string
  tab_id: string
  amount: string
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  processor: string
  processor_payment_id?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Request to create a payment
 */
export interface CreatePaymentRequest {
  amount: number
  billing_group_id?: string
  return_url?: string
  metadata?: Record<string, any>
}

/**
 * Payment intent response
 */
export interface PaymentIntentResponse {
  payment_id: string
  client_secret: string
  amount: number
  status: string
}

// ============================================================================
// Invoice API Types
// ============================================================================

/**
 * Invoice entity from API
 */
export interface Invoice {
  id: string
  tab_id: string
  invoice_number: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  issue_date: string
  due_date?: string
  subtotal: string
  tax_amount: string
  total_amount: string
  paid_amount: string
  balance: string
  payment_terms?: string
  notes?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Request to create an invoice
 */
export interface CreateInvoiceRequest {
  line_item_ids?: string[]
  due_date?: string
  payment_terms?: string
  notes?: string
  send_email?: boolean
  recipient_emails?: string[]
}

// ============================================================================
// Organization API Types
// ============================================================================

/**
 * Organization entity from API
 */
export interface Organization {
  id: string
  name: string
  email?: string
  is_merchant: boolean
  is_corporate: boolean
  billing_email?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

// ============================================================================
// Webhook API Types
// ============================================================================

/**
 * Webhook event from payment processors
 */
export interface WebhookEvent {
  id: string
  type: string
  data: Record<string, any>
  created: number
  livemode: boolean
}

/**
 * Webhook processing result
 */
export interface WebhookProcessResult {
  processed: boolean
  event_type: string
  payment_id?: string
  tab_id?: string
  status?: string
}

// ============================================================================
// Search and Filter Types
// ============================================================================

/**
 * Common query parameters for list endpoints
 */
export interface QueryParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
}

/**
 * Tab-specific query parameters
 */
export interface TabQueryParams extends QueryParams {
  status?: 'open' | 'paid' | 'partial' | 'cancelled'
  customer_email?: string
  date_from?: string
  date_to?: string
  has_billing_groups?: boolean
}

/**
 * Line item query parameters
 */
export interface LineItemQueryParams extends QueryParams {
  tab_id?: string
  billing_group_id?: string
  category?: string
  assigned?: boolean
}

/**
 * Payment query parameters
 */
export interface PaymentQueryParams extends QueryParams {
  tab_id?: string
  status?: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  processor?: string
  date_from?: string
  date_to?: string
}

// ============================================================================
// Analytics API Types
// ============================================================================

/**
 * Dashboard analytics data
 */
export interface DashboardAnalytics {
  total_tabs: number
  total_revenue: string
  pending_payments: string
  tabs_by_status: Record<string, number>
  revenue_by_month: Array<{
    month: string
    revenue: string
  }>
  top_customers: Array<{
    customer_email: string
    total_spent: string
    tab_count: number
  }>
}

/**
 * Billing groups analytics
 */
export interface BillingGroupsAnalytics {
  total_groups: number
  active_groups: number
  groups_by_type: Record<string, number>
  average_items_per_group: number
  most_used_templates: Array<{
    template: string
    usage_count: number
  }>
  automation_effectiveness: {
    total_assignments: number
    automated_assignments: number
    manual_overrides: number
    automation_rate: number
  }
}

// ============================================================================
// File Upload Types
// ============================================================================

/**
 * File upload response
 */
export interface FileUploadResponse {
  file_id: string
  filename: string
  size: number
  mime_type: string
  url: string
}

/**
 * Bulk import response
 */
export interface BulkImportResponse {
  imported_count: number
  failed_count: number
  errors: Array<{
    row: number
    error: string
  }>
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: any): response is ApiErrorResponse {
  return response && typeof response.error === 'string'
}

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: any): response is ApiSuccessResponse<T> {
  return response && response.success === true
}

/**
 * Type guard to check if response is paginated
 */
export function isPaginatedResponse<T>(response: any): response is PaginatedResponse<T> {
  return response && Array.isArray(response.data) && response.pagination
}