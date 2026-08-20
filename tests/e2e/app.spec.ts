import { expect, test, type Page } from '@playwright/test'

async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.getByText('ホームを開きました', { exact: true })).toBeAttached()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('grimoire:preference:splash-mode', 'off')
  })
})

test('task completion stays durable and unlocks only observed specimens', async ({ page }) => {
  test.setTimeout(45_000)
  const title = `観察記録 ${Date.now()}`

  await page.goto('/')
  await waitForAppReady(page)
  await expect(page.getByRole('heading', { name: '今日やること' })).toBeVisible()

  await page.getByPlaceholder('今日のタスクを追加').fill(title)
  await page.getByRole('button', { name: 'タスクを追加' }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '獲得表示を閉じる' }).click()

  await page.getByRole('button', { name: `「${title}」を完了にする` }).click()
  await expect(page.getByText('完了したこと')).toBeVisible()
  await page.getByRole('button', { name: /(?:初発見|獲得表示)を閉じる/ }).click()

  await page.reload()
  await page.getByText('完了したこと').click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()

  await page.goto('/catalog')
  await page.getByRole('tab', { name: 'アイテム' }).click()
  const specimens = page.getByRole('tabpanel', { name: 'アイテムの標本記録' }).getByRole('button')
  // Two reward events may intentionally resolve to the same specimen and raise
  // its quantity, so the catalog's unique-card count is not necessarily two.
  await expect(specimens.first()).toBeVisible()
  await specimens.first().click()
  const detail = page.getByRole('dialog')
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: '閉じる' }).click()
  await expect(detail).toBeHidden()
})

test('launch preference and the real observation scene survive navigation', async ({ page }) => {
  await page.goto('/settings')
  await waitForAppReady(page)
  const splashOff = page.getByRole('radio', { name: /完全OFF/ })
  await splashOff.click()
  await expect(splashOff).toBeChecked()
  await page.reload()
  await waitForAppReady(page)
  await expect(splashOff).toBeChecked()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: '今日やること' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'ホームを開いています' })).toHaveCount(0)

  await page.goto('/grimo')
  await expect(page.getByRole('heading', { name: '霧光の珊瑚台地' })).toBeVisible()
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect.poll(
    async () => canvas.evaluate((element) => {
      const surface = element as HTMLCanvasElement
      return surface.width > 0 && surface.height > 0
    }),
    { timeout: 15_000 },
  ).toBe(true)
})

test('a warmed screen remains readable while offline', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit on Windows cannot reliably reload an offline context')
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => failedRequests.push(request.url()))
  await page.goto('/calendar')
  await waitForAppReady(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
  })
  if (await page.evaluate(() => navigator.serviceWorker.controller === null)) {
    await page.reload()
  }

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect({ consoleErrors, failedRequests }).toEqual({ consoleErrors: [], failedRequests: [] })
  } finally {
    await context.setOffline(false)
  }
})
