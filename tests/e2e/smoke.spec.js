// Smoke test for the test infrastructure itself (Playwright + local Firebase
// RTDB emulator + static server). Exercises the app as it exists TODAY,
// unmodified: role select -> admin PIN -> team join -> both see the lobby.
// This must be green before any game-logic changes land on top of it.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('admin unlocks and sees the lobby, a team joins and appears in it', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const teamCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const team = await teamCtx.newPage();

  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('h3:has-text("Lobby")')).toBeVisible();

  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Test');
  await team.click('#btnJoin');

  await expect(admin.locator('.team-tag', { hasText: 'Team Test' })).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});
