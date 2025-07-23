import { test, expect } from '@playwright/test'

test.describe('Tab Management Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  test('create tab form visual states', async ({ page }) => {
    await page.goto('/tabs/new')
    
    // Initial form state
    await expect(page).toHaveScreenshot('create-tab-empty.png')
    
    // Fill customer information
    await page.fill('[data-testid="customer-name-input"]', 'John Doe')
    await page.fill('[data-testid="customer-email-input"]', 'john@example.com')
    await page.selectOption('[data-testid="currency-select"]', 'USD')
    
    // Add line items
    await page.click('[data-testid="add-line-item"]')
    await page.fill('[data-testid="item-name-0"]', 'Coffee')
    await page.fill('[data-testid="item-price-0"]', '5.00')
    await page.fill('[data-testid="item-quantity-0"]', '2')
    
    // Take screenshot of filled form
    await expect(page).toHaveScreenshot('create-tab-filled.png')
    
    // Validate error states
    await page.fill('[data-testid="customer-email-input"]', 'invalid-email')
    await page.click('[data-testid="create-tab-button"]')
    await expect(page.locator('[data-testid="customer-email-error"]')).toBeVisible()
    await expect(page).toHaveScreenshot('create-tab-validation-error.png')
  })

  test('tab listing page with filters', async ({ page }) => {
    await page.goto('/tabs')
    
    // Wait for tabs to load
    await page.waitForSelector('[data-testid="tabs-list"]')
    
    // All tabs view
    await expect(page).toHaveScreenshot('tabs-list-all.png')
    
    // Filter by open tabs
    await page.click('[data-testid="filter-open"]')
    await page.waitForTimeout(500) // Wait for filter animation
    await expect(page).toHaveScreenshot('tabs-list-open.png')
    
    // Filter by paid tabs
    await page.click('[data-testid="filter-paid"]')
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('tabs-list-paid.png')
    
    // Empty state
    await page.click('[data-testid="filter-void"]')
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('tabs-list-empty.png')
  })

  test('edit tab page visual states', async ({ page }) => {
    // Navigate to a tab detail page
    await page.goto('/tabs')
    await page.click('[data-testid^="edit-tab_"]')
    
    // Wait for tab details to load
    await page.waitForSelector('[data-testid="tab-info"]')
    
    // Tab detail view
    await expect(page).toHaveScreenshot('tab-detail-open.png')
    
    // Send invoice modal
    await page.click('[data-testid="send-invoice-button"]')
    await page.waitForSelector('[data-testid="send-invoice-modal"]')
    await expect(page).toHaveScreenshot('tab-send-invoice-modal.png')
    
    // Close modal
    await page.keyboard.press('Escape')
    
    // Void confirmation modal
    await page.click('[data-testid="void-tab-button"]')
    await page.waitForSelector('[data-testid="void-confirm-modal"]')
    await expect(page).toHaveScreenshot('tab-void-confirmation.png')
  })

  test('tab status badges visual states', async ({ page }) => {
    await page.goto('/tabs')
    
    // Create a component showcase for status badges
    await page.evaluate(() => {
      const showcase = document.createElement('div')
      showcase.id = 'status-showcase'
      showcase.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1);'
      
      const statuses = ['open', 'paid', 'void', 'refunded']
      statuses.forEach(status => {
        const badge = document.createElement('div')
        badge.className = `status-badge status-${status}`
        badge.textContent = status.toUpperCase()
        badge.style.margin = '10px'
        showcase.appendChild(badge)
      })
      
      document.body.appendChild(showcase)
    })
    
    await expect(page.locator('#status-showcase')).toHaveScreenshot('status-badges.png')
  })
})