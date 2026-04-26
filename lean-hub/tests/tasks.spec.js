import { test, expect } from '@playwright/test'
import { loginAs, createTask } from './helpers.js'

const UNIQUE = () => `PW-Task-${Date.now()}`

test.describe('Task management', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page)
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
  })

  test('can create a new task with all fields filled', async ({ page }) => {
    const title = UNIQUE()
    await page.click('button:has-text("New Task")')
    await page.fill('#task-title', title)
    await page.fill('#task-description', 'Playwright created this task.')
    await page.selectOption('#task-status', 'not_started')
    await page.selectOption('#task-priority', 'high')
    await page.selectOption('#task-phase', 'Design')
    await page.fill('#task-start', '2026-06-01')
    await page.fill('#task-end', '2026-06-30')
    await page.click('button:has-text("Create Task")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })
    await expect(page.locator(`text=${title}`)).toBeVisible()
  })

  test('created task appears in the correct kanban column', async ({ page }) => {
    const title = UNIQUE()
    // Create a task with status "In Progress"
    await page.click('button:has-text("New Task")')
    await page.fill('#task-title', title)
    await page.selectOption('#task-status', 'in_progress')
    await page.click('button:has-text("Create Task")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })

    // Find the "In Progress" column and confirm the card is inside it
    const inProgressColumn = page.locator('text=In Progress').locator('../..')
    await expect(inProgressColumn.locator(`text=${title}`)).toBeVisible()
  })

  test('can drag a task card to a different column', async ({ page }) => {
    const title = UNIQUE()
    await createTask(page, title, 'Research')
    await page.waitForSelector(`text=${title}`)

    // Locate the card and the "In Progress" column drop zone
    const card = page.locator('div', { hasText: title }).filter({ has: page.locator('text=Research') }).first()
    const targetColumn = page.locator('[data-rbd-droppable-id="in_progress"]')

    const cardBox = await card.boundingBox()
    const targetBox = await targetColumn.boundingBox()

    // Mouse-drag sequence compatible with @hello-pangea/dnd
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(300)
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 40, { steps: 10 })
    await page.waitForTimeout(100)
    await page.mouse.up()

    // After drop, card should appear in In Progress column
    await expect(targetColumn.locator(`text=${title}`)).toBeVisible({ timeout: 5_000 })
  })

  test('can open a task and edit its title', async ({ page }) => {
    const original = UNIQUE()
    const updated  = `${original}-edited`
    await createTask(page, original)
    await page.locator(`text=${original}`).first().click()
    await page.waitForSelector('.overlay')
    await page.fill('#task-title', updated)
    await page.click('button:has-text("Save Changes")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })
    await expect(page.locator(`text=${updated}`)).toBeVisible()
  })

  test('can delete a task and it disappears from the board', async ({ page }) => {
    const title = UNIQUE()
    await createTask(page, title)
    await page.locator(`text=${title}`).first().click()
    await page.waitForSelector('.overlay')
    await page.click('button:has-text("Delete Task")')
    await page.click('button:has-text("Yes, delete")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })
    await expect(page.locator(`text=${title}`)).not.toBeVisible()
  })

  test('deleted task does not reappear on the Gantt chart page', async ({ page }) => {
    const title = UNIQUE()
    // Create with dates so it would show on Gantt
    await page.click('button:has-text("New Task")')
    await page.fill('#task-title', title)
    await page.fill('#task-start', '2026-07-01')
    await page.fill('#task-end', '2026-07-15')
    await page.click('button:has-text("Create Task")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })

    // Delete it
    await page.locator(`text=${title}`).first().click()
    await page.waitForSelector('.overlay')
    await page.click('button:has-text("Delete Task")')
    await page.click('button:has-text("Yes, delete")')
    await page.waitForSelector('.overlay', { state: 'hidden', timeout: 10_000 })

    // Navigate to Gantt and confirm task is absent
    await page.click('text=Gantt Chart')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`text=${title}`)).not.toBeVisible()
  })

})
