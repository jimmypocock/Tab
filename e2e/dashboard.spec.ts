import { test, expect } from '@playwright/test'

test.describe('Dashboard Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard')
  })

  test('dashboard layout and stats display', async ({ page }) => {
    // Wait for stats to load
    await page.waitForSelector('[data-testid="stats-grid"]')
    
    // Take screenshot of dashboard
    await expect(page).toHaveScreenshot('dashboard-overview.png', {
      fullPage: true,
      animations: 'disabled',
    })
    
    // Verify key elements are visible
    await expect(page.locator('[data-testid="stat-revenue"]')).toBeVisible()
    await expect(page.locator('[data-testid="stat-active-tabs"]')).toBeVisible()
    await expect(page.locator('[data-testid="stat-paid-tabs"]')).toBeVisible()
    await expect(page.locator('[data-testid="stat-conversion"]')).toBeVisible()
    
    // Check recent tabs section
    await expect(page.locator('[data-testid="recent-tabs"]')).toBeVisible()
  })

  test('responsive dashboard layout', async ({ page }) => {
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page).toHaveScreenshot('dashboard-desktop.png')
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page).toHaveScreenshot('dashboard-tablet.png')
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page).toHaveScreenshot('dashboard-mobile.png')
  })

  test('create new tab button interaction', async ({ page }) => {
    const createButton = page.locator('[data-testid="create-tab-button"]')
    
    // Hover state
    await createButton.hover()
    await expect(createButton).toHaveScreenshot('create-button-hover.png')
    
    // Click and navigate
    await createButton.click()
    await page.waitForURL('/tabs/new')
    await expect(page).toHaveURL('/tabs/new')
  })

  test('recent tabs interaction', async ({ page }) => {
    // Wait for tabs to load
    await page.waitForSelector('[data-testid^="tab-row-"]')
    
    // Hover over a tab row
    const firstTab = page.locator('[data-testid^="tab-row-"]').first()
    await firstTab.hover()
    await expect(firstTab).toHaveScreenshot('tab-row-hover.png')
    
    // Click view button
    await firstTab.locator('[data-testid^="view-tab-"]').click()
    await page.waitForURL(/\/tabs\/tab_/)
  })
})