// Verifies the Sala pre-partita screen itself: the admin edits essential and
// advanced settings through the actual form (not a REST seed like the other
// round-count spec), the values round-trip through Firebase, the config is
// locked once the game starts, and the late-join policy chosen in the form
// is actually enforced against a team trying to join after start.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('admin configures the game via the setup screen, config locks after start, late join is enforced', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();

  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('h3:has-text("Sala pre-partita")')).toBeVisible();

  await admin.fill('#setupGameName', 'Serata di Prova');
  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '5');
  await admin.fill('#setupFinalistCount', '1');
  await admin.fill('#setupFinalQuestionCount', '2');
  await admin.fill('#setupQuestionDuration', '5');
  await admin.fill('#setupScoringCorrect', '2');
  await admin.fill('#setupScoringWrong', '-1');
  await admin.fill('#setupScoringNoAnswer', '0');
  await admin.selectOption('#setupTiebreakQualification', 'oltranza');
  await admin.selectOption('#setupLateJoinPolicy', 'blocked_after_start');

  await admin.click('#btnToggleAdvancedSetup');
  await admin.check('#setupFinalScoringEnabled');
  await admin.fill('#setupFinalScoringCorrect', '3');
  await admin.fill('#setupFinalScoringWrong', '-2');
  await admin.fill('#setupFinalScoringNoAnswer', '0');
  await admin.selectOption('#setupScoreCarryover', 'keep');
  await admin.selectOption('#setupTiebreakFinal', 'corretta_veloce');
  await admin.selectOption('#setupAnswerVisibility', 'live');
  await admin.uncheck('#setupBlockDuplicates');

  await admin.click('#btnSaveSetup');
  // adminSetGameName/adminUpdateConfig are async Firebase writes with no
  // visible completion signal in the UI; give them a moment before reloading
  // to check the round trip, rather than racing the reload against the write.
  await admin.waitForTimeout(800);

  // Round-trip check: reload the page entirely and confirm the saved config
  // came back from Firebase (not just held in local form state).
  await admin.reload();
  await expect(admin.locator('#setupGameName')).toHaveValue('Serata di Prova');
  await expect(admin.locator('#setupQuestionsPerRound')).toHaveValue('5');
  await admin.click('#btnToggleAdvancedSetup');
  await expect(admin.locator('#setupFinalScoringEnabled')).toBeChecked();
  await expect(admin.locator('#setupScoreCarryover')).toHaveValue('keep');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Puntuale');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Puntuale' })).toBeVisible();

  await admin.click('#btnStart');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/5');
  await expect(admin.locator('h3:has-text("Sala pre-partita")')).toHaveCount(0);

  const timerText = await admin.locator('.timer-num').innerText();
  expect(Number(timerText)).toBeGreaterThan(0);
  expect(Number(timerText)).toBeLessThanOrEqual(5);

  // Late join, blocked_after_start: a brand-new team must be rejected.
  const latecomerCtx = await browser.newContext();
  const latecomer = await latecomerCtx.newPage();
  await latecomer.goto(BASE);
  await latecomer.click('#btnTeam');
  await latecomer.fill('#teamNameInput', 'Team Ritardatario');
  await latecomer.click('#btnJoin');
  await expect(latecomer.locator('#joinError')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
  await latecomerCtx.close();
});
