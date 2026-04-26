/**
 * Playwright global setup — runs once before the entire test suite.
 * Verifies that the Vite dev server is reachable so tests don't silently
 * fail due to a missing server rather than an actual application bug.
 */
export default async function globalSetup() {
  const url     = 'http://localhost:5173'
  const retries = 10
  const delay   = 1_000

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3_000) })
      if (res.ok || res.status === 304) {
        console.log(`[global-setup] Dev server ready at ${url}`)
        return
      }
    } catch {
      // Server not up yet
    }
    if (i < retries - 1) {
      console.log(`[global-setup] Waiting for dev server… (attempt ${i + 1}/${retries})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  throw new Error(`[global-setup] Dev server did not become available at ${url} after ${retries} attempts. Run "npm run dev" before running tests, or check the webServer config in playwright.config.js.`)
}
