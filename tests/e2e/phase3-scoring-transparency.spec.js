// PL-17: le squadre vedono un indicatore sintetico di rischio/rimonta PRIMA
// di rispondere, quando il profilo dinamico è attivo — mai una correzione
// nascosta (stesso principio già usato per scoringPill/speedBonusPill). Le
// formule pure di scoring (pointsForAnswer, bonus ordine, penalità,
// rimonta, casi limite) sono già coperte a fondo da tests/unit/scoring.spec.js,
// tests/unit/leaderboard-bands.spec.js e tests/unit/final-carryover.spec.js
// (23 test complessivi): questo file verifica solo la parte visibile.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('con profilo dinamico, la squadra vede "Rischio errore" prima di rispondere', async ({ browser }) => {
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
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Trasparenza');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Trasparenza' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');

  // Unica squadra: cade nella fascia peggiore/migliore possibile a seconda
  // dell'arrotondamento, ma qualunque fascia mostra comunque un moltiplicatore
  // di rischio esplicito prima che risponda.
  await expect(team.locator('.pill', { hasText: 'Rischio errore ×' })).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('con profilo classico, nessun indicatore di rischio/rimonta è mostrato (nulla da mostrare)', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnSaveSetup'); // profilo resta 'classico' (default)
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Classica');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Classica' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(team.locator('.opt').first()).toBeVisible();

  await expect(team.locator('.pill', { hasText: 'Rischio errore' })).toHaveCount(0);
  await expect(team.locator('.pill', { hasText: 'Bonus rimonta' })).toHaveCount(0);

  await adminCtx.close();
  await teamCtx.close();
});
