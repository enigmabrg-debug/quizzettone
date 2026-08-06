// Verifies the round-count generalization: game rules (number of rounds,
// questions per round) come from state.config instead of being hardcoded to
// exactly 2 rounds of 15 questions. There is no Sala pre-partita UI yet (that
// lands in a later commit), so this test seeds state.config directly into the
// emulator via REST before the admin loads the page.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const EMULATOR_STATE_URL = 'http://127.0.0.1:9000/quizzettone/state.json?ns=quizzettone-49543-default-rtdb';

function lobbyStateWithConfig(config) {
  return {
    phase: 'lobby', round: 1, qIndex: 0,
    questionStartedAt: null, timerDuration: 20000,
    checkpoint: null, checkpointMode: null,
    finalists: null, eliminated: null,
    tiebreak: null, winner: null, finalWinnerScoreSnapshot: null,
    standingsVisible: false, gameQuestions: null, solutionRevealed: false,
    scoringOverrides: {}, standingsReveal: null,
    audioCue: null,
    partyMode: 'none', party: { bonus: null, malus: null, surprise: null },
    config,
  };
}

async function seedConfig(request, config) {
  const res = await request.put(EMULATOR_STATE_URL, { data: lobbyStateWithConfig(config) });
  if (!res.ok()) throw new Error(`Failed to seed state.config: ${res.status()}`);
}

async function playOneQuestion(admin) {
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
}

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('1-round game: end-of-round checkpoint goes straight to "Svela finaliste"', async ({ browser, request }) => {
  await seedConfig(request, { rounds: 1, questionsPerRound: [4] });

  const adminCtx = await browser.newContext();
  const teamCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const team = await teamCtx.newPage();

  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('h3:has-text("Lobby")')).toBeVisible();

  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Solo Team');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Solo Team' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/4');

  // Q1 -> Q2
  await playOneQuestion(admin);
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 2/4');

  // Q2 -> mid checkpoint (midPoint = ceil(4/2) = 2)
  await playOneQuestion(admin);
  await expect(admin.locator('h3:has-text("Checkpoint")')).toBeVisible();
  await admin.click('#btnContinue');

  // Q3 -> Q4
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 3/4');
  await playOneQuestion(admin);
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 4/4');

  // Q4 -> end-of-round checkpoint; with only 1 round configured this must be
  // the qualification-end screen (reveal finalists), never "Continua con Manche 2".
  await playOneQuestion(admin);
  await expect(admin.locator('h3:has-text("Fine qualificazione")')).toBeVisible();
  await expect(admin.locator('#btnRevealFinalists')).toBeVisible();
  await expect(admin.locator('#btnContinue')).toHaveCount(0);

  await admin.click('#btnRevealFinalists');
  await expect(admin.locator('h3:has-text("Finaliste svelate")')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('3-round game: checkpoint text is dynamic and progresses past round 2', async ({ browser, request }) => {
  await seedConfig(request, { rounds: 3, questionsPerRound: [3, 3, 3] });

  const adminCtx = await browser.newContext();
  const teamCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const team = await teamCtx.newPage();

  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Trio Team');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Trio Team' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');

  // Round 1: 3 questions, no mid-checkpoint (list.length < 4), straight to end-of-round-1.
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/3');
  await playOneQuestion(admin);
  await playOneQuestion(admin);
  await playOneQuestion(admin);
  await expect(admin.locator('h3:has-text("Fine Manche 1")')).toBeVisible();
  await expect(admin.locator('#btnContinue')).toContainText('Continua con Manche 2');
  await admin.click('#btnContinue');

  // Round 2: same shape, end-of-round-2 must offer round 3, not finalists.
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/3');
  await playOneQuestion(admin);
  await playOneQuestion(admin);
  await playOneQuestion(admin);
  await expect(admin.locator('h3:has-text("Fine Manche 2")')).toBeVisible();
  await expect(admin.locator('#btnContinue')).toContainText('Continua con Manche 3');
  await admin.click('#btnContinue');

  // Round 3 (last configured round): end-of-round must finally offer finalists.
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/3');
  await playOneQuestion(admin);
  await playOneQuestion(admin);
  await playOneQuestion(admin);
  await expect(admin.locator('h3:has-text("Fine qualificazione")')).toBeVisible();
  await expect(admin.locator('#btnRevealFinalists')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});
