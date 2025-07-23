import { test, expect } from '@playwright/test'

// Test data
const organizationOwner = {
  email: 'owner@example.com',
  password: 'TestPassword123!'
}

const newTeamMember = {
  email: 'newmember@example.com',
  password: 'NewMember123!',
  fullName: 'New Team Member'
}

test.describe('Team Invitation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')
  })

  test('complete team invitation journey', async ({ page, context }) => {
    // Step 1: Login as organization owner
    await page.fill('input[name="email"]', organizationOwner.email)
    await page.fill('input[name="password"]', organizationOwner.password)
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await page.waitForURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')

    // Step 2: Navigate to team settings
    await page.click('a[href="/settings/team"]')
    await page.waitForURL('/settings/team')
    await expect(page.locator('h1')).toContainText('Team Members')

    // Step 3: Open invitation form
    await page.click('button:has-text("Invite Member")')
    await expect(page.locator('h3')).toContainText('Invite Team Member')

    // Step 4: Fill and send invitation
    await page.fill('input[type="email"]', newTeamMember.email)
    await page.selectOption('select#role', 'member')
    await page.click('button:has-text("Send Invitation")')

    // Step 5: Verify invitation appears in pending list
    await expect(page.locator('text=Pending invitation')).toBeVisible()
    await expect(page.locator(`text=${newTeamMember.email}`)).toBeVisible()

    // Step 6: Copy invitation link (in real scenario, this would be from email)
    // For testing, we'll simulate by constructing the URL
    const invitationToken = 'test-invitation-token' // In real test, extract from API/database

    // Step 7: Open new browser context for invited user
    const newUserContext = await context.browser()?.newContext()
    if (!newUserContext) throw new Error('Failed to create new context')
    
    const newUserPage = await newUserContext.newPage()
    
    // Step 8: Navigate to invitation acceptance page
    await newUserPage.goto(`/auth/accept-invitation?token=${invitationToken}`)
    await expect(newUserPage.locator('h2')).toContainText('Accept Team Invitation')

    // Step 9: Create account as new user
    await newUserPage.fill('input[name="full-name"]', newTeamMember.fullName)
    await newUserPage.fill('input[name="email"]', newTeamMember.email)
    await newUserPage.fill('input[name="password"]', newTeamMember.password)
    await newUserPage.click('button:has-text("Sign up and Accept")')

    // Step 10: Verify redirect to dashboard
    await newUserPage.waitForURL('/dashboard')
    await expect(newUserPage.locator('h1')).toContainText('Dashboard')

    // Step 11: Verify new member can see organization
    const orgSwitcher = newUserPage.locator('[data-testid="organization-switcher"]')
    await expect(orgSwitcher).toBeVisible()

    // Step 12: Go back to owner's page and verify member appears as active
    await page.reload()
    await expect(page.locator(`text=${newTeamMember.email}`)).toBeVisible()
    await expect(page.locator('text=Member')).toBeVisible()
    
    // Verify pending invitation is gone
    await expect(page.locator('text=Pending invitation')).not.toBeVisible()

    // Cleanup
    await newUserContext.close()
  })

  test('resend invitation', async ({ page }) => {
    // Login as owner
    await page.fill('input[name="email"]', organizationOwner.email)
    await page.fill('input[name="password"]', organizationOwner.password)
    await page.click('button[type="submit"]')

    // Navigate to team settings
    await page.goto('/settings/team')

    // Find pending invitation and click resend
    const pendingRow = page.locator('li:has-text("Pending invitation")')
    await pendingRow.locator('button:has-text("Resend")').click()

    // Verify success message
    await expect(page.locator('text=Invitation resent successfully')).toBeVisible()
  })

  test('cancel invitation', async ({ page }) => {
    // Login as owner
    await page.fill('input[name="email"]', organizationOwner.email)
    await page.fill('input[name="password"]', organizationOwner.password)
    await page.click('button[type="submit"]')

    // Navigate to team settings
    await page.goto('/settings/team')

    // Find pending invitation and click cancel
    const pendingRow = page.locator('li:has-text("Pending invitation")')
    await pendingRow.locator('button:has-text("Cancel")').click()

    // Verify invitation is removed
    await expect(pendingRow).not.toBeVisible()
  })

  test('existing user accepts invitation', async ({ page, context }) => {
    const existingUser = {
      email: 'existing@example.com',
      password: 'Existing123!'
    }

    // Login as owner and send invitation
    await page.fill('input[name="email"]', organizationOwner.email)
    await page.fill('input[name="password"]', organizationOwner.password)
    await page.click('button[type="submit"]')

    await page.goto('/settings/team')
    await page.click('button:has-text("Invite Member")')
    await page.fill('input[type="email"]', existingUser.email)
    await page.selectOption('select#role', 'admin')
    await page.click('button:has-text("Send Invitation")')

    // Simulate existing user accepting invitation
    const existingUserContext = await context.browser()?.newContext()
    if (!existingUserContext) throw new Error('Failed to create new context')
    
    const existingUserPage = await existingUserContext.newPage()
    
    // Navigate to invitation page
    const invitationToken = 'test-existing-user-token'
    await existingUserPage.goto(`/auth/accept-invitation?token=${invitationToken}`)

    // Sign in as existing user
    await existingUserPage.click('button:has-text("Already have an account? Sign in")')
    await existingUserPage.fill('input[name="email"]', existingUser.email)
    await existingUserPage.fill('input[name="password"]', existingUser.password)
    await existingUserPage.click('button:has-text("Sign in and Accept")')

    // Verify acceptance
    await expect(existingUserPage.locator('h2')).toContainText('Invitation Accepted!')
    await existingUserPage.waitForURL('/dashboard')

    // Cleanup
    await existingUserContext.close()
  })

  test('remove team member', async ({ page }) => {
    // Login as owner
    await page.fill('input[name="email"]', organizationOwner.email)
    await page.fill('input[name="password"]', organizationOwner.password)
    await page.click('button[type="submit"]')

    // Navigate to team settings
    await page.goto('/settings/team')

    // Find a non-owner member
    const memberRow = page.locator('li:has-text("admin@example.com")')
    
    // Click more options
    await memberRow.locator('button[aria-label*="More"]').click()
    
    // Click remove member
    await page.click('button:has-text("Remove Member")')

    // Confirm removal
    page.on('dialog', dialog => dialog.accept())

    // Verify member is removed
    await expect(memberRow).not.toBeVisible()
  })

  test('role-based access control', async ({ page }) => {
    const viewerUser = {
      email: 'viewer@example.com',
      password: 'Viewer123!'
    }

    // Login as viewer
    await page.fill('input[name="email"]', viewerUser.email)
    await page.fill('input[name="password"]', viewerUser.password)
    await page.click('button[type="submit"]')

    // Navigate to team settings
    await page.goto('/settings/team')

    // Verify viewer cannot invite members
    await expect(page.locator('button:has-text("Invite Member")')).not.toBeVisible()

    // Verify viewer cannot see action buttons for other members
    await expect(page.locator('button[aria-label*="More"]')).not.toBeVisible()
  })

  test('invitation expiry', async ({ page }) => {
    // Navigate to expired invitation link
    const expiredToken = 'expired-token-123'
    await page.goto(`/auth/accept-invitation?token=${expiredToken}`)

    // Verify error message
    await expect(page.locator('h2')).toContainText('Invalid Invitation')
    await expect(page.locator('text=Invalid or expired invitation')).toBeVisible()
    
    // Verify link to login
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
})

test.describe('Team Management Permissions', () => {
  test('admin can manage team but not remove owner', async ({ page }) => {
    const adminUser = {
      email: 'admin@example.com',
      password: 'Admin123!'
    }

    // Login as admin
    await page.goto('/login')
    await page.fill('input[name="email"]', adminUser.email)
    await page.fill('input[name="password"]', adminUser.password)
    await page.click('button[type="submit"]')

    // Navigate to team settings
    await page.goto('/settings/team')

    // Verify admin can invite members
    await expect(page.locator('button:has-text("Invite Member")')).toBeVisible()

    // Verify admin cannot remove owner
    const ownerRow = page.locator('li:has-text("owner@example.com")')
    await expect(ownerRow.locator('button[aria-label*="More"]')).not.toBeVisible()

    // Verify admin can manage other members
    const memberRow = page.locator('li:has-text("member@example.com")')
    await expect(memberRow.locator('button[aria-label*="More"]')).toBeVisible()
  })

  test('member cannot access team management', async ({ page }) => {
    const memberUser = {
      email: 'member@example.com',
      password: 'Member123!'
    }

    // Login as member
    await page.goto('/login')
    await page.fill('input[name="email"]', memberUser.email)
    await page.fill('input[name="password"]', memberUser.password)
    await page.click('button[type="submit"]')

    // Navigate to team settings
    await page.goto('/settings/team')

    // Verify member cannot invite
    await expect(page.locator('button:has-text("Invite Member")')).not.toBeVisible()

    // Verify member cannot see action buttons
    await expect(page.locator('button[aria-label*="More"]')).not.toBeVisible()
  })
})