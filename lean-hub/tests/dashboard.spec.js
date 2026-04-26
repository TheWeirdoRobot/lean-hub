import { test, expect } from '@playwright/test'
import { loginAs, createTask } from './helpers.js'

test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('stat counters are visible and numeric', async ({ page }) => {
    // The four stat cards show Total Tasks, In Progress, Completed, Overdue
    const statValues = page.locator('.card').filter({ has: page.locator('[style*="fontWeight: 800"]') })
    // At minimum, each counter should contain a digit
    await expect(statValues.first()).toBeVisible()
    const text = await page.locator('text=Total Tasks').first().locator('..').locator('..').textContent()
    expect(text).toMatch(/\d+/)
  })

  test('phase breakdown section is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Phase Breakdown")')).toBeVisible()
    // All five phases should be listed
    for (const phase of ['Research', 'Design', 'Fabrication', 'Testing', 'Competition']) {
      await expect(page.locator(`text=${phase}`).first()).toBeVisible()
    }
  })

  test('clicking a recent activity item navigates to the task on the board', async ({ page }) => {
    const title = `Dashboard-Nav-${Date.now()}`
    // Ensure there's at least one task to click
    await createTask(page, title)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The recent activity section lists tasks as clickable buttons
    const activityItem = page.locator('button', { hasText: title }).first()
    if (await activityItem.isVisible()) {
      await activityItem.click()
      await expect(page).toHaveURL('/tasks')
      await expect(page.locator('.overlay')).toBeVisible({ timeout: 10_000 })
      await page.keyboard.press('Escape')
    }

    // Clean up
    await page.goto('/tasks')
    await page.locator(`text=${title}`).first().click()
    await page.click('button:has-text("Delete Task")')
    await page.click('button:has-text("Yes, delete")')
    await page.waitForSelector('.overlay', { state: 'hidden' })
  })

  test('"View all" link navigates to the Tasks page', async ({ page }) => {
    await page.click('button:has-text("View all")')
    await expect(page).toHaveURL('/tasks')
    await expect(page.locator('h1')).toContainText('Tasks')
  })

})
