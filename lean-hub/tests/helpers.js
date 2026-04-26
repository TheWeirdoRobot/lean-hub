export const TEST_EMAIL    = 'test@leanhub.com'
export const TEST_PASSWORD = 'TestPass123!'

/**
 * Navigate to /login, fill credentials, submit, and wait for the dashboard URL.
 * Assumes the test account already exists (created by the auth.spec.js beforeAll
 * or seeded manually via the Supabase dashboard).
 */
export async function loginAs(page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login')
  await page.fill('#login-email', email)
  await page.fill('#login-password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15_000 })
}

/**
 * Open the New Task modal, fill title + phase, and submit.
 * Waits for the modal to close before returning.
 */
export async function createTask(page, title, phase = 'Research') {
  await page.click('button:has-text("New Task")')
  await page.fill('#task-title', title)
  await page.selectOption('#task-phase', phase)
  await page.click('button:has-text("Create Task")')
  await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })
}
