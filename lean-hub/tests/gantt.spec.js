import { test, expect } from '@playwright/test'
import { loginAs } from './helpers.js'

test.describe('Gantt chart', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('Gantt page loads without errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/gantt')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toContainText('Gantt Chart')
    expect(errors).toHaveLength(0)
  })

  test('tasks with start and end dates appear as bars on the chart', async ({ page }) => {
    // First create a task with dates via the Tasks page
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("New Task")')
    const title = `Gantt-Bar-${Date.now()}`
    await page.fill('#task-title', title)
    await page.fill('#task-start', '2026-07-01')
    await page.fill('#task-end', '2026-07-20')
    await page.click('button:has-text("Create Task")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })

    // Navigate to Gantt — task should appear as a labeled bar
    // (title appears in both the left panel and the SVG bar label, so use first())
    await page.goto('/gantt')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 10_000 })

    // Clean up
    await page.goto('/tasks')
    await page.locator(`text=${title}`).first().click()
    await page.click('button:has-text("Delete Task")')
    await page.click('button:has-text("Yes, delete")')
    await page.waitForSelector('.overlay', { state: 'hidden' })
  })

  test('tasks without dates do not appear on the Gantt', async ({ page }) => {
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("New Task")')
    const title = `NoDate-${Date.now()}`
    await page.fill('#task-title', title)
    // Intentionally leave start/end dates empty
    await page.click('button:has-text("Create Task")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })

    await page.goto('/gantt')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`text=${title}`)).not.toBeVisible()

    // Clean up
    await page.goto('/tasks')
    await page.locator(`text=${title}`).first().click()
    await page.click('button:has-text("Delete Task")')
    await page.click('button:has-text("Yes, delete")')
    await page.waitForSelector('.overlay', { state: 'hidden' })
  })

  test('page refresh does not return 404', async ({ page }) => {
    await page.goto('/gantt')
    await page.reload()
    await expect(page.locator('h1')).toContainText('Gantt Chart')
    await expect(page.locator('text=404')).not.toBeVisible()
  })

})
