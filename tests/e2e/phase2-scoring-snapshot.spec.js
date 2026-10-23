// PL-10: the scoring rule effective when a question opens is frozen onto
// its questionInstances entry (scoringSnapshot), not read live from
// state.config every time a score is displayed. A rule change made after a
// question has already opened must never retroactively change its score.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('changing scoring config mid-game does not retroactively alter already-opened questions', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '3');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(500);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Snapshot');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Snapshot' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/3');

  // Q1 apre sotto la config di default (correct:1) e riceve il suo snapshot.
  const snapshotQ1 = await admin.evaluate(() => getQuestion(1, 0).scoringSnapshot);
  expect(snapshotQ1.correct).toBe(1);

  const correctIdx1 = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  await team.locator('.opt').nth(correctIdx1).click();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 2/3');

  // Q2 si apre ancora PRIMA di qualunque cambio: stesso snapshot di Q1.
  const snapshotQ2 = await admin.evaluate(() => getQuestion(1, 1).scoringSnapshot);
  expect(snapshotQ2.correct).toBe(1);
  const correctIdx2 = await admin.evaluate(() => getQuestion(1, 1).correctIndex);

  // Simula un cambio di regole a partita in corso: oggi non c'è ancora un
  // percorso UI per farlo (arriverà con PL-25), ma la scrittura diretta su
  // Firebase qui sotto esercita esattamente lo scenario che lo snapshot deve
  // rendere innocuo per le domande già aperte.
  await admin.evaluate(async () => {
    await db.ref(DB_ROOT + '/' + statePath() + '/config/scoring').set({correct:99, wrong:0, noAnswer:0});
  });

  // Q1 resta congelata a 1 punto, non sale a 99.
  const scoreQ1 = await admin.evaluate(() => teamPointsForQuestion(Object.keys(teams)[0], 1, 0));
  expect(scoreQ1).toBe(1);

  // Q2 (aperta prima del cambio) resta ugualmente congelata, anche se la
  // squadra risponde DOPO che la config è già cambiata.
  await team.locator('.opt').nth(correctIdx2).click();
  const scoreQ2 = await admin.evaluate(() => teamPointsForQuestion(Object.keys(teams)[0], 1, 1));
  expect(scoreQ2).toBe(1);

  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 3/3');

  // Q3 si apre DOPO il cambio: il suo snapshot riflette la nuova config.
  const snapshotQ3 = await admin.evaluate(() => getQuestion(1, 2).scoringSnapshot);
  expect(snapshotQ3.correct).toBe(99);

  await adminCtx.close();
  await teamCtx.close();
});

test('config.version increments on each successful adminSaveSetup', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  expect(await page.evaluate(() => state.config.version)).toBe(0);

  await page.fill('#setupRounds', '1');
  await page.click('#btnSaveSetup');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => state.config.version)).toBe(1);

  await page.fill('#setupRounds', '2');
  await page.click('#btnSaveSetup');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => state.config.version)).toBe(2);
});
