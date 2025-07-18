import { pgTable, uuid, text, timestamp, decimal, integer, boolean, json } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  businessName: text('business_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const merchantsRelations = relations(merchants, ({ many }) => ({
  apiKeys: many(apiKeys),
  tabs: many(tabs),
}))

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(), // First 8 chars of key for identification
  name: text('name'),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  merchant: one(merchants, {
    fields: [apiKeys.merchantId],
    references: [merchants.id],
  }),
}))

export const tabs = pgTable('tabs', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name'),
  externalReference: text('external_reference'),
  status: text('status').notNull().default('open'), // open, partial, paid, void
  currency: text('currency').notNull().default('USD'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const tabsRelations = relations(tabs, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [tabs.merchantId],
    references: [merchants.id],
  }),
  lineItems: many(lineItems),
  payments: many(payments),
  invoices: many(invoices),
}))

export const lineItems = pgTable('line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tabId: uuid('tab_id').notNull().references(() => tabs.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  tab: one(tabs, {
    fields: [lineItems.tabId],
    references: [tabs.id],
  }),
}))

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tabId: uuid('tab_id').notNull().references(() => tabs.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(), // pending, processing, succeeded, failed
  processor: text('processor').notNull().default('stripe'),
  processorPaymentId: text('processor_payment_id'),
  failureReason: text('failure_reason'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const paymentsRelations = relations(payments, ({ one }) => ({
  tab: one(tabs, {
    fields: [payments.tabId],
    references: [tabs.id],
  }),
}))

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tabId: uuid('tab_id').notNull().references(() => tabs.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  status: text('status').notNull().default('draft'), // draft, sent, viewed, paid, overdue
  amountDue: decimal('amount_due', { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  sentAt: timestamp('sent_at'),
  viewedAt: timestamp('viewed_at'),
  paidAt: timestamp('paid_at'),
  publicUrl: text('public_url'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const invoicesRelations = relations(invoices, ({ one }) => ({
  tab: one(tabs, {
    fields: [invoices.tabId],
    references: [tabs.id],
  }),
}))

// Type exports
export type Merchant = typeof merchants.$inferSelect
export type NewMerchant = typeof merchants.$inferInsert
export type Tab = typeof tabs.$inferSelect
export type NewTab = typeof tabs.$inferInsert
export type LineItem = typeof lineItems.$inferSelect
export type NewLineItem = typeof lineItems.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
