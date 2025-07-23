import { test, expect } from '@playwright/test'

test.describe('Redirect Loop Test', () => {
  test('should not create redirect loops when accessing dashboard without auth', async ({ page }) => {
    let redirectCount = 0
    const maxRedirects = 10
    
    // Track all navigations
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        redirectCount++
        console.log(`Redirect ${redirectCount}: ${frame.url()}`)
        
        if (redirectCount > maxRedirects) {
          throw new Error(`Redirect loop detected! More than ${maxRedirects} redirects occurred.`)
        }
      }
    })

    // Try to access dashboard without authentication
    await page.goto('/dashboard')
    
    // Wait for navigation to settle
    await page.waitForLoadState('networkidle')
    
    // Should end up on login page, not in a loop
    const finalUrl = page.url()
    console.log(`Final URL: ${finalUrl}`)
    
    // Verify we're on login page
    expect(finalUrl).toContain('/login')
    
    // Verify redirect count is reasonable (should be 1-2 redirects max)
    expect(redirectCount).toBeLessThanOrEqual(3)
  })

  test('should handle login and redirect to dashboard without loops', async ({ page }) => {
    // Go to login page
    await page.goto('/login')
    
    // Use one of our test users
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'test123') // You'll need to set this password
    
    let redirectCount = 0
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        redirectCount++
        console.log(`Login redirect ${redirectCount}: ${frame.url()}`)
      }
    })
    
    // Submit login form
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    try {
      await page.waitForURL(/\/(dashboard|settings)/, { timeout: 10000 })
    } catch (error) {
      console.log('Current URL:', page.url())
      // If we're on setup-organization, that's also valid
      if (page.url().includes('/dashboard')) {
        console.log('User needs to set up organization - this is expected')
      } else {
        throw error
      }
    }
    
    // Verify no redirect loops
    expect(redirectCount).toBeLessThanOrEqual(5)
  })
})