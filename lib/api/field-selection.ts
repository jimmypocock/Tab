import { logger } from '@/lib/logger'

/**
 * Parse field selection parameter from query string
 * Supports comma-separated fields and nested field selection
 * 
 * Examples:
 * - fields=id,status,totalAmount
 * - fields=id,customer.email,lineItems.description
 */
export function parseFieldSelection(fieldsParam: string | null): Set<string> | null {
  if (!fieldsParam) {
    return null
  }

  try {
    const fields = fieldsParam
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0)

    if (fields.length === 0) {
      return null
    }

    return new Set(fields)
  } catch (error) {
    logger.warn('Invalid fields parameter', { fieldsParam })
    return null
  }
}

/**
 * Apply field selection to an object or array of objects
 * Supports nested field selection using dot notation
 */
export function applyFieldSelection<T extends Record<string, any>>(
  data: T | T[],
  fields: Set<string> | null
): T | T[] {
  if (!fields || fields.size === 0) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => applyFieldSelection(item, fields) as T)
  }

  const result: any = {}

  // Always include ID field for consistency
  if ('id' in data) {
    result.id = data.id
  }

  // Group nested fields by parent
  const nestedFields = new Map<string, Set<string>>()
  const directFields = new Set<string>()

  for (const field of Array.from(fields)) {
    if (field.includes('.')) {
      const [parent, ...rest] = field.split('.')
      const childField = rest.join('.')
      
      if (!nestedFields.has(parent)) {
        nestedFields.set(parent, new Set())
      }
      nestedFields.get(parent)!.add(childField)
    } else {
      directFields.add(field)
    }
  }

  // Process direct fields
  for (const field of Array.from(directFields)) {
    if (field in data) {
      result[field] = data[field]
    }
  }

  // Process nested fields
  for (const [parent, childFields] of Array.from(nestedFields)) {
    if (parent in data && data[parent] !== null && data[parent] !== undefined) {
      if (Array.isArray(data[parent])) {
        result[parent] = data[parent].map((item: any) => 
          applyFieldSelection(item, childFields)
        )
      } else if (typeof data[parent] === 'object') {
        result[parent] = applyFieldSelection(data[parent], childFields)
      }
    }
  }

  return result as T
}

/**
 * Get default fields for different resource types
 */
export const DefaultFields = {
  tab: new Set([
    'id',
    'customerEmail',
    'customerName',
    'totalAmount',
    'paidAmount',
    'status',
    'currency',
    'createdAt',
  ]),
  
  tabWithItems: new Set([
    'id',
    'customerEmail',
    'customerName',
    'subtotal',
    'taxAmount',
    'totalAmount',
    'paidAmount',
    'status',
    'currency',
    'lineItems.id',
    'lineItems.description',
    'lineItems.quantity',
    'lineItems.unitAmount',
    'lineItems.amount',
    'createdAt',
  ]),
  
  payment: new Set([
    'id',
    'tabId',
    'amount',
    'status',
    'paymentMethod',
    'createdAt',
  ]),
  
  invoice: new Set([
    'id',
    'tabId',
    'invoiceNumber',
    'status',
    'dueDate',
    'sentAt',
    'createdAt',
  ]),
} as const

/**
 * Validate that requested fields are allowed
 */
export function validateFieldSelection(
  fields: Set<string>,
  allowedFields: Set<string>
): { valid: boolean; invalidFields?: string[] } {
  const invalidFields: string[] = []

  for (const field of Array.from(fields)) {
    // Extract base field for nested selections
    const baseField = field.split('.')[0]
    
    let isAllowed = false
    for (const allowed of Array.from(allowedFields)) {
      const allowedBase = allowed.split('.')[0]
      if (baseField === allowedBase) {
        isAllowed = true
        break
      }
    }

    if (!isAllowed && field !== 'id') { // Always allow id field
      invalidFields.push(field)
    }
  }

  return {
    valid: invalidFields.length === 0,
    invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
  }
}

/**
 * Merge default fields with requested fields
 */
export function mergeFieldSelection(
  requestedFields: Set<string> | null,
  defaultFields: Set<string>
): Set<string> {
  if (!requestedFields) {
    return defaultFields
  }

  // If user explicitly requested fields, use only those (plus id)
  const merged = new Set(requestedFields)
  merged.add('id') // Always include id
  
  return merged
}