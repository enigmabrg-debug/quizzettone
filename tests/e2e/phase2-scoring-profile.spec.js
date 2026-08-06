// PL-13 (motore di scoring a profili, scope "solo plumbing"): il selettore
// di profilo nella Sala pre-partita salva e ricarica correttamente
// config.scoringProfile; selezionare "Dinamico" non altera il punteggio
// calcolato (la parte funzionale arriva con PL-14/15 — vedi il test unitario
// dedicato in tests/unit/scoring.spec.js per la garanzia sulle funzioni pure).
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

// NOTA: questo test in origine verificava che il profilo "Dinamico" non
// cambiasse ANCORA il punteggio (vero al tempo di PL-13, "solo plumbing").
// PL-14 ha reso vero il bonus d'ordine per le risposte corrette (coperto a
// fondo da tests/e2e/phase3-order-bonus.spec.js e tests/unit/scoring.spec.js),
// quindi qui resta solo la parte ancora corretta oggi: il malus per una
// risposta SBAGLIATA non cambia finché PL-15 (penalità adattiva a fascia)
// non lo implementa davvero.
test('selezionare il profilo "Dinamico" non cambia ancora il malus per una risposta sbagliata (arriva con PL-15)', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnToggleAdvancedSetup');
  await admin.selectOption('#setupScoringProfile', 'dinamico');
  await admin.fill('#setupScoringWrong', '-7');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Profilo');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Profilo' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  const correctIdx = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  const wrongIdx = correctIdx === 0 ? 1 : 0;
  await team.locator('.opt').nth(wrongIdx).click();
  await admin.click('#btnCloseNow');

  const teamId = await admin.evaluate(() => Object.keys(teams)[0]);
  const points = await admin.evaluate((id) => teamPointsForQuestion(id, 1, 0), teamId);
  expect(points).toBe(-7); // esattamente config.scoring.wrong, nessuna penalità a fascia applicata (PL-15)

  await adminCtx.close();
  await teamCtx.close();
});
