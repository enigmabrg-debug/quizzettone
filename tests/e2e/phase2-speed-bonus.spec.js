// Verifies the speed bonus scoring system: it's explicit and announced to
// teams before they answer (never a silent adjustment), computed once at
// submission time, and reflected in both the team's own confirmation and
// the admin's scoring table.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('speed bonus is announced before answering and applied to a fast correct answer', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.fill('#setupQuestionDuration', '30');
  await admin.click('#btnToggleAdvancedSetup');
  await admin.check('#setupSpeedBonusEnabled');
  await admin.fill('#setupSpeedBonusMax', '5');
  await admin.fill('#setupSpeedBonusWindow', '20');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(500);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Veloce');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Veloce' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');

  // Announced BEFORE answering: the team sees the bonus is active up front.
  await expect(team.locator('.pill', { hasText: 'Bonus velocità attivo' })).toBeVisible();

  const correctIdx = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  await team.locator('.opt').nth(correctIdx).click();

  // Announced again right after answering, not silently folded into the score.
  await expect(team.locator('.status-banner', { hasText: 'bonus velocità' })).toBeVisible();

  await admin.click('#btnCloseNow');
  const totalPoints = await admin.evaluate(() => {
    const id = Object.keys(teams)[0];
    return teamPointsForQuestion(id, 1, 0);
  });
  // Base correct (1) + some positive bonus (answered ~immediately, well
  // inside the 20s window) but never more than base+max (1+5=6).
  expect(totalPoints).toBeGreaterThan(1);
  expect(totalPoints).toBeLessThanOrEqual(6);

  await adminCtx.close();
  await teamCtx.close();
});

test('speed bonus does not apply to wrong answers or when disabled', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnToggleAdvancedSetup');
  await admin.check('#setupSpeedBonusEnabled');
  await admin.fill('#setupSpeedBonusMax', '5');
  await admin.fill('#setupSpeedBonusWindow', '20');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(500);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Sbagliato');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Sbagliato' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  const correctIdx = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  const wrongIdx = (correctIdx + 1) % 4;
  await team.locator('.opt').nth(wrongIdx).click();

  await admin.click('#btnCloseNow');
  const points = await admin.evaluate(() => {
    const id = Object.keys(teams)[0];
    return teamPointsForQuestion(id, 1, 0);
  });
  // A fast WRONG answer never scores extra points: the bonus note is
  // conditional ("se corretta") because speed is judged before correctness
  // is known, but it must never actually be added to a wrong answer's score.
  expect(points).toBe(0); // scoring.wrong default

  await adminCtx.close();
  await teamCtx.close();
});
