// PL-02: if the first Firebase snapshot never arrives, the app must show a
// loading state, then a clear timeout error with a working retry -- never a
// blank page. render() gates on `!state` the same way for every role (Team/
// Admin/Display all fall through the identical renderBootScreen() branch
// before the role-specific one), so a single thorough run on Admin is enough
// to cover the shared mechanism instead of repeating the same wait 3x.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('boot timeout shows an error with a working retry instead of a blank page', async ({ browser }) => {
  test.setTimeout(40_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // The PIN screen itself needs no Firebase call, so it's safe to load first...
  await page.goto(BASE + '&role=admin');
  await expect(page.locator('#adminPinInput')).toBeVisible();

  // ...then go offline before confirming the PIN, so startListening() (fired
  // by the confirm click) never gets a first snapshot.
  await ctx.setOffline(true);
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');

  // Immediately: a loading state, not a blank #app.
  await expect(page.locator('#app')).toContainText('Connessione in corso');

  // After BOOT_TIMEOUT_MS (8s): an explicit error with a retry button.
  await expect(page.locator('#app')).toContainText('Connessione non riuscita', { timeout: 12_000 });
  const retryBtn = page.locator('#btnBootRetry');
  await expect(retryBtn).toBeVisible();

  // Retry actually recovers once connectivity comes back.
  await ctx.setOffline(false);
  await retryBtn.click();
  await expect(page.locator('#setupGameName')).toBeVisible({ timeout: 10_000 });

  await ctx.close();
});
