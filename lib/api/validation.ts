import { z } from 'zod'
import { isValidEmail } from '@/lib/utils'

// Custom validators
const emailSchema = z.string().refine(isValidEmail, {
  message: 'Invalid email address',
})

const currencySchema = z.string().regex(/^[A-Z]{3}$/, {
  message: 'Currency must be a 3-letter ISO code',
}).default('USD')

const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format',
})

const positiveNumberSchema = z.number().positive({
  message: 'Must be a positive number',
})

const metadataSchema = z.record(z.string(), z.unknown()).optional().nullable()

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Tab schemas
export const createTabSchema = z.object({
  customerEmail: emailSchema,
  customerName: z.string().min(1).max(255).optional(),
  externalReference: z.string().max(255).optional(),
  currency: currencySchema,
  lineItems: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().int().positive().default(1),
    unitPrice: positiveNumberSchema,
    metadata: metadataSchema,
  })).min(1, 'At least one line item is required').max(100),
  metadata: metadataSchema,
  taxRate: z.number().min(0).max(1).optional(), // 0-100% as decimal
})

export const updateTabSchema = z.object({
  status: z.enum(['open', 'partial', 'paid', 'void']).optional(),
  customerName: z.string().min(1).max(255).optional(),
  externalReference: z.string().max(255).optional(),
  metadata: metadataSchema,
})

export const tabQuerySchema = paginationSchema.extend({
  status: z.enum(['open', 'partial', 'paid', 'void']).optional(),
  customerEmail: emailSchema.optional(),
  externalReference: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
})

// Line item schemas
export const createLineItemSchema = z.object({
  tabId: uuidSchema,
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitPrice: positiveNumberSchema,
  metadata: metadataSchema,
})

export const updateLineItemSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: positiveNumberSchema.optional(),
  metadata: metadataSchema,
})

// Payment schemas
export const createPaymentSchema = z.object({
  tabId: uuidSchema,
  amount: positiveNumberSchema,
  currency: currencySchema.optional(),
  paymentMethodId: z.string().min(1).optional(), // Payment method ID (processor-specific)
  processorType: z.enum(['stripe', 'square', 'paypal', 'authorize_net']).optional(),
  metadata: metadataSchema,
  returnUrl: z.string().url().optional(), // For 3D Secure or redirects
})

export const createPaymentIntentSchema = z.object({
  tabId: uuidSchema,
  amount: positiveNumberSchema,
  currency: currencySchema,
  metadata: metadataSchema,
})

export const paymentQuerySchema = paginationSchema.extend({
  tabId: uuidSchema.optional(),
  status: z.enum(['pending', 'processing', 'succeeded', 'failed']).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
})

// Invoice schemas
export const createInvoiceSchema = z.object({
  tabId: uuidSchema,
  dueDate: z.string().datetime(),
  sendImmediately: z.boolean().default(false),
  message: z.string().max(1000).optional(),
  metadata: metadataSchema,
})

export const updateInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'overdue']).optional(),
  dueDate: z.string().datetime().optional(),
  message: z.string().max(1000).optional(),
  metadata: metadataSchema,
})

// Webhook schemas
export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
})

// API response types
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
})

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.string(), z.unknown()).optional(),
  })

// Type exports
export type CreateTabInput = z.infer<typeof createTabSchema>
export type UpdateTabInput = z.infer<typeof updateTabSchema>
export type TabQuery = z.infer<typeof tabQuerySchema>
export type CreateLineItemInput = z.infer<typeof createLineItemSchema>
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>
export type PaymentQuery = z.infer<typeof paymentQuerySchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
export type PaginationParams = z.infer<typeof paginationSchema>

// Validation helpers
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, error: result.error }
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join(', ')
}