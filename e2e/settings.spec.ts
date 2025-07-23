import { test, expect } from '@playwright/test'

test.describe('Settings Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpassword123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
    
    // Navigate to settings
    await page.goto('/settings')
  })

  test('settings navigation and sections', async ({ page }) => {
    // Settings page overview
    await expect(page).toHaveScreenshot('settings-overview.png')
    
    // General settings section
    await page.click('[data-testid="settings-nav-general"]')
    await page.waitForSelector('[data-testid="general-settings"]')
    await expect(page).toHaveScreenshot('settings-general.png')
    
    // API Keys section
    await page.click('[data-testid="settings-nav-api-keys"]')
    await page.waitForSelector('[data-testid="api-keys-section"]')
    await expect(page).toHaveScreenshot('settings-api-keys.png')
    
    // Payment processors section
    await page.click('[data-testid="settings-nav-processors"]')
    await page.waitForSelector('[data-testid="processors-section"]')
    await expect(page).toHaveScreenshot('settings-processors.png')
    
    // Team management section
    await page.click('[data-testid="settings-nav-team"]')
    await page.waitForSelector('[data-testid="team-section"]')
    await expect(page).toHaveScreenshot('settings-team.png')
  })

  test('create API key flow', async ({ page }) => {
    await page.click('[data-testid="settings-nav-api-keys"]')
    
    // Click create new key
    await page.click('[data-testid="create-api-key-button"]')
    await page.waitForSelector('[data-testid="create-key-modal"]')
    await expect(page).toHaveScreenshot('api-key-create-modal.png')
    
    // Fill key details
    await page.fill('[data-testid="key-name-input"]', 'Production API Key')
    await page.selectOption('[data-testid="key-permissions"]', 'full_access')
    await expect(page).toHaveScreenshot('api-key-create-filled.png')
    
    // Success state with key display
    await page.click('[data-testid="create-key-submit"]')
    await page.waitForSelector('[data-testid="key-created-success"]')
    await expect(page).toHaveScreenshot('api-key-created.png')
  })

  test('connect payment processor flow', async ({ page }) => {
    await page.click('[data-testid="settings-nav-processors"]')
    
    // Stripe connection
    await page.click('[data-testid="connect-stripe-button"]')
    await page.waitForSelector('[data-testid="stripe-connect-modal"]')
    await expect(page).toHaveScreenshot('stripe-connect-modal.png')
    
    // Fill credentials
    await page.fill('[data-testid="stripe-secret-key"]', 'sk_test_...')
    await page.fill('[data-testid="stripe-webhook-secret"]', 'whsec_...')
    await expect(page).toHaveScreenshot('stripe-connect-filled.png')
    
    // Connected state
    await page.click('[data-testid="connect-stripe-submit"]')
    await page.waitForSelector('[data-testid="stripe-connected"]')
    await expect(page).toHaveScreenshot('stripe-connected.png')
  })

  test('team member management', async ({ page }) => {
    await page.click('[data-testid="settings-nav-team"]')
    
    // Team members list
    await expect(page).toHaveScreenshot('team-members-list.png')
    
    // Invite member modal
    await page.click('[data-testid="invite-member-button"]')
    await page.waitForSelector('[data-testid="invite-member-modal"]')
    await expect(page).toHaveScreenshot('invite-member-modal.png')
    
    // Fill invite details
    await page.fill('[data-testid="invite-email"]', 'newmember@example.com')
    await page.selectOption('[data-testid="invite-role"]', 'admin')
    await expect(page).toHaveScreenshot('invite-member-filled.png')
    
    // Member actions menu
    await page.click('[data-testid="close-modal"]')
    await page.click('[data-testid="member-actions-0"]')
    await page.waitForSelector('[data-testid="member-actions-menu"]')
    await expect(page).toHaveScreenshot('member-actions-menu.png')
  })

  test('settings form validation states', async ({ page }) => {
    await page.click('[data-testid="settings-nav-general"]')
    
    // Clear required fields
    await page.fill('[data-testid="business-name"]', '')
    await page.fill('[data-testid="business-email"]', 'invalid-email')
    await page.click('[data-testid="save-general-settings"]')
    
    // Validation errors
    await page.waitForSelector('[data-testid="validation-errors"]')
    await expect(page).toHaveScreenshot('settings-validation-errors.png')
    
    // Success state
    await page.fill('[data-testid="business-name"]', 'Updated Business Name')
    await page.fill('[data-testid="business-email"]', 'valid@example.com')
    await page.click('[data-testid="save-general-settings"]')
    await page.waitForSelector('[data-testid="save-success"]')
    await expect(page).toHaveScreenshot('settings-save-success.png')
  })

  test('dark mode toggle', async ({ page }) => {
    // Light mode
    await expect(page).toHaveScreenshot('settings-light-mode.png')
    
    // Toggle dark mode
    await page.click('[data-testid="dark-mode-toggle"]')
    await page.waitForTimeout(300) // Wait for transition
    await expect(page).toHaveScreenshot('settings-dark-mode.png')
    
    // Verify dark mode persists on navigation
    await page.goto('/dashboard')
    await expect(page).toHaveScreenshot('dashboard-dark-mode.png')
  })
})