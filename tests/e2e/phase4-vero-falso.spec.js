// PL-19 (Vero/Falso): riusa il motore a scelta multipla esistente con
// esattamente 2 opzioni, nessun nuovo motore. Il question manager mostra
// solo i campi A/B quando il tipo di risposta è Vero/Falso; la domanda
// salvata è interamente giocabile con l'attuale interfaccia.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('selezionare "Vero/Falso" nasconde i campi C/D e precompila Vero/Falso', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('#btnToggleQuestionManager');
  await expect(page.locator('#qmOpt23Wrap')).toBeVisible();
  await page.selectOption('#qmAnswerType', 'vero_falso');
  await expect(page.locator('#qmOpt23Wrap')).toBeHidden();
  await expect(page.locator('#qmOpt0')).toHaveValue('Vero');
  await expect(page.locator('#qmOpt1')).toHaveValue('Falso');
  await expect(page.locator('#qmVeroFalsoHint')).toBeVisible();
});

test('una domanda Vero/Falso salvata mostra solo 2 opzioni ed è giocabile end-to-end', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.click('#btnToggleQuestionManager');
  await admin.fill('#qmQuestion', 'Il Colosseo è a Roma?');
  await admin.selectOption('#qmAnswerType', 'vero_falso');
  await admin.selectOption('#qmCorrect', '0'); // Vero
  await admin.click('#btnAddQuestion');
  await expect(admin.locator('#qmAddMsg')).toHaveText('Domanda aggiunta!');

  // Solo questa domanda nel mazzo Manche: azzerato il resto per un mazzo
  // interamente deterministico (nessuna interferenza dalle seed Q1/Q2).
  await admin.evaluate(async () => {
    const bank = await db.ref(DB_ROOT + '/' + questionBankPath()).once('value');
    const updates = {};
    Object.values(bank.val() || {}).forEach(q => {
      if (q.question !== 'Il Colosseo è a Roma?') updates[questionBankPath(q.id)] = null;
    });
    await db.ref(DB_ROOT).update(updates);
  });

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Vero Falso');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Vero Falso' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  await expect(team.locator('.opt')).toHaveCount(2);
  await expect(team.locator('.opt').first()).toContainText('Vero');
  await expect(team.locator('.opt').nth(1)).toContainText('Falso');

  await team.locator('.opt').first().click();
  await expect(team.locator('.status-banner.sent')).toBeVisible();

  const correctIndex = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  expect(correctIndex).toBe(0);

  await adminCtx.close();
  await teamCtx.close();
});
