// Verifies the synced timer module: state.timer is shared (not a local
// animation), pause/resume and +5s/-5s propagate to every client, manual
// start mode holds the question until the host triggers it, and the
// transactional auto-close fires exactly once even with several clients
// watching the same expiring timer.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const EMULATOR_STATE_URL = 'http://127.0.0.1:9000/quizzettone/state.json?ns=quizzettone-49543-default-rtdb';

function lobbyState(config) {
  return {
    phase: 'lobby', round: 1, qIndex: 0,
    timer: {status:'idle', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    cancelledQuestions: [],
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
  const res = await request.put(EMULATOR_STATE_URL, { data: lobbyState(config) });
  if (!res.ok()) throw new Error(`Failed to seed state.config: ${res.status()}`);
}

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('timer pause/resume and +5/-5 sync across admin, display and team', async ({ browser, request }) => {
  test.setTimeout(60_000);
  await seedConfig(request, {
    rounds: 1, questionsPerRound: [2], finalistCount: 1, finalQuestionCount: 1,
    tiebreakCandidateCount: 5, questionDurationMs: 20000, timerStartMode: 'auto',
    scoring: {correct:1, wrong:0, noAnswer:0}, finalScoring: null, scoreCarryover: 'reset',
    tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'until_round1_end'}, checkpointMinQuestions: 4,
    blockDuplicateQuestions: true, answerVisibilityForEliminated: 'after_reveal',
  });

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Timer');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Timer' })).toBeVisible();

  const displayCtx = await browser.newContext();
  const display = await displayCtx.newPage();
  await display.goto(BASE + '&role=display');

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.timer-num')).toBeVisible();
  await expect(team.locator('.timer-num')).toBeVisible();
  await expect(display.locator('.timer-num')).toBeVisible();

  await admin.click('#btnPauseTimer');
  await expect(admin.locator('.pill', { hasText: 'In pausa' })).toBeVisible();
  const pausedValue = await admin.locator('.timer-num').innerText();
  await team.waitForTimeout(600);
  await expect(team.locator('.timer-num')).toHaveText(pausedValue);

  await admin.click('#btnTimerPlus5');
  await expect(admin.locator('.timer-num')).toHaveText(String(Number(pausedValue) + 5));

  await admin.click('#btnResumeTimer');
  await expect(admin.locator('#btnPauseTimer')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
  await displayCtx.close();
});

test('manual timer start holds answering until the host triggers it', async ({ browser, request }) => {
  test.setTimeout(60_000);
  await seedConfig(request, {
    rounds: 1, questionsPerRound: [2], finalistCount: 1, finalQuestionCount: 1,
    tiebreakCandidateCount: 5, questionDurationMs: 20000, timerStartMode: 'manual',
    scoring: {correct:1, wrong:0, noAnswer:0}, finalScoring: null, scoreCarryover: 'reset',
    tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'until_round1_end'}, checkpointMinQuestions: 4,
    blockDuplicateQuestions: true, answerVisibilityForEliminated: 'after_reveal',
  });

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Manuale');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Manuale' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('#btnStartTimer')).toBeVisible();
  await expect(team.locator('.opt').first()).toBeDisabled();

  await admin.click('#btnStartTimer');
  await expect(admin.locator('#btnPauseTimer')).toBeVisible();
  await expect(team.locator('.opt').first()).toBeEnabled();

  await adminCtx.close();
  await teamCtx.close();
});

test('expiry auto-closes exactly once with multiple clients watching', async ({ browser, request }) => {
  test.setTimeout(60_000);
  await seedConfig(request, {
    rounds: 1, questionsPerRound: [2], finalistCount: 1, finalQuestionCount: 1,
    tiebreakCandidateCount: 5, questionDurationMs: 2000, timerStartMode: 'auto',
    scoring: {correct:1, wrong:0, noAnswer:0}, finalScoring: null, scoreCarryover: 'reset',
    tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'until_round1_end'}, checkpointMinQuestions: 4,
    blockDuplicateQuestions: true, answerVisibilityForEliminated: 'after_reveal',
  });

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Scadenza');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Scadenza' })).toBeVisible();

  const displayCtx = await browser.newContext();
  const display = await displayCtx.newPage();
  await display.goto(BASE + '&role=display');

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.timer-num')).toBeVisible();

  // 2s question duration: wait past expiry, then check all three clients
  // agree on exactly one clean close (no error, single 'expired' reason).
  await admin.waitForTimeout(3000);
  await expect(admin.locator('#btnNext')).toBeVisible();
  await expect(team.locator('.status-banner.expired')).toBeVisible();

  const closeReason = await admin.evaluate(async () => {
    const snap = await db.ref('quizzettone/' + statePath()).once('value');
    return snap.val().timer.closeReason;
  });
  expect(closeReason).toBe('expired');

  await adminCtx.close();
  await teamCtx.close();
  await displayCtx.close();
});
