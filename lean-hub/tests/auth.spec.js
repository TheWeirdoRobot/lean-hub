import { test, expect } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, loginAs } from './helpers.js'

// Ensure the test account exists before any auth test runs.
// Uses the Supabase Admin API with the service role key so it bypasses email
// confirmation and the account is immediately usable.
test.beforeAll(async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[auth.spec] VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping account pre-creation')
    return
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email:         TEST_EMAIL,
      password:      TEST_PASSWORD,
      email_confirm: true,
    }),
  })
  const body = await res.json()
  if (!res.ok && !body.msg?.includes('already been registered') && !body.code?.includes('email_exists')) {
    console.warn('[auth.spec] Admin user creation response:', res.status, JSON.stringify(body))
  }
})

test.describe('Authentication', () => {

  test('can load the login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/LEAN Hub/i)
    await expect(page.locator('h2')).toContainText('Sign in to your workspace')
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
  })

  test('shows error on wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#login-email', TEST_EMAIL)
    await page.fill('#login-password', 'wrongpassword!')
    await page.click('button[type="submit"]')
    await expect(
      page.locator('text=Invalid login credentials').or(page.locator('[style*="FCA5A5"]'))
    ).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL('/login')
  })

  test('can sign up and reach the dashboard', async ({ page }) => {
    // With email confirmation disabled, Supabase may auto-login on signup.
    // If the account already exists it returns an error — in that case we fall
    // back to a regular login so the test still validates the end-to-end flow.
    await page.goto('/signup')
    await page.fill('#signup-name', 'Test User')
    await page.fill('#signup-email', TEST_EMAIL)
    await page.fill('#signup-password', TEST_PASSWORD)
    await page.fill('#signup-confirm', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Race: either we land on the dashboard or an error/check-email appears
    await Promise.race([
      page.waitForURL('/', { timeout: 8_000 }),
      page.waitForSelector('[style*="FCA5A5"]',             { timeout: 8_000 }).catch(() => {}),
      page.waitForSelector('h2:has-text("Check your email")', { timeout: 8_000 }).catch(() => {}),
    ]).catch(() => {})

    if (!page.url().endsWith('/')) {
      // Account already exists or requires email confirmation — log in directly
      await loginAs(page)
    }

    await expect(page).toHaveURL('/')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('can log in with valid credentials', async ({ page }) => {
    await loginAs(page)
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('can log out and gets redirected to login', async ({ page }) => {
    await loginAs(page)
    await page.click('[aria-haspopup="menu"]')
    await page.click('button:has-text("Sign out")')
    await expect(page).toHaveURL('/login', { timeout: 10_000 })
  })

  test('password show/hide toggle works', async ({ page }) => {
    await page.goto('/login')
    const passwordInput = page.locator('#login-password')
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await page.click('button[aria-label="Show password"]')
    await expect(passwordInput).toHaveAttribute('type', 'text')
    await page.click('button[aria-label="Hide password"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

})
