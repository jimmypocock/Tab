import { test, expect } from '@playwright/test'
import {
  takeScreenshot,
  waitForStableElement,
  mockDynamicContent,
  hideDynamicElements,
  captureResponsiveScreenshots,
  STANDARD_VIEWPORTS,
} from './helpers/visual-testing'

test.describe('Critical User Journey Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock dynamic content for consistent screenshots
    await mockDynamicContent(page)
    await hideDynamicElements(page)
  })

  test('complete tab creation and payment journey', async ({ page }) => {
    // 1. Login
    await page.goto('/login')
    await takeScreenshot(page, '01-login-page.png')
    
    await page.fill('[data-testid="email-input"]', 'merchant@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    
    // 2. Dashboard
    await page.waitForURL('/dashboard')
    await waitForStableElement(page, '[data-testid="stats-grid"]')
    await takeScreenshot(page, '02-dashboard.png', { fullPage: true })
    
    // 3. Create new tab
    await page.click('[data-testid="create-tab-button"]')
    await page.waitForURL('/tabs/new')
    await takeScreenshot(page, '03-create-tab-empty.png')
    
    // 4. Fill tab details
    await page.fill('[data-testid="customer-name-input"]', 'John Doe')
    await page.fill('[data-testid="customer-email-input"]', 'john@example.com')
    
    // Add line items
    await page.click('[data-testid="add-line-item"]')
    await page.fill('[data-testid="item-name-0"]', 'Coffee')
    await page.fill('[data-testid="item-price-0"]', '5.00')
    await page.fill('[data-testid="item-quantity-0"]', '2')
    
    await page.click('[data-testid="add-line-item"]')
    await page.fill('[data-testid="item-name-1"]', 'Sandwich')
    await page.fill('[data-testid="item-price-1"]', '12.50')
    await page.fill('[data-testid="item-quantity-1"]', '1')
    
    await takeScreenshot(page, '04-create-tab-filled.png')
    
    // 5. Create tab
    await page.click('[data-testid="create-tab-button"]')
    await page.waitForURL(/\/tabs\/tab_/)
    await takeScreenshot(page, '05-tab-created.png')
    
    // 6. Copy payment link
    const paymentLink = await page.locator('[data-testid="payment-link"]').textContent()
    
    // 7. Customer payment flow (new context)
    const customerContext = await page.context().browser()?.newContext()
    if (!customerContext) throw new Error('Failed to create customer context')
    
    const customerPage = await customerContext.newPage()
    await mockDynamicContent(customerPage)
    await hideDynamicElements(customerPage)
    
    // Navigate to payment page
    await customerPage.goto(paymentLink || '/pay/tab_123')
    await waitForStableElement(customerPage, '[data-testid="payment-form"]')
    await takeScreenshot(customerPage, '06-payment-page.png', { fullPage: true })
    
    // Fill payment details
    await customerPage.frameLocator('[data-testid="stripe-card-element"]')
      .locator('[placeholder="Card number"]')
      .fill('4242424242424242')
    await customerPage.frameLocator('[data-testid="stripe-card-element"]')
      .locator('[placeholder="MM / YY"]')
      .fill('12/25')
    await customerPage.frameLocator('[data-testid="stripe-card-element"]')
      .locator('[placeholder="CVC"]')
      .fill('123')
    await customerPage.fill('[data-testid="cardholder-name"]', 'John Doe')
    
    await takeScreenshot(customerPage, '07-payment-filled.png')
    
    // Submit payment
    await customerPage.click('[data-testid="pay-button"]')
    await customerPage.waitForURL(/\/pay\/success/)
    await waitForStableElement(customerPage, '[data-testid="success-checkmark"]')
    await takeScreenshot(customerPage, '08-payment-success.png', { fullPage: true })
    
    await customerContext.close()
    
    // 8. Back to merchant - check tab status
    await page.reload()
    await waitForStableElement(page, '[data-testid="tab-status-badge"]')
    await takeScreenshot(page, '09-tab-paid-status.png')
  })

  test('responsive design across all key pages', async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'merchant@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // Test dashboard responsiveness
    await captureResponsiveScreenshots(page, 'dashboard', STANDARD_VIEWPORTS)
    
    // Test tabs listing
    await page.goto('/tabs')
    await waitForStableElement(page, '[data-testid="tabs-list"]')
    await captureResponsiveScreenshots(page, 'tabs-list', STANDARD_VIEWPORTS)
    
    // Test create tab form
    await page.goto('/tabs/new')
    await captureResponsiveScreenshots(page, 'create-tab', STANDARD_VIEWPORTS)
    
    // Test settings
    await page.goto('/settings')
    await waitForStableElement(page, '[data-testid="settings-nav"]')
    await captureResponsiveScreenshots(page, 'settings', STANDARD_VIEWPORTS)
  })

  test('error states and edge cases', async ({ page }) => {
    await page.goto('/login')
    
    // Login error
    await page.fill('[data-testid="email-input"]', 'wrong@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')
    await waitForStableElement(page, '[data-testid="login-error"]')
    await takeScreenshot(page, 'error-login-failed.png')
    
    // Login successfully
    await page.fill('[data-testid="email-input"]', 'merchant@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // Empty states
    await page.goto('/tabs?filter=void')
    await waitForStableElement(page, '[data-testid="no-tabs"]')
    await takeScreenshot(page, 'empty-state-no-tabs.png')
    
    // Form validation errors
    await page.goto('/tabs/new')
    await page.click('[data-testid="create-tab-button"]')
    await waitForStableElement(page, '[data-testid="customer-name-error"]')
    await takeScreenshot(page, 'error-form-validation.png')
    
    // Network error simulation
    await page.route('**/api/v1/tabs', route => route.abort())
    await page.fill('[data-testid="customer-name-input"]', 'Test Customer')
    await page.fill('[data-testid="customer-email-input"]', 'test@example.com')
    await page.click('[data-testid="add-line-item"]')
    await page.fill('[data-testid="item-name-0"]', 'Test Item')
    await page.fill('[data-testid="item-price-0"]', '10.00')
    await page.click('[data-testid="create-tab-button"]')
    await waitForStableElement(page, '[data-testid="error-message"]')
    await takeScreenshot(page, 'error-network-failure.png')
  })

  test('dark mode visual consistency', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'merchant@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // Navigate to settings and enable dark mode
    await page.goto('/settings')
    await page.click('[data-testid="dark-mode-toggle"]')
    await page.waitForTimeout(500) // Wait for theme transition
    
    // Capture key pages in dark mode
    const darkModePages = [
      { url: '/dashboard', name: 'dashboard-dark' },
      { url: '/tabs', name: 'tabs-dark' },
      { url: '/tabs/new', name: 'create-tab-dark' },
      { url: '/settings', name: 'settings-dark' },
    ]
    
    for (const { url, name } of darkModePages) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await takeScreenshot(page, `${name}.png`, { fullPage: true })
    }
  })

  test('interactive elements hover and focus states', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'merchant@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // Button hover states
    const createButton = page.locator('[data-testid="create-tab-button"]')
    await createButton.hover()
    await takeScreenshot(page, 'button-hover-create-tab.png', {
      clip: await createButton.boundingBox() || undefined,
    })
    
    // Form focus states
    await page.goto('/tabs/new')
    await page.focus('[data-testid="customer-name-input"]')
    await takeScreenshot(page, 'input-focus-state.png', {
      clip: {
        x: 0,
        y: 100,
        width: 600,
        height: 400,
      },
    })
    
    // Dropdown open state
    await page.goto('/settings')
    await page.click('[data-testid="user-menu"]')
    await waitForStableElement(page, '[data-testid="user-menu-dropdown"]')
    await takeScreenshot(page, 'dropdown-open-user-menu.png')
  })
})