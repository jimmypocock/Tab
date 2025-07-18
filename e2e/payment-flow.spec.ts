import { test, expect, Page } from '@playwright/test'

// Test data
const TEST_MERCHANT = {
  email: 'test@merchant.com',
  password: 'testpassword123',
  apiKey: 'tab_test_1234567890'
}

const TEST_CUSTOMER = {
  email: 'customer@example.com',
  name: 'Test Customer',
  // Stripe test card
  cardNumber: '4242424242424242',
  cardExpiry: '12/25',
  cardCVC: '123',
  cardZip: '10001'
}

// Helper to create a test tab via API
async function createTestTab(page: Page, apiKey: string) {
  const response = await page.request.post('/api/v1/tabs', {
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    data: {
      customerEmail: TEST_CUSTOMER.email,
      customerName: TEST_CUSTOMER.name,
      currency: 'USD',
      lineItems: [
        { description: 'Product A', quantity: 2, unitAmount: '25.00' },
        { description: 'Product B', quantity: 1, unitAmount: '30.00' }
      ],
      taxRate: 0.08
    }
  })

  expect(response.ok()).toBeTruthy()
  const tab = await response.json()
  return tab.data
}

test.describe('Payment Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any required test data or mocks
    // In a real scenario, you might seed a test database
  })

  test('complete payment flow from tab creation to successful payment', async ({ page }) => {
    // Step 1: Create a tab via API (simulating merchant action)
    const tab = await createTestTab(page, TEST_MERCHANT.apiKey)
    expect(tab.id).toBeTruthy()
    expect(tab.total).toBe('86.40') // $80 + 8% tax
    expect(tab.paymentUrl).toContain('/pay/')

    // Step 2: Customer visits payment page
    await page.goto(tab.paymentUrl)
    
    // Verify tab details are displayed
    await expect(page.locator('h1')).toContainText('Payment')
    await expect(page.locator('text=Balance Due')).toBeVisible()
    await expect(page.locator('text=$86.40')).toBeVisible()
    await expect(page.locator(`text=${TEST_CUSTOMER.name}`)).toBeVisible()
    
    // Step 3: Enter payment details
    // Wait for Stripe iframe to load
    const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]').first()
    
    // Fill card number
    await stripeFrame.locator('[placeholder="Card number"]').fill(TEST_CUSTOMER.cardNumber)
    await stripeFrame.locator('[placeholder="MM / YY"]').fill(TEST_CUSTOMER.cardExpiry)
    await stripeFrame.locator('[placeholder="CVC"]').fill(TEST_CUSTOMER.cardCVC)
    await stripeFrame.locator('[placeholder="ZIP"]').fill(TEST_CUSTOMER.cardZip)
    
    // Step 4: Submit payment
    await page.locator('button:has-text("Pay $86.40")').click()
    
    // Wait for payment processing
    await expect(page.locator('text=Processing payment')).toBeVisible()
    
    // Step 5: Verify success
    await expect(page.locator('text=Payment successful')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('text=Thank you for your payment')).toBeVisible()
    
    // Verify tab status via API
    const statusResponse = await page.request.get(`/api/v1/public/tabs/${tab.id}`)
    const updatedTab = await statusResponse.json()
    expect(updatedTab.data.status).toBe('paid')
    expect(updatedTab.data.paidAmount).toBe('86.40')
  })

  test('partial payment flow', async ({ page }) => {
    // Create tab
    const tab = await createTestTab(page, TEST_MERCHANT.apiKey)
    
    // Visit payment page
    await page.goto(tab.paymentUrl)
    
    // Select partial payment option
    await page.locator('label:has-text("Other amount")').click()
    await page.locator('input[placeholder="Enter amount"]').fill('50.00')
    
    // Verify amount is displayed correctly
    await expect(page.locator('button:has-text("Pay $50.00")')).toBeVisible()
    
    // Enter card details
    const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]').first()
    await stripeFrame.locator('[placeholder="Card number"]').fill(TEST_CUSTOMER.cardNumber)
    await stripeFrame.locator('[placeholder="MM / YY"]').fill(TEST_CUSTOMER.cardExpiry)
    await stripeFrame.locator('[placeholder="CVC"]').fill(TEST_CUSTOMER.cardCVC)
    await stripeFrame.locator('[placeholder="ZIP"]').fill(TEST_CUSTOMER.cardZip)
    
    // Submit payment
    await page.locator('button:has-text("Pay $50.00")').click()
    
    // Verify partial payment success
    await expect(page.locator('text=Payment successful')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('text=Remaining balance: $36.40')).toBeVisible()
    
    // Verify tab status
    const statusResponse = await page.request.get(`/api/v1/public/tabs/${tab.id}`)
    const updatedTab = await statusResponse.json()
    expect(updatedTab.data.status).toBe('partial')
    expect(updatedTab.data.paidAmount).toBe('50.00')
    expect(updatedTab.data.balanceDue).toBe('36.40')
  })

  test('payment validation errors', async ({ page }) => {
    const tab = await createTestTab(page, TEST_MERCHANT.apiKey)
    await page.goto(tab.paymentUrl)
    
    // Test 1: Amount exceeding balance
    await page.locator('label:has-text("Other amount")').click()
    await page.locator('input[placeholder="Enter amount"]').fill('100.00')
    
    // Should show error immediately
    await expect(page.locator('text=Amount exceeds balance due')).toBeVisible()
    
    // Test 2: Below minimum amount
    await page.locator('input[placeholder="Enter amount"]').clear()
    await page.locator('input[placeholder="Enter amount"]').fill('0.40')
    
    await expect(page.locator('text=Minimum payment amount is $0.50')).toBeVisible()
    
    // Test 3: Invalid card number
    await page.locator('input[placeholder="Enter amount"]').clear()
    await page.locator('input[placeholder="Enter amount"]').fill('10.00')
    
    const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]').first()
    await stripeFrame.locator('[placeholder="Card number"]').fill('4000000000000002') // Decline card
    await stripeFrame.locator('[placeholder="MM / YY"]').fill(TEST_CUSTOMER.cardExpiry)
    await stripeFrame.locator('[placeholder="CVC"]').fill(TEST_CUSTOMER.cardCVC)
    await stripeFrame.locator('[placeholder="ZIP"]').fill(TEST_CUSTOMER.cardZip)
    
    await page.locator('button:has-text("Pay $10.00")').click()
    
    // Should show decline error
    await expect(page.locator('text=Your card was declined')).toBeVisible({ timeout: 30000 })
  })

  test('mobile responsive payment flow', async ({ page, browserName }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    const tab = await createTestTab(page, TEST_MERCHANT.apiKey)
    await page.goto(tab.paymentUrl)
    
    // Verify mobile layout
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=$86.40')).toBeVisible()
    
    // Verify Stripe elements are responsive
    const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]').first()
    await expect(stripeFrame.locator('[placeholder="Card number"]')).toBeVisible()
    
    // Test touch interactions
    await page.locator('label:has-text("Pay full amount")').tap()
    await expect(page.locator('button:has-text("Pay $86.40")')).toBeVisible()
  })

  test('payment link expiration', async ({ page }) => {
    // Create a tab with expiration date
    const response = await page.request.post('/api/v1/tabs', {
      headers: {
        'X-API-Key': TEST_MERCHANT.apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        customerEmail: TEST_CUSTOMER.email,
        currency: 'USD',
        lineItems: [{ description: 'Test', quantity: 1, unitAmount: '10.00' }],
        metadata: {
          expiresAt: new Date(Date.now() - 1000).toISOString() // Already expired
        }
      }
    })

    const tab = await response.json()
    await page.goto(tab.data.paymentUrl)
    
    // Should show expiration message
    await expect(page.locator('text=This payment link has expired')).toBeVisible()
    await expect(page.locator('button:has-text("Pay")')).not.toBeVisible()
  })
})

test.describe('Merchant Dashboard E2E Tests', () => {
  test('create and manage tabs from dashboard', async ({ page }) => {
    // Login to merchant dashboard
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(TEST_MERCHANT.email)
    await page.locator('input[type="password"]').fill(TEST_MERCHANT.password)
    await page.locator('button:has-text("Sign in")').click()
    
    // Wait for dashboard
    await page.waitForURL('/dashboard')
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    
    // Navigate to tabs
    await page.locator('a:has-text("Tabs")').click()
    await page.waitForURL('/tabs')
    
    // Create new tab
    await page.locator('button:has-text("Create Tab")').click()
    
    // Fill tab form
    await page.locator('input[name="customerEmail"]').fill(TEST_CUSTOMER.email)
    await page.locator('input[name="customerName"]').fill(TEST_CUSTOMER.name)
    
    // Add line items
    await page.locator('button:has-text("Add Item")').click()
    await page.locator('input[name="lineItems.0.description"]').fill('Service A')
    await page.locator('input[name="lineItems.0.quantity"]').fill('1')
    await page.locator('input[name="lineItems.0.unitAmount"]').fill('50.00')
    
    // Submit
    await page.locator('button:has-text("Create Tab")').click()
    
    // Verify creation
    await expect(page.locator('text=Tab created successfully')).toBeVisible()
    
    // Copy payment link
    await page.locator('button[aria-label="Copy payment link"]').first().click()
    await expect(page.locator('text=Copied!')).toBeVisible()
    
    // Verify tab in list
    await expect(page.locator(`text=${TEST_CUSTOMER.email}`)).toBeVisible()
    await expect(page.locator('text=$50.00')).toBeVisible()
    await expect(page.locator('text=Open')).toBeVisible()
  })
})