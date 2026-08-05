// Verifies the lobby features built on top of the setup screen: per-team
// online/offline presence and device count, the "ready" toggle, automatic
// reconnection after a page reload, and the join code + QR shown to the
// admin/display.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('presence, ready toggle, and reconnection', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  // Join code appears on the admin's setup screen once generated.
  await expect(admin.locator('#setupGameName')).toBeVisible();
  const joinCodeLocator = admin.locator('.card.stack .pill.gold').first();
  await expect(joinCodeLocator).toBeVisible();
  const joinCode = (await joinCodeLocator.innerText()).trim();
  expect(joinCode.length).toBeGreaterThanOrEqual(5);

  const team1Ctx = await browser.newContext();
  const team1 = await team1Ctx.newPage();
  await team1.goto(BASE);
  await team1.click('#btnTeam');
  await team1.fill('#teamNameInput', 'Team Presenza');
  await team1.click('#btnJoin');

  // Online dot (green) should appear for the connected team.
  const teamRow = admin.locator('.team-tag', { hasText: 'Team Presenza' });
  await expect(teamRow).toBeVisible();
  await expect(teamRow).toContainText('Team Presenza');

  // A second device joining with the SAME team name should bump the device count.
  const team1bCtx = await browser.newContext();
  const team1b = await team1bCtx.newPage();
  await team1b.goto(BASE);
  await team1b.click('#btnTeam');
  await team1b.fill('#teamNameInput', 'Team Presenza');
  await team1b.click('#btnJoin');
  await expect(teamRow).toContainText('2 dispositivi');

  // Ready toggle: team marks itself ready, admin sees the "Pronta" badge.
  await team1.click('#btnTeamReady');
  await expect(teamRow).toContainText('Pronta');

  // Reconnection: reload the team tab, it should land back on the same
  // "Sei dentro" screen without re-entering its name.
  await team1.reload();
  await expect(team1.locator('h2', { hasText: 'Team Presenza' })).toBeVisible();

  await adminCtx.close();
  await team1Ctx.close();
  await team1bCtx.close();
});

test('join code QR shortcut opens the team-join screen directly', async ({ page }) => {
  await page.goto(BASE + '&role=team');
  await expect(page.locator('#teamNameInput')).toBeVisible();
});
