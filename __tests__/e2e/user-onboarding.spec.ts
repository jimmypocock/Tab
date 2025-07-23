import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Test the complete user onboarding flow
test.describe('User Onboarding Flow', () => {
  let testEmail: string
  let supabase: any

  test.beforeEach(async () => {
    // Generate unique test email
    testEmail = `test-${Date.now()}@example.com`
    
    // Create Supabase client for cleanup
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  })

  test.afterEach(async () => {
    // Clean up test user
    if (supabase && testEmail) {
      const { data: user } = await supabase.auth.admin.listUsers()
      const testUser = user?.users.find((u: any) => u.email === testEmail)
      
      if (testUser) {
        // Delete user and related data
        await supabase.auth.admin.deleteUser(testUser.id)
        
        // Delete organization
        await supabase
          .from('organization_users')
          .delete()
          .eq('user_id', testUser.id)
        
        await supabase
          .from('organizations')
          .delete()
          .eq('created_by', testUser.id)
      }
    }
  })

  test('complete signup → email confirmation → dashboard access', async ({ page }) => {
    // Step 1: Navigate to registration page
    await page.goto('/register')
    
    // Fill in registration form
    await page.fill('input[id="business-name"]', 'Test Business E2E')
    await page.fill('input[id="email"]', testEmail)
    await page.fill('input[id="password"]', 'TestPassword123!')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to email confirmation page
    await expect(page).toHaveURL(/\/confirm-email/)
    await expect(page.locator('text=Check your email')).toBeVisible()
    
    // Step 2: Simulate email confirmation (in real test, would click email link)
    // For now, we'll manually confirm the user
    const { data: users } = await supabase.auth.admin.listUsers()
    const newUser = users?.users.find((u: any) => u.email === testEmail)
    
    expect(newUser).toBeTruthy()
    
    // Manually confirm email (simulating clicking the link)
    await supabase.auth.admin.updateUserById(newUser.id, {
      email_confirm: true
    })
    
    // Step 3: Navigate to email confirmed page
    await page.goto('/email-confirmed')
    
    // Should auto-redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 })
    
    // Step 4: Verify dashboard loads without errors
    await expect(page.locator('text=Critical: User has no organization')).not.toBeVisible()
    
    // Should see dashboard content
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('team settings page loads with organization context', async ({ page }) => {
    // Create a test user with organization (simulate completed onboarding)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          businessName: 'Test Team Business',
        },
      },
    })
    
    expect(authError).toBeNull()
    
    // Confirm email
    await supabase.auth.admin.updateUserById(authData.user.id, {
      email_confirm: true
    })
    
    // Login
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', 'TestPassword123!')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard
    await page.waitForURL('/dashboard')
    
    // Navigate to team settings
    await page.click('a[href="/settings/team"]')
    
    // Verify page loads without skeleton screens
    await expect(page.locator('.animate-pulse')).not.toBeVisible({ timeout: 5000 })
    
    // Should see team content
    await expect(page.locator('h1:has-text("Team Members")')).toBeVisible()
    
    // Should show the current user as owner
    await expect(page.locator('text=Owner')).toBeVisible()
  })

  test('organization is created on signup', async ({ page }) => {
    // Sign up
    await page.goto('/register')
    await page.fill('input[id="business-name"]', 'Organization Test Business')
    await page.fill('input[id="email"]', testEmail)
    await page.fill('input[id="password"]', 'TestPassword123!')
    await page.click('button[type="submit"]')
    
    // Get the user
    const { data: users } = await supabase.auth.admin.listUsers()
    const newUser = users?.users.find((u: any) => u.email === testEmail)
    
    // Check organization was created
    const { data: orgUsers } = await supabase
      .from('organization_users')
      .select('*, organizations(*)')
      .eq('user_id', newUser.id)
      .single()
    
    expect(orgUsers).toBeTruthy()
    expect(orgUsers.organizations.name).toBe('Organization Test Business')
    expect(orgUsers.organizations.is_merchant).toBe(true)
    expect(orgUsers.role).toBe('owner')
    expect(orgUsers.status).toBe('active')
  })
})