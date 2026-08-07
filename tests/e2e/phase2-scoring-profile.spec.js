// PL-13 (motore di scoring a profili): il selettore di profilo nella Sala
// pre-partita salva e ricarica correttamente config.scoringProfile. Il
// calcolo dei punti per ciascun profilo (bonus ordine, penalità/rimonta a
// fascia) è coperto a fondo altrove — tests/unit/scoring.spec.js,
// tests/unit/leaderboard-bands.spec.js, tests/e2e/phase3-order-bonus.spec.js,
// tests/e2e/phase3-adaptive-penalty.spec.js — non qui.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('il profilo di scoring scelto in Sala pre-partita si salva e sopravvive a un ricaricamento', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('#btnToggleAdvancedSetup');
  await expect(page.locator('#setupScoringProfile')).toHaveValue('classico');
  await page.selectOption('#setupScoringProfile', 'dinamico');
  await page.click('#btnSaveSetup');
  await page.waitForTimeout(400);

  await page.reload();
  await page.waitForSelector('#setupGameName');
  await page.click('#btnToggleAdvancedSetup');
  await expect(page.locator('#setupScoringProfile')).toHaveValue('dinamico');
});
