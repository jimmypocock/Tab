import { test, expect } from '@playwright/test'

test.describe('Authentication Visual Tests', () => {
  test('login page visual states', async ({ page }) => {
    await page.goto('/login')
    
    // Initial login page
    await expect(page).toHaveScreenshot('login-page-empty.png')
    
    // Focus states
    await page.focus('[data-testid="email-input"]')
    await expect(page).toHaveScreenshot('login-email-focused.png')
    
    // Filled form
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await expect(page).toHaveScreenshot('login-page-filled.png')
    
    // Error state
    await page.click('[data-testid="login-button"]')
    await page.waitForSelector('[data-testid="login-error"]')
    await expect(page).toHaveScreenshot('login-page-error.png')
    
    // Loading state
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="login-button"]')
      if (button) {
        button.textContent = 'Logging in...'
        button.setAttribute('disabled', 'true')
      }
    })
    await expect(page).toHaveScreenshot('login-page-loading.png')
  })

  test('registration page visual states', async ({ page }) => {
    await page.goto('/register')
    
    // Initial registration page
    await expect(page).toHaveScreenshot('register-page-empty.png')
    
    // Fill form partially
    await page.fill('[data-testid="business-name-input"]', 'Test Business')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await expect(page).toHaveScreenshot('register-page-partial.png')
    
    // Password strength indicator
    await page.fill('[data-testid="password-input"]', 'weak')
    await expect(page.locator('[data-testid="password-strength"]')).toHaveScreenshot('password-strength-weak.png')
    
    await page.fill('[data-testid="password-input"]', 'StrongPassword123!')
    await expect(page.locator('[data-testid="password-strength"]')).toHaveScreenshot('password-strength-strong.png')
    
    // Terms checkbox interaction
    await page.click('[data-testid="terms-checkbox"]')
    await expect(page).toHaveScreenshot('register-page-complete.png')
  })

  test('password reset flow', async ({ page }) => {
    await page.goto('/login')
    
    // Click forgot password
    await page.click('[data-testid="forgot-password-link"]')
    await page.waitForURL('/auth/forgot-password')
    
    // Password reset form
    await expect(page).toHaveScreenshot('forgot-password-empty.png')
    
    // Fill email
    await page.fill('[data-testid="reset-email-input"]', 'test@example.com')
    await expect(page).toHaveScreenshot('forgot-password-filled.png')
    
    // Success state
    await page.click('[data-testid="send-reset-button"]')
    await page.waitForSelector('[data-testid="reset-success"]')
    await expect(page).toHaveScreenshot('forgot-password-success.png')
  })

  test('logout confirmation modal', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // Click logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')
    
    // Logout confirmation modal
    await page.waitForSelector('[data-testid="logout-confirm-modal"]')
    await expect(page).toHaveScreenshot('logout-confirmation.png')
  })

  test('auth pages responsive design', async ({ page }) => {
    // Test login page on different viewports
    await page.goto('/login')
    
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page).toHaveScreenshot('login-desktop.png')
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page).toHaveScreenshot('login-tablet.png')
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page).toHaveScreenshot('login-mobile.png')
  })
})