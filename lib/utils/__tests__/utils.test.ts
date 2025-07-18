import {
  cn,
  formatCurrency,
  parseCurrency,
  calculateTabBalance,
  getTabStatus,
  formatDate,
  generateId,
  isValidEmail,
  truncate,
  sleep,
  TAX_RATE,
  DEFAULT_CURRENCY,
  STATUS_COLORS,
} from '../index'

describe('Utility Functions', () => {
  describe('cn (classnames)', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })
  })

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00')
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })

    it('should handle string inputs', () => {
      expect(formatCurrency('100.50')).toBe('$100.50')
    })

    it('should format other currencies', () => {
      expect(formatCurrency(100, 'EUR', 'en-US')).toContain('100')
      expect(formatCurrency(100, 'GBP', 'en-US')).toContain('100')
    })
  })

  describe('parseCurrency', () => {
    it('should parse currency strings', () => {
      expect(parseCurrency('$100.50')).toBe(100.50)
      expect(parseCurrency('1,234.56')).toBe(1234.56)
      expect(parseCurrency('€100,50')).toBe(100.50)
    })

    it('should handle negative values', () => {
      expect(parseCurrency('-$100.50')).toBe(-100.50)
    })
  })

  describe('calculateTabBalance', () => {
    it('should calculate balance correctly', () => {
      expect(calculateTabBalance(100, 30)).toBe(70)
      expect(calculateTabBalance('100.00', '30.00')).toBe(70)
    })

    it('should not return negative balance', () => {
      expect(calculateTabBalance(100, 150)).toBe(0)
    })
  })

  describe('getTabStatus', () => {
    it('should return correct status based on amounts', () => {
      expect(getTabStatus(100, 0)).toBe('open')
      expect(getTabStatus(100, 50)).toBe('partial')
      expect(getTabStatus(100, 100)).toBe('paid')
      expect(getTabStatus(100, 150)).toBe('paid')
    })

    it('should preserve void status', () => {
      expect(getTabStatus(100, 0, 'void')).toBe('void')
      expect(getTabStatus(100, 100, 'void')).toBe('void')
    })

    it('should handle string amounts', () => {
      expect(getTabStatus('100.00', '50.00')).toBe('partial')
    })
  })

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T10:30:00Z')

    it('should format date in short format', () => {
      const formatted = formatDate(testDate, 'short')
      expect(formatted).toMatch(/1\/15\/24/)
    })

    it('should format date in long format', () => {
      const formatted = formatDate(testDate, 'long')
      expect(formatted).toContain('January')
      expect(formatted).toContain('2024')
    })

    it('should format relative dates', () => {
      const now = new Date()
      expect(formatDate(now, 'relative')).toBe('Today')
      
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      expect(formatDate(yesterday, 'relative')).toBe('Yesterday')
      
      const lastWeek = new Date(now)
      lastWeek.setDate(lastWeek.getDate() - 5)
      expect(formatDate(lastWeek, 'relative')).toBe('5 days ago')
    })

    it('should handle string dates', () => {
      const formatted = formatDate('2024-01-15T10:30:00Z', 'short')
      expect(formatted).toMatch(/1\/15\/24/)
    })
  })

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it('should include prefix when provided', () => {
      const id = generateId('test')
      expect(id).toMatch(/^test_/)
    })

    it('should generate IDs of reasonable length', () => {
      const id = generateId()
      expect(id.length).toBeGreaterThan(10)
      expect(id.length).toBeLessThan(30)
    })
  })

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.com')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('test@.com')).toBe(false)
      expect(isValidEmail('test @example.com')).toBe(false)
    })
  })

  describe('truncate', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated'
      expect(truncate(longText, 20)).toBe('This is a very long ...')
    })

    it('should not truncate short text', () => {
      const shortText = 'Short text'
      expect(truncate(shortText, 20)).toBe('Short text')
    })

    it('should use default length', () => {
      const text = 'a'.repeat(60)
      const truncated = truncate(text)
      expect(truncated).toHaveLength(53) // 50 + '...'
    })
  })

  describe('sleep', () => {
    it('should pause execution', async () => {
      const start = Date.now()
      await sleep(50)
      const end = Date.now()
      expect(end - start).toBeGreaterThanOrEqual(45) // Allow some margin
    })
  })

  describe('Constants', () => {
    it('should have correct default values', () => {
      expect(TAX_RATE).toBe(0.08)
      expect(DEFAULT_CURRENCY).toBe('USD')
    })

    it('should have status colors defined', () => {
      expect(STATUS_COLORS.open).toContain('blue')
      expect(STATUS_COLORS.paid).toContain('green')
      expect(STATUS_COLORS.failed).toContain('red')
    })
  })
})