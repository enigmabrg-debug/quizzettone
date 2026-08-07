// PL-03/PL-06: when a critical Firebase write actually fails, the UI must
// show an explicit error (with a working retry) instead of silently
// behaving as if it had succeeded. The local emulator has no rules that
// would reject a write (FT-02 is intentionally left alone this session), so
// failures are simulated by monkey-patching db.ref(...).set()/.transaction()
// for a specific path to reject once, then removed so the retry succeeds
// for real.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

// Makes the first *actual* db.ref(path).set(...)/.transaction(...) call
// whose path contains `pathSubstring` reject with a fake error. Reads on a
// matching path must NOT consume the failure -- only a real write call does,
// checked at call time rather than at ref-creation time. Recurses through
// .child(...) too: teamSubmitAnswer (PL-06) calls
// db.ref('.../answers:<id>').child(key).transaction(...), so the write
// actually happens on a ref derived via .child(), not the one db.ref(...)
// returns directly.
async function failNextWriteTo(page, pathSubstring) {
  await page.evaluate((substr) => {
    window.__writeFailed_ = window.__writeFailed_ || {};
    // `db` is a top-level `const` in firebase-init.js: it's a reachable
    // global identifier in this page's scope, but (unlike `var`) it was
    // never installed as a `window` property, so it has to be referenced
    // directly here rather than as `window.db`.
    function wrap(ref, path) {
      if (String(path).includes(substr)) {
        const originalSet = ref.set.bind(ref);
        ref.set = (...args) => {
          if (!window.__writeFailed_[substr]) {
            window.__writeFailed_[substr] = true;
            return Promise.reject(new Error('simulated write failure'));
          }
          return originalSet(...args);
        };
        const originalTransaction = ref.transaction.bind(ref);
        ref.transaction = (...args) => {
          if (!window.__writeFailed_[substr]) {
            window.__writeFailed_[substr] = true;
            return Promise.reject(new Error('simulated write failure'));
          }
          return originalTransaction(...args);
        };
      }
      const originalChild = ref.child.bind(ref);
      ref.child = (childPath) => wrap(originalChild(childPath), path + '/' + childPath);
      return ref;
    }
    const originalRef = db.ref.bind(db);
    db.ref = (path) => wrap(originalRef(path), path);
  }, pathSubstring);
}

test('team join: a failed write shows an error banner and does not fake success', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE);
  await failNextWriteTo(page, 'sessions/current/teams');
  await page.click('#btnTeam');
  await page.fill('#teamNameInput', 'Squadra Fragile');
  await page.click('#btnJoin');

  await expect(page.locator('#errorBannerOverlay')).toBeVisible();
  await expect(page.locator('#errorBannerOverlay')).toContainText('Impossibile entrare in partita');
  // Did NOT silently proceed to the "Sei dentro!" screen.
  await expect(page.locator('h2', { hasText: 'Squadra Fragile' })).toHaveCount(0);

  await page.click('#errorBannerRetry');
  await expect(page.locator('h2', { hasText: 'Squadra Fragile' })).toBeVisible();
});

test('submit answer: a failed write shows an error banner and does not fake success', async ({ browser }) => {
  test.setTimeout(40_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Risposta');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Risposta' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(team.locator('.opt').first()).toBeVisible();

  await failNextWriteTo(team, 'sessions/current/answers');
  await team.locator('.opt').first().click();

  await expect(team.locator('#errorBannerOverlay')).toBeVisible();
  await expect(team.locator('#errorBannerOverlay')).toContainText('Invio risposta non riuscito');
  // The option must still look answerable, not a fake "sent" state.
  await expect(team.locator('.status-banner.sent')).toHaveCount(0);

  await team.click('#errorBannerRetry');
  await expect(team.locator('.status-banner.sent')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('reset partita: a failed write shows an error banner and does not fake success', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await failNextWriteTo(page, '/state');
  await page.click('#btnReset');
  // PL-05: reset now goes through a two-step backup checklist, not a plain confirm.
  await page.check('#resetCheck0');
  await page.check('#resetCheck1');
  await page.check('#resetCheck2');
  await page.click('#resetContinue');
  await page.click('#resetConfirmFinal');

  await expect(page.locator('#errorBannerOverlay')).toBeVisible();
  await expect(page.locator('#errorBannerOverlay')).toContainText('Reset non completato');

  await page.click('#errorBannerRetry');
  // The retried write is unpatched now, so it should go through for real and
  // not surface a second error banner.
  await page.waitForTimeout(800);
  await expect(page.locator('#errorBannerOverlay')).toHaveCount(0);
});
