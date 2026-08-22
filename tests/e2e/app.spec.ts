import { expect, test, type Page } from '@playwright/test'

/**
 * These run against the rebuilt UI (T023). They deliberately drive the screens
 * the way a person does — the visible control, the accessible name — rather
 * than through test ids, so a change that breaks the label breaks the test.
 */
async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.getByText('ホームを開きました', { exact: true })).toBeAttached()
}

async function writeTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: '今日のタスクを書く' }).click()
  const editor = page.getByRole('dialog', { name: '今日のタスクを書く' })
  await editor.getByLabel('タイトル').fill(title)
  await editor.getByRole('button', { name: '書き留める' }).click()
  await expect(editor).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('grimoire:preference:splash-mode', 'off')
  })
})

test('a written task survives a reload and its reward reaches the catalog', async ({ page }) => {
  test.setTimeout(45_000)
  const title = `観察記録 ${Date.now()}`

  await page.goto('/')
  await waitForAppReady(page)

  await writeTask(page, title)
  await expect(page.getByText(title, { exact: true })).toBeVisible()

  await page.getByRole('checkbox', { name: `${title}を完了にする` }).click()
  const completed = page.getByRole('button', { name: /^完了 \d+$/ })
  await expect(completed).toBeVisible()

  await page.reload()
  await waitForAppReady(page)
  await page.getByRole('button', { name: /^完了 \d+$/ }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()

  await page.goto('/catalog')
  await waitForAppReady(page)
  // Two reward events can resolve to the same specimen and raise its quantity,
  // so the grid's card count is not necessarily two.
  const specimens = page.getByRole('list').getByRole('button')
  await expect(specimens.first()).toBeVisible()
  await specimens.first().click()

  const record = page.getByRole('dialog')
  await expect(record).toBeVisible()
  await record.getByRole('button', { name: '図鑑へ戻る' }).click()
  await expect(record).toBeHidden()

  // 決定事項ログ M-10: the catalog never states how much has not been found.
  await expect(page.getByText(/\d+\s*\/\s*\d+/)).toHaveCount(0)
})

test('an empty title is refused without closing the editor', async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: '今日のタスクを書く' }).click()
  const editor = page.getByRole('dialog', { name: '今日のタスクを書く' })
  await editor.getByRole('button', { name: '書き留める' }).click()

  await expect(editor).toBeVisible()
  await expect(editor.getByText('タイトルを入力してください。')).toBeVisible()
})

test('the launch preference persists and the world opens without footage', async ({ page }) => {
  await page.goto('/settings')
  await waitForAppReady(page)

  const scheme = page.getByRole('group', { name: '配色' })
  await scheme.getByRole('radio', { name: '暗い' }).click()
  await page.reload()
  await waitForAppReady(page)
  await expect(scheme.getByRole('radio', { name: '暗い' })).toBeChecked()

  const splash = page.getByRole('group', { name: '起動時の紋章' })
  await expect(splash.getByRole('radio', { name: '表示しない' })).toBeChecked()

  await page.goto('/')
  await expect(page.getByRole('status', { name: 'ホームを開いています' })).toHaveCount(0)

  // The owner's footage may not be installed; the area still opens, because the
  // world degrades to its poster/ambience layer rather than failing (D-013).
  await page.goto('/grimo')
  await waitForAppReady(page)
  await expect(page.getByText('陸珊瑚の台地')).toBeVisible()
  await page.getByRole('button', { name: 'エリアを選ぶ' }).click()
  const picker = page.getByRole('dialog', { name: 'エリア' })
  await expect(picker).toBeVisible()
  await picker.getByRole('button', { name: 'エリアを閉じる' }).click()
  await expect(picker).toBeHidden()
})

test('every screen is reachable from the bottom navigation', async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)

  const navigation = page.getByRole('navigation', { name: 'メインナビゲーション' })
  for (const [label, path] of [
    ['カレンダー', '/calendar'],
    ['図鑑', '/catalog'],
    ['設定', '/settings'],
    ['ホーム', '/'],
  ] as const) {
    await navigation.getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`))
    await expect(page.locator('#main-content')).toBeVisible()
  }
})

test('a warmed screen remains readable while offline', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit on Windows cannot reliably reload an offline context',
  )
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
    expect({ consoleErrors, failedRequests }).toEqual({
      consoleErrors: [],
      failedRequests: [],
    })
  } finally {
    await context.setOffline(false)
  }
})
