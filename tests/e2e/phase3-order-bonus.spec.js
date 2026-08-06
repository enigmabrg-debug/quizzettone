// PL-14: bonus per ordine di arrivo tra le sole risposte corrette, attivo
// solo per i profili di scoring diversi da "classico". Il calcolo vero e
// proprio (computeOrderBonusAssignments, con la gestione dei pari-merito) è
// già coperto da tests/unit/scoring.spec.js; questo file verifica il
// percorso end-to-end reale: tre squadre rispondono in ordine noto tramite
// l'interfaccia vera, la domanda si chiude, e i punti finali rispecchiano
// la tabella bonus configurata.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('con profilo dinamico, tre squadre corrette in ordine noto ricevono il bonus d\'ordine esatto (25/20/15%)', async ({ browser }) => {
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
  await admin.fill('#setupScoringCorrect', '100');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teams = {};
  for (const name of ['Squadra Prima', 'Squadra Seconda', 'Squadra Terza']) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.click('#btnTeam');
    await page.fill('#teamNameInput', name);
    await page.click('#btnJoin');
    await expect(admin.locator('.team-tag', { hasText: name })).toBeVisible();
    teams[name] = { ctx, page };
  }

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  const correctIdx = await admin.evaluate(() => getQuestion(1, 0).correctIndex);

  // Risposte in sequenza stretta, così l'ordine di arrivo è deterministico
  // (ogni submit passa dal server prima del successivo grazie all'await).
  await teams['Squadra Prima'].page.locator('.opt').nth(correctIdx).click();
  await expect(teams['Squadra Prima'].page.locator('.status-banner.sent')).toBeVisible();
  await teams['Squadra Seconda'].page.locator('.opt').nth(correctIdx).click();
  await expect(teams['Squadra Seconda'].page.locator('.status-banner.sent')).toBeVisible();
  await teams['Squadra Terza'].page.locator('.opt').nth(correctIdx).click();
  await expect(teams['Squadra Terza'].page.locator('.status-banner.sent')).toBeVisible();

  await admin.click('#btnCloseNow');
  // ensureOrderBonusComputed gira sul prossimo snapshot admin: attende che
  // il bonus sia stato scritto sull'istanza della domanda prima di leggere
  // i punteggi finali.
  await expect.poll(async () => {
    return await admin.evaluate(() => {
      const q = getQuestion(1, 0);
      return q && q.orderBonusAssignments ? Object.keys(q.orderBonusAssignments).length : 0;
    });
  }, { timeout: 10_000 }).toBe(3);

  const pointsFor = async (name) => {
    const teamId = await admin.evaluate((n) => {
      return Object.keys(teams).find(id => teams[id].name === n);
    }, name);
    return admin.evaluate((id) => teamPointsForQuestion(id, 1, 0), teamId);
  };

  expect(await pointsFor('Squadra Prima')).toBe(125);  // 100 + 25%
  expect(await pointsFor('Squadra Seconda')).toBe(120); // 100 + 20%
  expect(await pointsFor('Squadra Terza')).toBe(115);   // 100 + 15%

  for (const t of Object.values(teams)) await t.ctx.close();
  await adminCtx.close();
});
