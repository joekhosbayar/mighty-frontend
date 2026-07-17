import { expect, test } from '@playwright/test'
import { spawnBots } from './bots/spawn'

test('a browser player and four bots complete a full hand', async ({ page }) => {
  const name = `e2e_${Date.now()}`

  // Sign up and land in the lobby.
  await page.goto('/')
  await page.getByRole('button', { name: 'Need an account? Sign up' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByLabel('Password').fill('secret123')
  await page.getByLabel('Email').fill(`${name}@e2e.local`)
  await page.getByRole('button', { name: 'Sign up' }).click()

  // Create a game and read its id from the table header.
  await page.getByRole('button', { name: 'Create game' }).click()
  await expect(page.getByTestId('game-id')).toBeVisible()
  const gameId = (await page.getByTestId('game-id').textContent())!

  // Fill the remaining 4 seats; bot 0 opens the bidding with 3 clubs.
  const bots = await spawnBots(gameId, 4)

  // Surface any in-page errors and WS traffic in the test log.
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[page error] ${msg.text()}`)
  })
  page.on('websocket', ws => {
    ws.on('framesent', f => console.log(`[ws →] ${String(f.payload).slice(0, 120)}`))
  })

  // Drive the browser: pass in bidding, play the first enabled card, decline
  // joker calls, until the scoreboard appears. Bots handle declarer duties.
  const scoreboard = page.getByTestId('scoreboard')
  const deadline = Date.now() + 210_000
  let lastStatus = ''
  while (!(await scoreboard.isVisible()) && Date.now() < deadline) {
    const s = await page
      .evaluate(() => ({
        phase: document.querySelector('[data-testid="phase"]')?.textContent ?? '?',
        alert: document.querySelector('[role="alert"]')?.textContent ?? '-',
        conn: document.querySelector('[role="status"]')?.textContent ?? '-',
        enabled: document.querySelectorAll('[data-testid="hand"] button:not([disabled])').length,
      }))
      .catch(() => null)
    if (s) {
      const status = `phase=${s.phase} enabled=${s.enabled} conn=${s.conn} alert=${s.alert}`
      if (status !== lastStatus) {
        console.log(`[state] ${status}`)
        lastStatus = status
      }
    }
    const noCall = page.getByRole('button', { name: 'Play without calling' })
    if (await noCall.isVisible().catch(() => false)) {
      console.log('[loop] declining joker call')
      await noCall.click({ timeout: 2000 }).catch(() => undefined)
      continue
    }
    const pass = page.getByRole('button', { name: 'Pass' }).and(page.locator(':enabled'))
    if ((await pass.count()) > 0) {
      console.log('[loop] passing')
      await pass.click({ timeout: 2000 }).catch(() => undefined)
      continue
    }
    const card = page.locator('[data-testid="hand"] button:enabled').first()
    if ((await card.count()) > 0) {
      console.log('[loop] clicking a card')
      await card.click({ timeout: 2000 }).catch(e => console.log(`[loop] click failed: ${String(e).slice(0, 80)}`))
    }
    await page.waitForTimeout(300)
  }

  await expect(scoreboard).toBeVisible()
  await expect(page.getByText(/contract: 3 clubs/i)).toBeVisible()
  bots.stop()
})
