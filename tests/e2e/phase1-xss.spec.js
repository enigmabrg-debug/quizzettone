// PL-01: a team name containing HTML/script must never be interpreted as
// markup anywhere it's rendered (own lobby screen, Admin lobby, and the
// classifica -- rankRows() was the worst offender before this fix, since
// it's reused by nearly every standings screen on Team/Display/Admin).
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
// Short enough to survive the 24-char maxlength on #teamNameInput. If this
// ever renders as real markup instead of text, the visible label collapses
// to just "xss" (bold, no visible angle brackets) and a real <b> element
// shows up in the DOM -- both checked below.
const XSS_NAME = '<b>xss</b>';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

async function expectRenderedAsText(locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toContainText(XSS_NAME);
  expect(await locator.locator('b').count()).toBe(0);
}

test('a malicious team name is rendered as text, never as markup, on Team/Admin/classifica', async ({ browser }) => {
  test.setTimeout(60_000);
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
  await team.fill('#teamNameInput', XSS_NAME);
  await team.click('#btnJoin');

  // Team's own "Sei dentro!" screen shows the raw string as text.
  await expectRenderedAsText(team.locator('h2'));

  // Admin lobby shows the same name, still just text.
  await expectRenderedAsText(admin.locator('.team-tag'));

  // rankRows() (classifica) was the main gap: toggle it on and check there too.
  await admin.click('#btnToggleStandings');
  await expectRenderedAsText(team.locator('.rank-name'));

  await adminCtx.close();
  await teamCtx.close();
});
