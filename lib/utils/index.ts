import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency amounts
export function formatCurrency(
  amount: number | string,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount)
}

// Parse currency string to number
export function parseCurrency(value: string): number {
  // Remove currency symbols and spaces
  let cleaned = value.replace(/[^0-9,.-]+/g, '')
  
  // Check if comma is used as decimal separator (European format)
  // This is true if there's only one comma and it's after any dots
  const commaCount = (cleaned.match(/,/g) || []).length
  const dotCount = (cleaned.match(/\./g) || []).length
  const lastCommaIndex = cleaned.lastIndexOf(',')
  const lastDotIndex = cleaned.lastIndexOf('.')
  
  if (commaCount === 1 && (dotCount === 0 || lastCommaIndex > lastDotIndex)) {
    // European format: comma is decimal separator
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // US format: comma is thousand separator
    cleaned = cleaned.replace(/,/g, '')
  }
  
  return parseFloat(cleaned)
}

// Calculate tab balance
export function calculateTabBalance(
  totalAmount: number | string,
  paidAmount: number | string
): number {
  const total = typeof totalAmount === 'string' ? parseFloat(totalAmount) : totalAmount
  const paid = typeof paidAmount === 'string' ? parseFloat(paidAmount) : paidAmount
  
  return Math.max(0, total - paid)
}

// Determine tab status based on amounts
export function getTabStatus(
  totalAmount: number | string,
  paidAmount: number | string,
  currentStatus?: string
): 'open' | 'partial' | 'paid' | 'void' {
  if (currentStatus === 'void') return 'void'
  
  const total = typeof totalAmount === 'string' ? parseFloat(totalAmount) : totalAmount
  const paid = typeof paidAmount === 'string' ? parseFloat(paidAmount) : paidAmount
  
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'open'
}

// Format date for display
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'relative' = 'short'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (format === 'relative') {
    const now = new Date()
    const diffMs = now.getTime() - dateObj.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }
  
  const options: Intl.DateTimeFormatOptions = 
    format === 'long' 
      ? { dateStyle: 'long', timeStyle: 'short' }
      : { dateStyle: 'short' }
  
  return dateObj.toLocaleString('en-US', options)
}

// Generate a random ID
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 9)
  return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Truncate text
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

// Sleep function for testing/debugging
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Constants
export const TAX_RATE = 0.08 // 8% default tax rate
export const DEFAULT_CURRENCY = 'USD'
export const PAGINATION_DEFAULT_LIMIT = 20
export const PAGINATION_MAX_LIMIT = 100

// Status badge colors
export const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-gray-100 text-gray-800',
  pending: 'bg-orange-100 text-orange-800',
  processing: 'bg-purple-100 text-purple-800',
  succeeded: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-purple-100 text-purple-800',
  overdue: 'bg-red-100 text-red-800',
} as const

// API response types
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiListResponse<T> {
  data: T[]
  meta: PaginationMeta
}