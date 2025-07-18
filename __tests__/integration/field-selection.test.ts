import { parseFieldSelection, applyFieldSelection, DefaultFields, validateFieldSelection } from '@/lib/api/field-selection'

describe('Field Selection', () => {
  describe('parseFieldSelection', () => {
    it('should parse comma-separated fields', () => {
      const result = parseFieldSelection('id,status,totalAmount')
      expect(result).toEqual(new Set(['id', 'status', 'totalAmount']))
    })

    it('should parse nested fields', () => {
      const result = parseFieldSelection('id,lineItems.description,lineItems.quantity')
      expect(result).toEqual(new Set(['id', 'lineItems.description', 'lineItems.quantity']))
    })

    it('should return null for empty/invalid input', () => {
      expect(parseFieldSelection(null)).toBeNull()
      expect(parseFieldSelection('')).toBeNull()
      expect(parseFieldSelection('  ')).toBeNull()
    })

    it('should trim whitespace', () => {
      const result = parseFieldSelection(' id , status , totalAmount ')
      expect(result).toEqual(new Set(['id', 'status', 'totalAmount']))
    })
  })

  describe('applyFieldSelection', () => {
    const testData = {
      id: 'tab_123',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      totalAmount: '100.00',
      paidAmount: '0.00',
      status: 'open',
      currency: 'USD',
      lineItems: [
        {
          id: 'li_1',
          description: 'Item 1',
          quantity: 2,
          unitAmount: '25.00',
          amount: '50.00',
        },
        {
          id: 'li_2',
          description: 'Item 2',
          quantity: 1,
          unitAmount: '50.00',
          amount: '50.00',
        },
      ],
      createdAt: '2023-01-01T00:00:00Z',
      metadata: { key: 'value' },
    }

    it('should return all data when no fields specified', () => {
      const result = applyFieldSelection(testData, null)
      expect(result).toEqual(testData)
    })

    it('should return only specified fields', () => {
      const fields = new Set(['id', 'status', 'totalAmount'])
      const result = applyFieldSelection(testData, fields)
      
      expect(result).toEqual({
        id: 'tab_123',
        status: 'open',
        totalAmount: '100.00',
      })
    })

    it('should handle nested field selection', () => {
      const fields = new Set(['id', 'lineItems.description', 'lineItems.quantity'])
      const result = applyFieldSelection(testData, fields)
      
      expect(result).toEqual({
        id: 'tab_123',
        lineItems: [
          {
            id: 'li_1',
            description: 'Item 1',
            quantity: 2,
          },
          {
            id: 'li_2',
            description: 'Item 2',
            quantity: 1,
          },
        ],
      })
    })

    it('should handle array of objects', () => {
      const testArray = [testData, { ...testData, id: 'tab_456' }]
      const fields = new Set(['id', 'status'])
      const result = applyFieldSelection(testArray, fields)
      
      expect(result).toEqual([
        { id: 'tab_123', status: 'open' },
        { id: 'tab_456', status: 'open' },
      ])
    })

    it('should include id field even when not requested', () => {
      const fields = new Set(['status'])
      const result = applyFieldSelection(testData, fields)
      
      expect(result).toEqual({
        id: 'tab_123',
        status: 'open',
      })
    })

    it('should ignore non-existent fields', () => {
      const fields = new Set(['id', 'nonexistent', 'status'])
      const result = applyFieldSelection(testData, fields)
      
      expect(result).toEqual({
        id: 'tab_123',
        status: 'open',
      })
    })
  })

  describe('validateFieldSelection', () => {
    const allowedFields = new Set([
      'id',
      'status',
      'totalAmount',
      'lineItems.description',
      'lineItems.quantity',
    ])

    it('should validate allowed fields', () => {
      const fields = new Set(['id', 'status', 'totalAmount'])
      const result = validateFieldSelection(fields, allowedFields)
      
      expect(result.valid).toBe(true)
      expect(result.invalidFields).toBeUndefined()
    })

    it('should validate nested fields', () => {
      const fields = new Set(['id', 'lineItems.description'])
      const result = validateFieldSelection(fields, allowedFields)
      
      expect(result.valid).toBe(true)
      expect(result.invalidFields).toBeUndefined()
    })

    it('should reject invalid fields', () => {
      const fields = new Set(['id', 'invalidField', 'status'])
      const result = validateFieldSelection(fields, allowedFields)
      
      expect(result.valid).toBe(false)
      expect(result.invalidFields).toEqual(['invalidField'])
    })

    it('should always allow id field', () => {
      const fields = new Set(['id'])
      const result = validateFieldSelection(fields, new Set(['status']))
      
      expect(result.valid).toBe(true)
    })
  })

  describe('DefaultFields', () => {
    it('should have default fields for tab', () => {
      expect(DefaultFields.tab.has('id')).toBe(true)
      expect(DefaultFields.tab.has('status')).toBe(true)
      expect(DefaultFields.tab.has('totalAmount')).toBe(true)
    })

    it('should have default fields for tabWithItems', () => {
      expect(DefaultFields.tabWithItems.has('id')).toBe(true)
      expect(DefaultFields.tabWithItems.has('lineItems.description')).toBe(true)
      expect(DefaultFields.tabWithItems.has('lineItems.quantity')).toBe(true)
    })
  })
})

describe('Field Selection Integration', () => {
  it('should work with realistic API scenario', () => {
    // Simulate API request with fields parameter
    const fieldsParam = 'id,status,totalAmount,lineItems.description'
    const requestedFields = parseFieldSelection(fieldsParam)
    
    // Validate against allowed fields
    const validation = validateFieldSelection(requestedFields!, DefaultFields.tabWithItems)
    expect(validation.valid).toBe(true)
    
    // Apply to realistic data
    const tabData = {
      id: 'tab_123',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      totalAmount: '100.00',
      paidAmount: '0.00',
      status: 'open',
      currency: 'USD',
      lineItems: [
        {
          id: 'li_1',
          description: 'Consulting Services',
          quantity: 5,
          unitAmount: '20.00',
          amount: '100.00',
        },
      ],
      createdAt: '2023-01-01T00:00:00Z',
      metadata: { projectId: 'proj_123' },
    }
    
    const result = applyFieldSelection(tabData, requestedFields)
    
    expect(result).toEqual({
      id: 'tab_123',
      status: 'open',
      totalAmount: '100.00',
      lineItems: [
        {
          id: 'li_1',
          description: 'Consulting Services',
        },
      ],
    })
  })
})