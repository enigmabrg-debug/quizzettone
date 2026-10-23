// PL-12: preset di partita (Classica/Rapida/Tutti contro tutti) precompilano
// il form della Sala pre-partita con i valori dichiarati dal piano §4.1;
// un preset personalizzato salvato è riselezionabile in una partita
// successiva (persiste su un nodo globale, sopravvive a un ricaricamento
// della pagina); il riepilogo testuale compare prima dell'avvio vero.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('il preset "Partita rapida" precompila 1 manche da 10, 2 finalisti, finale da 5', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('[data-builtin-preset="rapida"]');

  await expect(page.locator('#setupRounds')).toHaveValue('1');
  await expect(page.locator('#setupQuestionsPerRound')).toHaveValue('10');
  await expect(page.locator('#setupFinalistCount')).toHaveValue('2');
  await expect(page.locator('#setupFinalQuestionCount')).toHaveValue('5');
});

test('il preset "Tutti contro tutti" imposta un finalistCount molto alto (nessuna squadra eliminata)', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('[data-builtin-preset="tutti_contro_tutti"]');
  await expect(page.locator('#setupFinalistCount')).toHaveValue('999');

  // Il campo avanzato scoreCarryover ('keep', per la Modalità Party è
  // 'Mantiene i punti') deve aprirsi automaticamente e riflettere il preset.
  await expect(page.locator('#salaAdvancedSection')).toBeVisible();
  await expect(page.locator('#setupScoreCarryover')).toHaveValue('keep');
});

test('un preset personalizzato salvato è riselezionabile dopo un ricaricamento della pagina', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.fill('#setupRounds', '3');
  await page.fill('#setupQuestionsPerRound', '7');
  await page.click('#btnSaveAsPreset');
  await expect(page.locator('#savePresetInput')).toBeVisible();
  await page.fill('#savePresetInput', 'Preset di prova');
  await page.click('#savePresetConfirm');

  await expect(page.locator('[data-load-preset]')).toBeVisible();
  await expect(page.locator('text=Preset di prova')).toBeVisible();

  // Ricarica la pagina (simula una partita successiva, admin già sbloccato
  // via localStorage): il preset è su un nodo globale, non sulla sessione.
  await page.reload();
  await page.waitForSelector('#setupGameName');
  await expect(page.locator('text=Preset di prova')).toBeVisible();

  // Il form riparte dai default (o da un'altra config): caricare il preset
  // deve riportare i campi salvati.
  await page.fill('#setupRounds', '1');
  await page.click('[data-load-preset]');
  await expect(page.locator('#setupRounds')).toHaveValue('3');
  await expect(page.locator('#setupQuestionsPerRound')).toHaveValue('7');
});

test('avviare la partita mostra prima un riepilogo testuale: annullare non avvia nulla, confermare sì', async ({ browser }) => {
  test.setTimeout(30_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '2');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Riepilogo');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Riepilogo' })).toBeVisible();

  await admin.click('#btnStart');
  await expect(admin.locator('#startSummaryOverlay')).toBeVisible();
  await expect(admin.locator('#startSummaryOverlay')).toContainText('1 manche');

  await admin.click('#startSummaryCancel');
  await expect(admin.locator('#startSummaryOverlay')).toHaveCount(0);
  await expect(admin.locator('#setupGameName')).toBeVisible(); // ancora in lobby, nessuna partita avviata

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/2');

  await adminCtx.close();
  await teamCtx.close();
});
