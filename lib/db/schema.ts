import { pgTable, uuid, text, timestamp, date, decimal, integer, boolean, json, pgEnum, jsonb, index, uniqueIndex, inet } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// Enums
export const processorTypeEnum = pgEnum('processor_type', ['stripe', 'square', 'paypal', 'authorize_net'])
export const organizationTypeEnum = pgEnum('organization_type', ['business', 'individual', 'platform'])
export const organizationRoleEnum = pgEnum('organization_role', ['owner', 'admin', 'member', 'viewer'])
export const merchantRoleEnum = pgEnum('merchant_role', ['owner', 'admin', 'member', 'viewer']) // Legacy enum for migration
export const memberStatusEnum = pgEnum('member_status', ['active', 'suspended', 'pending_invitation'])
export const relationshipStatusEnum = pgEnum('relationship_status', ['active', 'suspended', 'closed'])

// Users table (separate from auth.users for app data)
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // References auth.users(id)
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').default('UTC'),
  preferences: jsonb('preferences').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  merchantUsers: many(merchantUsers),
  organizationUsers: many(organizationUsers),
  userSessions: many(userSessions),
  createdMerchants: many(merchants, { relationName: 'createdMerchants' }),
  createdOrganizations: many(organizations, { relationName: 'createdOrganizations' }),
  invitedUsers: many(merchantUsers, { relationName: 'invitedUsers' }),
  invitedOrgUsers: many(organizationUsers, { relationName: 'invitedOrgUsers' }),
}))

// Many-to-many relationship between users and merchants
export const merchantUsers = pgTable('merchant_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: merchantRoleEnum('role').notNull().default('member'),
  permissions: jsonb('permissions').default('{}'),
  invitedBy: uuid('invited_by').references(() => users.id),
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at').defaultNow(),
  status: memberStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueMerchantUser: uniqueIndex('unique_merchant_user').on(table.merchantId, table.userId),
}))

export const merchantUsersRelations = relations(merchantUsers, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantUsers.merchantId],
    references: [merchants.id],
  }),
  user: one(users, {
    fields: [merchantUsers.userId], 
    references: [users.id],
  }),
  invitedByUser: one(users, {
    fields: [merchantUsers.invitedBy],
    references: [users.id],
    relationName: 'invitedUsers',
  }),
}))

// User sessions for context tracking
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currentMerchantId: uuid('current_merchant_id').references(() => merchants.id), // Legacy
  currentOrganizationId: uuid('current_organization_id').references(() => organizations.id),
  currentContext: text('current_context').default('merchant'), // 'merchant' or 'corporate'
  sessionData: jsonb('session_data').default('{}'),
  expiresAt: timestamp('expires_at').default(sql`(NOW() + INTERVAL '30 days')`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
  currentMerchant: one(merchants, {
    fields: [userSessions.currentMerchantId],
    references: [merchants.id],
  }),
  currentOrganization: one(organizations, {
    fields: [userSessions.currentOrganizationId],
    references: [organizations.id],
  }),
}))

export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(), // Will be deprecated/removed
  businessName: text('business_name').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  slug: text('slug').unique(),
  settings: jsonb('settings').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const merchantsRelations = relations(merchants, ({ many, one }) => ({
  apiKeys: many(apiKeys),
  tabs: many(tabs),
  processors: many(merchantProcessors),
  merchantUsers: many(merchantUsers),
  userSessions: many(userSessions),
  creator: one(users, {
    fields: [merchants.createdBy],
    references: [users.id],
    relationName: 'createdMerchants',
  }),
}))

// Organizations table (unified merchants and corporate accounts)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  type: organizationTypeEnum('type').notNull().default('business'),
  
  // Capabilities
  isMerchant: boolean('is_merchant').default(false).notNull(),
  isCorporate: boolean('is_corporate').default(false).notNull(),
  
  // Details
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  website: text('website'),
  logoUrl: text('logo_url'),
  
  // Contact
  primaryEmail: text('primary_email'),
  billingEmail: text('billing_email'),
  supportEmail: text('support_email'),
  
  // Address and settings
  address: jsonb('address').default('{}'),
  settings: jsonb('settings').default('{}'),
  metadata: jsonb('metadata').default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
})

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  organizationUsers: many(organizationUsers),
  apiKeys: many(apiKeys),
  tabs: many(tabs),
  invoices: many(invoices),
  processors: many(merchantProcessors),
  // Relationships where this org is the merchant
  merchantRelationships: many(organizationRelationships, { relationName: 'merchantOrg' }),
  // Relationships where this org is the corporate customer
  corporateRelationships: many(organizationRelationships, { relationName: 'corporateOrg' }),
  creator: one(users, {
    fields: [organizations.createdBy],
    references: [users.id],
  }),
}))

// Organization users (many-to-many between users and organizations)
export const organizationUsers = pgTable('organization_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: organizationRoleEnum('role').notNull().default('member'),
  
  // Context-specific permissions
  merchantPermissions: jsonb('merchant_permissions').default('{}'),
  corporatePermissions: jsonb('corporate_permissions').default('{}'),
  
  // Metadata
  department: text('department'),
  title: text('title'),
  invitedBy: uuid('invited_by').references(() => users.id),
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at').defaultNow(),
  status: memberStatusEnum('status').notNull().default('active'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueOrgUser: uniqueIndex('unique_org_user').on(table.organizationId, table.userId),
}))

export const organizationUsersRelations = relations(organizationUsers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationUsers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationUsers.userId],
    references: [users.id],
  }),
  invitedByUser: one(users, {
    fields: [organizationUsers.invitedBy],
    references: [users.id],
  }),
}))

// Organization relationships (B2B credit accounts)
export const organizationRelationships = pgTable('organization_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // The merchant org providing credit
  merchantOrgId: uuid('merchant_org_id').notNull().references(() => organizations.id),
  // The corporate org receiving credit
  corporateOrgId: uuid('corporate_org_id').notNull().references(() => organizations.id),
  
  // Relationship details
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }),
  currentBalance: decimal('current_balance', { precision: 12, scale: 2 }).default('0'),
  paymentTerms: text('payment_terms').default('NET30'),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  
  // Status
  status: relationshipStatusEnum('status').default('active'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  
  // Auto-pay
  autoPayEnabled: boolean('auto_pay_enabled').default(false),
  autoPayMethodId: uuid('auto_pay_method_id'),
  
  customTerms: jsonb('custom_terms').default('{}'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueRelationship: uniqueIndex('unique_org_relationship').on(table.merchantOrgId, table.corporateOrgId),
}))

export const organizationRelationshipsRelations = relations(organizationRelationships, ({ one }) => ({
  merchantOrg: one(organizations, {
    fields: [organizationRelationships.merchantOrgId],
    references: [organizations.id],
    relationName: 'merchantOrg',
  }),
  corporateOrg: one(organizations, {
    fields: [organizationRelationships.corporateOrgId],
    references: [organizations.id],
    relationName: 'corporateOrg',
  }),
  approvedByUser: one(users, {
    fields: [organizationRelationships.approvedBy],
    references: [users.id],
  }),
}))

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').references(() => merchants.id), // Legacy, will be removed
  organizationId: uuid('organization_id').references(() => organizations.id),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(), // First 8 chars of key for identification
  name: text('name'),
  scope: text('scope').default('merchant'), // merchant, corporate, full
  permissions: jsonb('permissions').default('{}'),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
})

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  merchant: one(merchants, {
    fields: [apiKeys.merchantId],
    references: [merchants.id],
  }),
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
}))

export const tabs = pgTable('tabs', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id), // Legacy, will be removed
  organizationId: uuid('organization_id').references(() => organizations.id),
  
  // Customer targeting - flexible for individuals or organizations
  customerEmail: text('customer_email'), // Required for individuals, optional override for orgs
  customerName: text('customer_name'),
  customerOrganizationId: uuid('customer_organization_id').references(() => organizations.id), // When targeting an organization
  
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
  // Corporate/Organization payment fields
  corporateAccountId: uuid('corporate_account_id').references(() => corporateAccounts.id), // Legacy
  paidByOrgId: uuid('paid_by_org_id').references(() => organizations.id),
  corporateRelationshipId: uuid('corporate_relationship_id').references(() => corporateMerchantRelationships.id), // Legacy
  relationshipId: uuid('relationship_id').references(() => organizationRelationships.id),
  purchaseOrderNumber: text('purchase_order_number'),
  department: text('department'),
  costCenter: text('cost_center'),
})

export const tabsRelations = relations(tabs, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [tabs.merchantId],
    references: [merchants.id],
  }),
  organization: one(organizations, {
    fields: [tabs.organizationId],
    references: [organizations.id],
  }),
  customerOrganization: one(organizations, {
    fields: [tabs.customerOrganizationId],
    references: [organizations.id],
  }),
  lineItems: many(lineItems),
  payments: many(payments),
  invoices: many(invoices),
  corporateAccount: one(corporateAccounts, {
    fields: [tabs.corporateAccountId],
    references: [corporateAccounts.id],
  }),
  paidByOrg: one(organizations, {
    fields: [tabs.paidByOrgId],
    references: [organizations.id],
  }),
  corporateRelationship: one(corporateMerchantRelationships, {
    fields: [tabs.corporateRelationshipId],
    references: [corporateMerchantRelationships.id],
  }),
  relationship: one(organizationRelationships, {
    fields: [tabs.relationshipId],
    references: [organizationRelationships.id],
  }),
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

export const merchantProcessors = pgTable('merchant_processors', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'cascade' }), // Legacy
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  processorType: text('processor_type').notNull(), // 'stripe', 'square', 'paypal', 'authorize_net'
  isActive: boolean('is_active').default(true).notNull(),
  isTestMode: boolean('is_test_mode').default(true).notNull(),
  encryptedCredentials: jsonb('encrypted_credentials').notNull(),
  webhookSecret: text('webhook_secret'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const merchantProcessorsRelations = relations(merchantProcessors, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [merchantProcessors.merchantId],
    references: [merchants.id],
  }),
  organization: one(organizations, {
    fields: [merchantProcessors.organizationId],
    references: [organizations.id],
  }),
  payments: many(payments),
}))

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tabId: uuid('tab_id').notNull().references(() => tabs.id),
  processorId: uuid('processor_id').references(() => merchantProcessors.id),
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
  processor: one(merchantProcessors, {
    fields: [payments.processorId],
    references: [merchantProcessors.id],
  }),
}))

// Note: The full professional invoicing schema is defined below after corporate accounts

// Corporate Accounts Tables
export const corporateAccounts = pgTable('corporate_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountNumber: text('account_number').notNull().unique(),
  companyName: text('company_name').notNull(),
  taxId: text('tax_id'),
  primaryContactEmail: text('primary_contact_email').notNull(),
  primaryContactName: text('primary_contact_name'),
  primaryContactPhone: text('primary_contact_phone'),
  billingAddress: jsonb('billing_address'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    accountNumberIdx: index('idx_corporate_accounts_number').on(table.accountNumber),
    emailIdx: index('idx_corporate_accounts_email').on(table.primaryContactEmail),
  }
})

export const corporateAccountsRelations = relations(corporateAccounts, ({ many }) => ({
  apiKeys: many(corporateApiKeys),
  merchantRelationships: many(corporateMerchantRelationships),
  users: many(corporateAccountUsers),
  tabs: many(tabs),
  activity: many(corporateAccountActivity),
}))

export const corporateApiKeys = pgTable('corporate_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  corporateAccountId: uuid('corporate_account_id').notNull().references(() => corporateAccounts.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
}, (table) => {
  return {
    keyPrefixIdx: index('idx_corporate_api_keys_prefix').on(table.keyPrefix),
    keyHashIdx: index('idx_corporate_api_keys_hash').on(table.keyHash),
  }
})

export const corporateApiKeysRelations = relations(corporateApiKeys, ({ one }) => ({
  corporateAccount: one(corporateAccounts, {
    fields: [corporateApiKeys.corporateAccountId],
    references: [corporateAccounts.id],
  }),
}))

export const corporateMerchantRelationships = pgTable('corporate_merchant_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  corporateAccountId: uuid('corporate_account_id').notNull().references(() => corporateAccounts.id, { onDelete: 'cascade' }),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // active, suspended, pending_approval
  creditLimit: decimal('credit_limit', { precision: 10, scale: 2 }),
  paymentTerms: text('payment_terms'), // NET30, NET60, PREPAID
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  billingContactEmail: text('billing_contact_email'),
  billingContactName: text('billing_contact_name'),
  shippingAddresses: jsonb('shipping_addresses').default([]),
  customPricing: jsonb('custom_pricing'),
  metadata: jsonb('metadata').default({}),
  approvedAt: timestamp('approved_at'),
  approvedBy: uuid('approved_by').references(() => merchants.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    corporateAccountIdx: index('idx_cmr_corporate_account').on(table.corporateAccountId),
    merchantIdx: index('idx_cmr_merchant').on(table.merchantId),
    statusIdx: index('idx_cmr_status').on(table.status),
  }
})

export const corporateMerchantRelationshipsRelations = relations(corporateMerchantRelationships, ({ one, many }) => ({
  corporateAccount: one(corporateAccounts, {
    fields: [corporateMerchantRelationships.corporateAccountId],
    references: [corporateAccounts.id],
  }),
  merchant: one(merchants, {
    fields: [corporateMerchantRelationships.merchantId],
    references: [merchants.id],
  }),
  tabs: many(tabs),
}))

export const corporateAccountUsers = pgTable('corporate_account_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  corporateAccountId: uuid('corporate_account_id').notNull().references(() => corporateAccounts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').notNull(), // admin, purchaser, viewer, approver
  permissions: jsonb('permissions').default({}),
  isActive: boolean('is_active').default(true).notNull(),
  merchantAccess: jsonb('merchant_access').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const corporateAccountUsersRelations = relations(corporateAccountUsers, ({ one, many }) => ({
  corporateAccount: one(corporateAccounts, {
    fields: [corporateAccountUsers.corporateAccountId],
    references: [corporateAccounts.id],
  }),
  activity: many(corporateAccountActivity),
}))

export const corporateAccountActivity = pgTable('corporate_account_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  corporateAccountId: uuid('corporate_account_id').notNull().references(() => corporateAccounts.id, { onDelete: 'cascade' }),
  merchantId: uuid('merchant_id').references(() => merchants.id),
  userId: uuid('user_id').references(() => corporateAccountUsers.id),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').default({}),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    corporateAccountIdx: index('idx_activity_corporate_account').on(table.corporateAccountId),
    createdAtIdx: index('idx_activity_created').on(table.createdAt),
  }
})

export const corporateAccountActivityRelations = relations(corporateAccountActivity, ({ one }) => ({
  corporateAccount: one(corporateAccounts, {
    fields: [corporateAccountActivity.corporateAccountId],
    references: [corporateAccounts.id],
  }),
  merchant: one(merchants, {
    fields: [corporateAccountActivity.merchantId],
    references: [merchants.id],
  }),
  user: one(corporateAccountUsers, {
    fields: [corporateAccountActivity.userId],
    references: [corporateAccountUsers.id],
  }),
}))

// Professional Invoicing System Tables

// Enhanced invoices table
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').references(() => merchants.id), // Legacy
  organizationId: uuid('organization_id').references(() => organizations.id),
  tabId: uuid('tab_id').references(() => tabs.id),
  
  // Invoice identification
  invoiceNumber: text('invoice_number').notNull(),
  version: integer('version').default(1).notNull(),
  parentInvoiceId: uuid('parent_invoice_id').references(() => invoices.id),
  
  // Customer info
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name'),
  customerId: uuid('customer_id').references(() => corporateAccounts.id),
  
  // Invoice details
  status: text('status').notNull().default('draft'),
  invoiceType: text('invoice_type').notNull().default('standard'),
  
  // Dates
  issueDate: date('issue_date').notNull().default(sql`CURRENT_DATE`),
  dueDate: date('due_date').notNull(),
  sentAt: timestamp('sent_at'),
  firstViewedAt: timestamp('first_viewed_at'),
  paidAt: timestamp('paid_at'),
  voidedAt: timestamp('voided_at'),
  
  // Amounts
  currency: text('currency').default('USD').notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0'),
  
  // Payment terms
  paymentTerms: text('payment_terms'),
  lateFeePercentage: decimal('late_fee_percentage', { precision: 5, scale: 2 }),
  
  // References
  publicUrl: text('public_url').unique(),
  externalReference: text('external_reference'),
  purchaseOrderNumber: text('purchase_order_number'),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  billingAddress: jsonb('billing_address'),
  shippingAddress: jsonb('shipping_address'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    merchantStatusIdx: index('idx_invoices_merchant_status').on(table.merchantId, table.status),
    customerIdx: index('idx_invoices_customer').on(table.customerEmail),
    customerIdIdx: index('idx_invoices_customer_id').on(table.customerId),
    dueDateIdx: index('idx_invoices_due_date').on(table.dueDate),
    tabIdx: index('idx_invoices_tab').on(table.tabId),
  }
})

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [invoices.merchantId],
    references: [merchants.id],
  }),
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  tab: one(tabs, {
    fields: [invoices.tabId],
    references: [tabs.id],
  }),
  customer: one(corporateAccounts, {
    fields: [invoices.customerId],
    references: [corporateAccounts.id],
  }),
  parentInvoice: one(invoices, {
    fields: [invoices.parentInvoiceId],
    references: [invoices.id],
  }),
  lineItems: many(invoiceLineItems),
  paymentAllocations: many(paymentAllocations),
  splits: many(invoiceSplits),
  hotelFolio: one(hotelFolios),
  auditLogs: many(invoiceAuditLog),
}))

// Invoice line items
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  
  // Line item details
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  category: text('category'),
  
  // Source tracking
  sourceType: text('source_type').default('manual'),
  sourceId: uuid('source_id'),
  
  // Grouping
  groupId: uuid('group_id'),
  splitGroup: text('split_group'),
  
  // Amounts
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  
  // Payment tracking
  allocatedAmount: decimal('allocated_amount', { precision: 10, scale: 2 }).default('0'),
  
  // Hotel-specific
  serviceDate: date('service_date'),
  roomNumber: text('room_number'),
  folioCategory: text('folio_category'),
  
  // Professional services
  milestoneId: uuid('milestone_id'),
  hoursWorked: decimal('hours_worked', { precision: 10, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    invoiceIdx: index('idx_invoice_line_items_invoice').on(table.invoiceId),
    remainingIdx: index('idx_invoice_line_items_remaining').on(table.invoiceId),
  }
})

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  paymentAllocations: many(paymentAllocations),
  milestone: one(projectMilestones, {
    fields: [invoiceLineItems.milestoneId],
    references: [projectMilestones.id],
  }),
}))

// Payment allocations
export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  invoiceLineItemId: uuid('invoice_line_item_id').references(() => invoiceLineItems.id, { onDelete: 'cascade' }),
  
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  allocationMethod: text('allocation_method').default('fifo'),
  
  allocatedAt: timestamp('allocated_at').defaultNow().notNull(),
}, (table) => {
  return {
    paymentIdx: index('idx_payment_allocations_payment').on(table.paymentId),
    invoiceIdx: index('idx_payment_allocations_invoice').on(table.invoiceId),
  }
})

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  invoice: one(invoices, {
    fields: [paymentAllocations.invoiceId],
    references: [invoices.id],
  }),
  lineItem: one(invoiceLineItems, {
    fields: [paymentAllocations.invoiceLineItemId],
    references: [invoiceLineItems.id],
  }),
}))

// Invoice splits
export const invoiceSplits = pgTable('invoice_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentInvoiceId: uuid('parent_invoice_id').notNull().references(() => invoices.id),
  
  splitType: text('split_type').notNull(),
  splitConfig: jsonb('split_config').notNull(),
  
  status: text('status').default('pending'),
  confirmedAt: timestamp('confirmed_at'),
  confirmedBy: text('confirmed_by'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const invoiceSplitsRelations = relations(invoiceSplits, ({ one }) => ({
  parentInvoice: one(invoices, {
    fields: [invoiceSplits.parentInvoiceId],
    references: [invoices.id],
  }),
}))

// Hotel folios
export const hotelFolios = pgTable('hotel_folios', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().unique().references(() => invoices.id),
  
  folioNumber: text('folio_number').notNull(),
  folioType: text('folio_type').notNull(),
  parentFolioId: uuid('parent_folio_id').references(() => hotelFolios.id),
  
  guestName: text('guest_name'),
  roomNumber: text('room_number'),
  checkInDate: date('check_in_date'),
  checkOutDate: date('check_out_date'),
  
  directBillCompanyId: uuid('direct_bill_company_id').references(() => corporateAccounts.id),
  authorizationCode: text('authorization_code'),
  
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }).default('0'),
  depositApplied: decimal('deposit_applied', { precision: 10, scale: 2 }).default('0'),
  
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    roomIdx: index('idx_hotel_folios_room').on(table.roomNumber),
  }
})

export const hotelFoliosRelations = relations(hotelFolios, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [hotelFolios.invoiceId],
    references: [invoices.id],
  }),
  parentFolio: one(hotelFolios, {
    fields: [hotelFolios.parentFolioId],
    references: [hotelFolios.id],
  }),
  childFolios: many(hotelFolios),
  directBillCompany: one(corporateAccounts, {
    fields: [hotelFolios.directBillCompanyId],
    references: [corporateAccounts.id],
  }),
}))

// Project milestones
export const projectMilestones = pgTable('project_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').references(() => merchants.id), // Legacy
  organizationId: uuid('organization_id').references(() => organizations.id),
  tabId: uuid('tab_id').references(() => tabs.id),
  
  milestoneNumber: integer('milestone_number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  
  billingType: text('billing_type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  percentage: decimal('percentage', { precision: 5, scale: 2 }),
  
  status: text('status').default('pending'),
  completedAt: timestamp('completed_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'),
  
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  invoicedAt: timestamp('invoiced_at'),
  
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    tabIdx: index('idx_milestones_tab').on(table.tabId),
    statusIdx: index('idx_milestones_status').on(table.merchantId, table.status),
  }
})

export const projectMilestonesRelations = relations(projectMilestones, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [projectMilestones.merchantId],
    references: [merchants.id],
  }),
  organization: one(organizations, {
    fields: [projectMilestones.organizationId],
    references: [organizations.id],
  }),
  tab: one(tabs, {
    fields: [projectMilestones.tabId],
    references: [tabs.id],
  }),
  invoice: one(invoices, {
    fields: [projectMilestones.invoiceId],
    references: [invoices.id],
  }),
  lineItems: many(invoiceLineItems),
}))

// Retainer accounts
export const retainerAccounts = pgTable('retainer_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').references(() => merchants.id), // Legacy
  organizationId: uuid('organization_id').references(() => organizations.id),
  customerId: uuid('customer_id').references(() => corporateAccounts.id), // Legacy
  customerOrgId: uuid('customer_org_id').references(() => organizations.id),
  
  accountName: text('account_name').notNull(),
  initialBalance: decimal('initial_balance', { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal('current_balance', { precision: 10, scale: 2 }).notNull(),
  minimumBalance: decimal('minimum_balance', { precision: 10, scale: 2 }).default('0'),
  
  autoReplenish: boolean('auto_replenish').default(false),
  replenishAmount: decimal('replenish_amount', { precision: 10, scale: 2 }),
  replenishThreshold: decimal('replenish_threshold', { precision: 10, scale: 2 }),
  
  status: text('status').default('active'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    customerIdx: index('idx_retainer_accounts_customer').on(table.customerId),
  }
})

export const retainerAccountsRelations = relations(retainerAccounts, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [retainerAccounts.merchantId],
    references: [merchants.id],
  }),
  organization: one(organizations, {
    fields: [retainerAccounts.organizationId],
    references: [organizations.id],
  }),
  customer: one(corporateAccounts, {
    fields: [retainerAccounts.customerId],
    references: [corporateAccounts.id],
  }),
  customerOrg: one(organizations, {
    fields: [retainerAccounts.customerOrgId],
    references: [organizations.id],
  }),
  transactions: many(retainerTransactions),
}))

// Retainer transactions
export const retainerTransactions = pgTable('retainer_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  retainerAccountId: uuid('retainer_account_id').notNull().references(() => retainerAccounts.id),
  
  transactionType: text('transaction_type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  paymentId: uuid('payment_id').references(() => payments.id),
  
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const retainerTransactionsRelations = relations(retainerTransactions, ({ one }) => ({
  retainerAccount: one(retainerAccounts, {
    fields: [retainerTransactions.retainerAccountId],
    references: [retainerAccounts.id],
  }),
  invoice: one(invoices, {
    fields: [retainerTransactions.invoiceId],
    references: [invoices.id],
  }),
  payment: one(payments, {
    fields: [retainerTransactions.paymentId],
    references: [payments.id],
  }),
}))

// Invoice audit log
export const invoiceAuditLog = pgTable('invoice_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  
  action: text('action').notNull(),
  changedBy: uuid('changed_by').references(() => merchants.id),
  changedByType: text('changed_by_type'),
  
  previousData: jsonb('previous_data'),
  newData: jsonb('new_data'),
  
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    invoiceIdx: index('idx_audit_log_invoice').on(table.invoiceId),
    createdIdx: index('idx_audit_log_created').on(table.createdAt),
  }
})

export const invoiceAuditLogRelations = relations(invoiceAuditLog, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceAuditLog.invoiceId],
    references: [invoices.id],
  }),
  changedByMerchant: one(merchants, {
    fields: [invoiceAuditLog.changedBy],
    references: [merchants.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrganizationUser = typeof organizationUsers.$inferSelect
export type NewOrganizationUser = typeof organizationUsers.$inferInsert
export type OrganizationRelationship = typeof organizationRelationships.$inferSelect
export type NewOrganizationRelationship = typeof organizationRelationships.$inferInsert
export type Merchant = typeof merchants.$inferSelect
export type NewMerchant = typeof merchants.$inferInsert
export type MerchantUser = typeof merchantUsers.$inferSelect
export type NewMerchantUser = typeof merchantUsers.$inferInsert
export type UserSession = typeof userSessions.$inferSelect
export type NewUserSession = typeof userSessions.$inferInsert
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
export type MerchantProcessor = typeof merchantProcessors.$inferSelect
export type NewMerchantProcessor = typeof merchantProcessors.$inferInsert
export type CorporateAccount = typeof corporateAccounts.$inferSelect
export type NewCorporateAccount = typeof corporateAccounts.$inferInsert
export type CorporateApiKey = typeof corporateApiKeys.$inferSelect
export type NewCorporateApiKey = typeof corporateApiKeys.$inferInsert
export type CorporateMerchantRelationship = typeof corporateMerchantRelationships.$inferSelect
export type NewCorporateMerchantRelationship = typeof corporateMerchantRelationships.$inferInsert
export type CorporateAccountUser = typeof corporateAccountUsers.$inferSelect
export type NewCorporateAccountUser = typeof corporateAccountUsers.$inferInsert
export type CorporateAccountActivity = typeof corporateAccountActivity.$inferSelect
export type NewCorporateAccountActivity = typeof corporateAccountActivity.$inferInsert
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert
export type PaymentAllocation = typeof paymentAllocations.$inferSelect
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert
export type InvoiceSplit = typeof invoiceSplits.$inferSelect
export type NewInvoiceSplit = typeof invoiceSplits.$inferInsert
export type HotelFolio = typeof hotelFolios.$inferSelect
export type NewHotelFolio = typeof hotelFolios.$inferInsert
export type ProjectMilestone = typeof projectMilestones.$inferSelect
export type NewProjectMilestone = typeof projectMilestones.$inferInsert
export type RetainerAccount = typeof retainerAccounts.$inferSelect
export type NewRetainerAccount = typeof retainerAccounts.$inferInsert
export type RetainerTransaction = typeof retainerTransactions.$inferSelect
export type NewRetainerTransaction = typeof retainerTransactions.$inferInsert
export type InvoiceAuditLog = typeof invoiceAuditLog.$inferSelect
export type NewInvoiceAuditLog = typeof invoiceAuditLog.$inferInsert
