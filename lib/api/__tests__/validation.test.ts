import { z } from 'zod'
import {
  createTabSchema,
  updateTabSchema,
  tabQuerySchema,
  createLineItemSchema,
  createPaymentSchema,
  paginationSchema,
  validateInput,
  formatZodError,
} from '../validation'

describe('Validation Schemas', () => {
  describe('createTabSchema', () => {
    it('should validate a valid tab creation request', () => {
      const validData = {
        customerEmail: 'test@example.com',
        customerName: 'John Doe',
        currency: 'USD',
        lineItems: [
          {
            description: 'Product 1',
            quantity: 2,
            unitPrice: 29.99,
          },
        ],
      }

      const result = createTabSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.customerEmail).toBe('test@example.com')
        expect(result.data.currency).toBe('USD')
        expect(result.data.lineItems).toHaveLength(1)
      }
    })

    it('should reject invalid email', () => {
      const invalidData = {
        customerEmail: 'not-an-email',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 10 }],
      }

      const result = createTabSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require at least one line item', () => {
      const invalidData = {
        customerEmail: 'test@example.com',
        lineItems: [],
      }

      const result = createTabSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least one line item is required')
      }
    })

    it('should validate currency format', () => {
      const invalidData = {
        customerEmail: 'test@example.com',
        currency: 'INVALID',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 10 }],
      }

      const result = createTabSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept optional tax rate', () => {
      const validData = {
        customerEmail: 'test@example.com',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 10 }],
        taxRate: 0.15,
      }

      const result = createTabSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.taxRate).toBe(0.15)
      }
    })

    it('should default currency to USD', () => {
      const validData = {
        customerEmail: 'test@example.com',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 10 }],
      }

      const result = createTabSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe('USD')
      }
    })
  })

  describe('updateTabSchema', () => {
    it('should validate status updates', () => {
      const validData = { status: 'paid' }
      const result = updateTabSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid status', () => {
      const invalidData = { status: 'invalid-status' }
      const result = updateTabSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should allow partial updates', () => {
      const validData = { customerName: 'Updated Name' }
      const result = updateTabSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('paginationSchema', () => {
    it('should provide default values', () => {
      const result = paginationSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(20)
        expect(result.data.sortOrder).toBe('desc')
      }
    })

    it('should coerce string numbers', () => {
      const result = paginationSchema.safeParse({
        page: '2',
        limit: '50',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(2)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should enforce maximum limit', () => {
      const result = paginationSchema.safeParse({
        limit: '200',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createPaymentSchema', () => {
    it('should validate payment creation', () => {
      const validData = {
        tabId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100.50,
        currency: 'USD',
        paymentMethodId: 'pm_test123',
      }

      const result = createPaymentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const invalidData = {
        tabId: 'not-a-uuid',
        amount: 100,
        currency: 'USD',
        paymentMethodId: 'pm_test123',
      }

      const result = createPaymentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject negative amounts', () => {
      const invalidData = {
        tabId: '123e4567-e89b-12d3-a456-426614174000',
        amount: -100,
        currency: 'USD',
        paymentMethodId: 'pm_test123',
      }

      const result = createPaymentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('tabQuerySchema', () => {
    it('should validate query parameters', () => {
      const validQuery = {
        page: '2',
        limit: '50',
        status: 'open',
        customerEmail: 'test@example.com',
      }

      const result = tabQuerySchema.safeParse(validQuery)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(2)
        expect(result.data.status).toBe('open')
      }
    })

    it('should validate date filters', () => {
      const validQuery = {
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
      }

      const result = tabQuerySchema.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should reject invalid dates', () => {
      const invalidQuery = {
        createdAfter: 'not-a-date',
      }

      const result = tabQuerySchema.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })
  })
})

describe('Validation Helpers', () => {
  describe('validateInput', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number().positive(),
    })

    it('should return success for valid data', () => {
      const result = validateInput(testSchema, { name: 'John', age: 25 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', age: 25 })
      }
    })

    it('should return error for invalid data', () => {
      const result = validateInput(testSchema, { name: 'John', age: -5 })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('formatZodError', () => {
    it('should format single error', () => {
      const schema = z.object({ email: z.string().email() })
      const result = schema.safeParse({ email: 'invalid' })
      
      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted).toContain('email:')
        expect(formatted).toContain('Invalid email')
      }
    })

    it('should format multiple errors', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().positive(),
      })
      const result = schema.safeParse({ email: 'invalid', age: -5 })
      
      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted).toContain('email:')
        expect(formatted).toContain('age:')
        expect(formatted).toContain(', ')
      }
    })

    it('should format nested path errors', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      })
      const result = schema.safeParse({ user: { profile: { name: '' } } })
      
      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted).toContain('user.profile.name:')
      }
    })
  })
})