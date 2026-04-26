import { test, expect } from '@playwright/test'
import { loginAs } from './helpers.js'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.describe('File management', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page)
    await page.goto('/files')
    await page.waitForLoadState('networkidle')
  })

  test('file upload button is present on the Files page', async ({ page }) => {
    // The Files page should have an upload button or input
    const uploadTrigger = page.locator('button:has-text("Upload")').or(
      page.locator('button:has-text("Attach")').or(
        page.locator('input[type="file"]')
      )
    )
    await expect(uploadTrigger.first()).toBeAttached()
  })

  test('can upload a small test file and it appears in the list', async ({ page }) => {
    // Write a temp file to disk
    const tmpPath = path.join(os.tmpdir(), `pw-test-${Date.now()}.txt`)
    fs.writeFileSync(tmpPath, 'Playwright upload test — LEAN Hub')

    try {
      // Set file on the hidden file input
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(tmpPath)
      // Wait for the upload to complete (spinner disappears or file name appears)
      await page.waitForTimeout(3_000)
      const fileName = path.basename(tmpPath)
      await expect(page.locator(`text=${fileName}`)).toBeVisible({ timeout: 15_000 })
    } finally {
      fs.unlinkSync(tmpPath)
    }
  })

})
