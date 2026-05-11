import { test, expect } from '@playwright/test'

test.describe('Account deletion', () => {
  test('full account deletion flow', async ({ page }) => {
    // 1. Register and login
    await page.goto('/register')
    const email = `delete-test-${Date.now()}@example.com`
    await page.fill('input[type="email"]', email)
    await page.fill('input[name="password"]', 'TestPass123!')
    await page.fill('input[name="confirmPassword"]', 'TestPass123!')
    await page.check('input[name="termsAccepted"]')
    await page.click('button[type="submit"]')

    // Wait for redirect after registration
    await page.waitForURL('/', { timeout: 10000 })

    // 2. Create a song
    await page.goto('/songs')
    await page.click('text=Create Song')
    await page.fill('input[name="title"]', 'Test Song')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/songs\//, { timeout: 10000 })

    // 3. Navigate to settings
    await page.click('[data-testid="user-menu-trigger"]')
    await page.click('text=Settings')
    await page.waitForURL('/settings', { timeout: 5000 })

    // 4. Change password
    await page.fill('input[name="currentPassword"]', 'TestPass123!')
    await page.fill('input[name="newPassword"]', 'NewPass456!')
    await page.fill('input[name="confirmPassword"]', 'NewPass456!')
    await page.click('button:has-text("Change Password")')
    await expect(page.locator('text=Password updated')).toBeVisible()

    // 5. Start delete account flow
    await page.click('button:has-text("Delete Account")')
    await expect(page.locator('text=Are you sure you want to delete your account?')).toBeVisible()

    // Step 1: Warning
    await page.click('text=I understand the risk, continue')

    // Step 2: Verify password
    await page.fill('input[type="password"]', 'NewPass456!')
    await page.click('text=I understand the risk, continue')

    // Step 3: Confirm DELETE
    await page.fill('input[placeholder="DELETE"]', 'DELETE')
    await page.click('text=Permanently Delete Account')

    // Wait for deletion
    await expect(page.locator('text=Account deleted successfully')).toBeVisible()

    // 6. Verify redirect to home
    await page.waitForURL('/', { timeout: 10000 })

    // 7. Verify cannot login with old credentials
    await page.goto('/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', 'NewPass456!')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })
})
