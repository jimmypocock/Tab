import { test, expect, Page } from '@playwright/test'

// Helper to wait for navigation to complete
async function waitForNavigation(page: Page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout })
  } catch (error) {
    // Continue even if timeout - some pages may not reach networkidle
  }
}

test.describe('Navigation Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/')
    await waitForNavigation(page)
  })

  test('should navigate public pages without authentication', async ({ page }) => {
    // Home page
    await expect(page).toHaveURL('/')
    await expect(page.locator('text=Tab API')).toBeVisible()

    // Navigate to login
    await page.goto('/login')
    await waitForNavigation(page)
    await expect(page).toHaveURL('/login')
    await expect(page.locator('text=Sign in to your account')).toBeVisible()

    // Navigate to register
    await page.goto('/register')
    await waitForNavigation(page)
    await expect(page).toHaveURL('/register')
    await expect(page.locator('text=Create your account')).toBeVisible()
  })

  test('should redirect to login when accessing protected pages without auth', async ({ page }) => {
    // Try to access dashboard
    await page.goto('/dashboard')
    await waitForNavigation(page)
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
    await expect(page.locator('text=Sign in to your account')).toBeVisible()
  })

  test('should complete full authentication flow without redirect loops', async ({ page }) => {
    // Generate unique test user
    const timestamp = Date.now()
    const testEmail = `test${timestamp}@example.com`
    const testPassword = 'TestPassword123!'

    // Go to register page
    await page.goto('/register')
    await waitForNavigation(page)

    // Fill registration form
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="businessName"]', 'Test Business')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 })
    await waitForNavigation(page)
    
    // Verify we're on dashboard without loops
    await expect(page).toHaveURL('/dashboard')
    
    // Verify navigation works
    const navigationLinks = [
      { href: '/dashboard', text: 'Dashboard' },
      { href: '/tabs', text: 'Tabs' },
      { href: '/settings', text: 'Settings' },
    ]

    for (const link of navigationLinks) {
      // Click navigation link
      await page.click(`a[href="${link.href}"]`)
      await waitForNavigation(page)
      
      // Verify URL changed
      await expect(page).toHaveURL(link.href)
      
      // Verify no redirect loops (URL should remain stable)
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL(link.href)
    }
  })

  test('should handle user without organization gracefully', async ({ page, context }) => {
    // Mock a user session without organization
    // This would typically be done through your test setup
    
    // For this test, we'll create a new user and then manually remove their org
    const timestamp = Date.now()
    const testEmail = `noorg${timestamp}@example.com`
    const testPassword = 'TestPassword123!'

    // Register user
    await page.goto('/register')
    await waitForNavigation(page)
    
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    
    // Submit without business name to simulate old registration
    await page.evaluate(() => {
      const businessNameInput = document.querySelector('input[name="businessName"]') as HTMLInputElement
      if (businessNameInput) {
        businessNameInput.removeAttribute('required')
        businessNameInput.value = ''
      }
    })
    
    await page.click('button[type="submit"]')
    
    // Should redirect to setup organization
    await page.waitForURL('/dashboard', { timeout: 10000 })
    await waitForNavigation(page)
    
    // Verify we're on setup page
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Set Up Your Organization')).toBeVisible()
    
    // Fill organization form
    await page.fill('input[name="name"]', 'New Organization')
    await page.fill('input[name="slug"]', 'new-org')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard after setup
    await page.waitForURL('/dashboard', { timeout: 10000 })
    await waitForNavigation(page)
    
    // Verify successful setup
    await expect(page).toHaveURL('/dashboard')
  })

  test('should prevent infinite redirect loops', async ({ page }) => {
    let redirectCount = 0
    
    // Monitor redirects
    page.on('framenavigated', () => {
      redirectCount++
      if (redirectCount > 10) {
        throw new Error('Redirect loop detected! More than 10 redirects occurred.')
      }
    })

    // Try to access various protected pages
    const protectedPages = ['/dashboard', '/tabs', '/settings', '/settings/team']
    
    for (const url of protectedPages) {
      redirectCount = 0
      await page.goto(url)
      await waitForNavigation(page)
      
      // Should redirect to login (max 1-2 redirects)
      expect(redirectCount).toBeLessThanOrEqual(2)
      await expect(page).toHaveURL('/login')
    }
  })

  test('should handle navigation between settings pages', async ({ page }) => {
    // First, authenticate
    const timestamp = Date.now()
    const testEmail = `settings${timestamp}@example.com`
    const testPassword = 'TestPassword123!'

    await page.goto('/register')
    await waitForNavigation(page)
    
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="businessName"]', 'Settings Test Business')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('/dashboard', { timeout: 10000 })
    await waitForNavigation(page)

    // Navigate to settings
    await page.goto('/settings')
    await waitForNavigation(page)
    await expect(page).toHaveURL('/settings')

    // Test settings sub-navigation
    const settingsPages = [
      { path: '/settings/team', label: 'Team' },
      { path: '/settings/processors', label: 'Payment Processors' },
    ]

    for (const settingsPage of settingsPages) {
      await page.goto(settingsPage.path)
      await waitForNavigation(page)
      
      // Verify URL is stable
      await expect(page).toHaveURL(settingsPage.path)
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL(settingsPage.path)
    }
  })

  test('should handle logout flow correctly', async ({ page }) => {
    // First, authenticate
    const timestamp = Date.now()
    const testEmail = `logout${timestamp}@example.com`
    const testPassword = 'TestPassword123!'

    await page.goto('/register')
    await waitForNavigation(page)
    
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="businessName"]', 'Logout Test Business')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('/dashboard', { timeout: 10000 })
    await waitForNavigation(page)

    // Find and click logout button
    await page.click('button:has-text("Sign out")')
    
    // Should redirect to home or login
    await page.waitForURL(/^\/(login)?$/, { timeout: 10000 })
    await waitForNavigation(page)
    
    // Try to access protected page after logout
    await page.goto('/dashboard')
    await waitForNavigation(page)
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })
})