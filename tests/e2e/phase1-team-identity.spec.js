// PL-07: joining is atomic and unique per name (a transaction() on
// teamNames:<key> decides who "wins" a name instead of a check-then-act),
// and the admin can rename a team from the lobby.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('two near-simultaneous joins with the same name produce exactly one team', async ({ browser }) => {
  test.setTimeout(60_000);
  // Two separate devices (no shared localStorage), unlike the PL-06 "two
  // tabs of the same team" scenario: here neither one has an existing
  // teamId yet, so this genuinely races two *creations* of the same name.
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto(BASE);
  await page1.click('#btnTeam');
  await page1.fill('#teamNameInput', 'Squadra Gemella');

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(BASE);
  await page2.click('#btnTeam');
  await page2.fill('#teamNameInput', 'Squadra Gemella');

  await Promise.all([
    page1.click('#btnJoin'),
    page2.click('#btnJoin'),
  ]);

  await expect(page1.locator('h2', { hasText: 'Squadra Gemella' })).toBeVisible();
  await expect(page2.locator('h2', { hasText: 'Squadra Gemella' })).toBeVisible();

  // Both devices must have ended up as the SAME team, not two twins.
  const id1 = await page1.evaluate(() => teamId);
  const id2 = await page2.evaluate(() => teamId);
  expect(id1).toBe(id2);

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Gemella' })).toHaveCount(1);

  await ctx1.close();
  await ctx2.close();
  await adminCtx.close();
});

test('admin can rename a team from the lobby', async ({ browser }) => {
  test.setTimeout(30_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Nome Originale');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Nome Originale' })).toBeVisible();

  await admin.click('[data-rename-team]');
  await expect(admin.locator('#renameTeamOverlay')).toBeVisible();
  await admin.fill('#renameTeamInput', 'Nome Nuovo');
  await admin.click('#renameTeamConfirm');

  await expect(admin.locator('.team-tag', { hasText: 'Nome Nuovo' })).toBeVisible();
  await expect(admin.locator('.team-tag', { hasText: 'Nome Originale' })).toHaveCount(0);

  await adminCtx.close();
  await teamCtx.close();
});

test('admin cannot rename a team to a name already taken by another team', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamACtx = await browser.newContext();
  const teamA = await teamACtx.newPage();
  await teamA.goto(BASE);
  await teamA.click('#btnTeam');
  await teamA.fill('#teamNameInput', 'Squadra A');
  await teamA.click('#btnJoin');

  const teamBCtx = await browser.newContext();
  const teamB = await teamBCtx.newPage();
  await teamB.goto(BASE);
  await teamB.click('#btnTeam');
  await teamB.fill('#teamNameInput', 'Squadra B');
  await teamB.click('#btnJoin');

  await expect(admin.locator('.team-tag', { hasText: 'Squadra A' })).toBeVisible();
  await expect(admin.locator('.team-tag', { hasText: 'Squadra B' })).toBeVisible();

  // Rename "Squadra B" to "Squadra A" (already taken) via the rename button
  // on the row that contains "Squadra B".
  const teamBRow = admin.locator('.team-tag', { hasText: 'Squadra B' });
  await teamBRow.locator('[data-rename-team]').click();
  await admin.fill('#renameTeamInput', 'Squadra A');
  await admin.click('#renameTeamConfirm');

  await expect(admin.locator('#errorBannerOverlay')).toContainText('Esiste già una squadra con questo nome');
  // Still two distinct teams, "Squadra B" untouched.
  await expect(admin.locator('.team-tag', { hasText: 'Squadra A' })).toHaveCount(1);
  await expect(admin.locator('.team-tag', { hasText: 'Squadra B' })).toHaveCount(1);

  await adminCtx.close();
  await teamACtx.close();
  await teamBCtx.close();
});
