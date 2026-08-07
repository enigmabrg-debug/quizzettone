// PL-18: il question manager mostra e valida il contratto comune della
// domanda (tipo di contenuto, tipo di risposta, difficoltà, politica di
// risposta, tolleranza); le domande seed esistenti (create prima di questo
// pacchetto) continuano a funzionare senza migrazione manuale. Le funzioni
// pure (withQuestionDefaults, i default per i campi mancanti) sono già
// coperte a fondo da tests/unit/question-contract.spec.js.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('una domanda salvata con tipo di risposta e difficoltà dichiarati li mostra nell\'elenco del question manager', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('#btnToggleQuestionManager');
  await page.fill('#qmQuestion', 'Quanto pesa una piuma di struzzo?');
  await page.fill('#qmOpt0', '100g');
  await page.fill('#qmOpt1', '200g');
  await page.fill('#qmOpt2', '300g');
  await page.fill('#qmOpt3', '400g');
  await page.selectOption('#qmAnswerType', 'numero');
  await page.selectOption('#qmDifficulty', 'difficile');
  await page.fill('#qmTolerance', '10');
  await page.click('#btnAddQuestion');

  await expect(page.locator('#qmAddMsg')).toHaveText('Domanda aggiunta!');
  // La domanda finisce sotto la categoria di default (Geografia, pool
  // Manche): l'elenco la mostra dentro un <details> collassato, va aperto
  // prima di poter verificare la visibilità del suo contenuto.
  await page.locator('summary', { hasText: 'Geografia' }).first().click();
  await expect(page.locator('text=Quanto pesa una piuma di struzzo?')).toBeVisible();
  const row = page.locator('.row', { has: page.locator('text=Quanto pesa una piuma di struzzo?') });
  await expect(row.locator('.pill', { hasText: 'Numero' })).toBeVisible();
  await expect(row.locator('.pill', { hasText: 'Difficile' })).toBeVisible();
});

test('le domande seed (create prima di questo pacchetto, senza i nuovi campi) restano giocabili senza migrazione', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  // ensureSeedQuestions ha già popolato il mazzo con Q1/Q2/QF (nessun campo
  // del contratto scritto esplicitamente): il question manager deve
  // comunque mostrarle con i default applicati in lettura, e la partita
  // deve restare interamente giocabile.
  await admin.click('#btnToggleQuestionManager');
  await admin.locator('summary').first().click(); // apre la prima categoria collassata
  await expect(admin.locator('.pill', { hasText: 'Scelta multipla' }).first()).toBeVisible();
  await expect(admin.locator('.pill', { hasText: 'Media' }).first()).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Contratto');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Contratto' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  const correctIdx = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  await team.locator('.opt').nth(correctIdx).click();
  await expect(team.locator('.status-banner.sent')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});
