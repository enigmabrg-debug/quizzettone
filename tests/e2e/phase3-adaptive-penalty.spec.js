// PL-15: penalità adattiva + bonus rimonta, profilo dinamico. La formula
// pura (fasce, percentili, il calcolo del piano §4.2) è già coperta a fondo
// da tests/unit/leaderboard-bands.spec.js; questo file verifica il percorso
// reale: due squadre con punteggi già diversi (leader e ultima) entrano
// nella manche 2 con posizioni consolidate diverse, sbagliano entrambe la
// stessa domanda, e la penalità rispecchia la fascia congelata di ciascuna.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('due squadre in fasce diverse (leader/ultima) sbagliano la stessa domanda e perdono punti diversi', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '2');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnToggleAdvancedSetup');
  await admin.selectOption('#setupScoringProfile', 'dinamico');
  await admin.fill('#setupScoringCorrect', '1000');
  await admin.fill('#setupScoringWrong', '0'); // valore "classico" volutamente diverso dalla formula a fascia, per provare che NON viene usato
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const leaderCtx = await browser.newContext();
  const leader = await leaderCtx.newPage();
  await leader.goto(BASE);
  await leader.click('#btnTeam');
  await leader.fill('#teamNameInput', 'Squadra Leader');
  await leader.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Leader' })).toBeVisible();

  const lastCtx = await browser.newContext();
  const last = await lastCtx.newPage();
  await last.goto(BASE);
  await last.click('#btnTeam');
  await last.fill('#teamNameInput', 'Squadra Ultima');
  await last.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Ultima' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  // Manche 1: solo "Squadra Leader" risponde correttamente, "Squadra Ultima"
  // resta senza punti -- così le due squadre arrivano alla manche 2 con
  // posizioni consolidate chiaramente diverse (prima fascia vs ultima).
  const correctIdx1 = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  await leader.locator('.opt').nth(correctIdx1).click();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext'); // fine manche 1 -> checkpoint
  await admin.click('#btnContinue');
  await expect(admin.locator('.qmeta').first()).toContainText('MANCHE 2');

  // Manche 2, domanda 1: entrambe sbagliano.
  const correctIdx2 = await admin.evaluate(() => getQuestion(2, 0).correctIndex);
  const wrongIdx = correctIdx2 === 0 ? 1 : 0;
  await leader.locator('.opt').nth(wrongIdx).click();
  await last.locator('.opt').nth(wrongIdx).click();
  await admin.click('#btnCloseNow');

  const bandsCount = await admin.evaluate(() => {
    const q = getQuestion(2, 0);
    return q && q.leaderboardBands ? Object.keys(q.leaderboardBands).length : 0;
  });
  expect(bandsCount).toBe(2);

  const idFor = async (name) => admin.evaluate((n) => Object.keys(teams).find(id => teams[id].name === n), name);
  const leaderId = await idFor('Squadra Leader');
  const lastId = await idFor('Squadra Ultima');

  const leaderPoints = await admin.evaluate((id) => teamPointsForQuestion(id, 2, 0), leaderId);
  const lastPoints = await admin.evaluate((id) => teamPointsForQuestion(id, 2, 0), lastId);

  // Con solo 2 squadre attive, il leader cade nella fascia 26-50% (non nella
  // "prime 10%": servono più squadre per riempire le fasce più strette, la
  // mappatura esatta della tabella con i confini di percentile è già
  // verificata a fondo in tests/unit/leaderboard-bands.spec.js con 10
  // squadre). 1.000 punti, aliquota 20%: leader (×1,40) perde 280, ultima
  // (×0,70, sempre l'ultima fascia) perde 140. Nessuna delle due usa il
  // vecchio sc.wrong (0, impostato apposta sopra per essere sicuri che non
  // venga letto).
  expect(leaderPoints).toBe(-280);
  expect(lastPoints).toBe(-140);
  expect(leaderPoints).not.toBe(0);
  expect(lastPoints).not.toBe(0);

  await adminCtx.close();
  await leaderCtx.close();
  await lastCtx.close();
});
