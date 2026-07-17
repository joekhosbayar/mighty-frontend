import { _electron as electron, expect, test } from '@playwright/test'

test('electron shell boots to the auth screen', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, MIGHTY_APP_URL: 'http://localhost:5199' },
  })
  const window = await app.firstWindow()
  await expect(window.getByRole('heading', { name: 'Mighty' })).toBeVisible()
  await expect(window.getByLabel('Username')).toBeVisible()
  await app.close()
})
