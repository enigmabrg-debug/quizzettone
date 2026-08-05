// Verifies the automatic standings reveal: the order is entirely
// system-computed (no manual reorder control exists anymore), tied teams
// are grouped into a single revealed step, and the speed/autoplay/skip
// controls work.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const EMULATOR_ROOT = 'http://127.0.0.1:9000/quizzettone.json?ns=quizzettone-49543-default-rtdb';

function baseState() {
  return {
    gameName: 'Quizzettone', setupLocked: true, joinCode: 'ABCDE',
    phase: 'lobby', round: 1, qIndex: 0,
    timer: {status:'idle', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    cancelledQuestions: [], history: {last:null, log:[]},
    checkpoint: null, checkpointMode: null,
    finalists: null, eliminated: null,
    tiebreak: null, winner: null, finalWinnerScoreSnapshot: null,
    standingsVisible: false, solutionRevealed: false, scoringOverrides: {}, standingsReveal: null,
    audioCue: null,
    partyMode: 'none', party: { bonus: null, malus: null, surprise: null },
    gameQuestions: { rounds: { 1: [{id:'q1', pool:'manche', category:'Test', question:'Domanda?', options:['A','B','C','D'], correctIndex:0}] }, final: null, tiebreak: null },
    config: {
      rounds: 1, questionsPerRound: [1], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 5,
      questionDurationMs: 20000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
      finalScoring: null, scoreCarryover: 'reset', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
      lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
      answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0}
    },
  };
}

async function seed(request, teamsScores) {
  const root = { state: baseState() };
  for (const [name, score] of Object.entries(teamsScores)) {
    const id = 'team_' + name.toLowerCase();
    root['teaminfo:' + id] = { id, name, joinedAt: Date.now() };
    root['overrides:' + id] = { '1-0': score };
  }
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error(`Seed failed: ${res.status()}`);
}

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('reveal order is automatic, ties are grouped, no manual reorder exists', async ({ browser, request }) => {
  test.setTimeout(60_000);
  // A and B tied for first (10), C alone at 5, D alone at 3.
  await seed(request, { TeamA: 10, TeamB: 10, TeamC: 5, TeamD: 3 });

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const displayCtx = await browser.newContext();
  const display = await displayCtx.newPage();
  await display.goto(BASE + '&role=display');

  await admin.click('#btnSetupStandingsReveal');
  await expect(admin.locator('h3:has-text("Classifica animata in corso")')).toBeVisible();
  await expect(admin.locator('[data-move-reveal]')).toHaveCount(0);
  await expect(admin.locator('p', { hasText: 'Rivelate 0/3 fasce' })).toBeVisible();

  await admin.click('#btnRevealNextStanding');
  await expect(display.locator('.reveal-row')).toHaveCount(1);
  await expect(display.locator('.reveal-row').first()).toContainText('4°');
  await expect(display.locator('.reveal-row').first()).toContainText('TeamD');

  await admin.click('#btnRevealNextStanding');
  await expect(display.locator('.reveal-row')).toHaveCount(2);
  await expect(display.locator('.reveal-row').nth(1)).toContainText('3°');
  await expect(display.locator('.reveal-row').nth(1)).toContainText('TeamC');

  // Final group: A and B tied, revealed together in ONE step at position 1.
  await admin.click('#btnRevealNextStanding');
  await expect(display.locator('.reveal-row')).toHaveCount(3);
  const tiedRow = display.locator('.reveal-row').nth(2);
  await expect(tiedRow).toContainText('1°');
  await expect(tiedRow).toContainText('TeamA');
  await expect(tiedRow).toContainText('TeamB');

  await expect(admin.locator('#btnRevealNextStanding')).toHaveCount(0);
  await expect(admin.locator('p', { hasText: 'Rivelate 3/3 fasce' })).toBeVisible();

  await adminCtx.close();
  await displayCtx.close();
});

test('skip-to-full and speed controls work', async ({ browser, request }) => {
  await seed(request, { TeamA: 10, TeamB: 5 });

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE + '&role=team&id=team_teama');

  await admin.click('#btnSetupStandingsReveal');
  await admin.click('#btnRevealSpeedSuspense');
  await expect(admin.locator('#btnRevealSpeedSuspense.secondary')).toHaveCount(0);

  await admin.click('#btnSkipToFullStandingsReveal');
  await expect(admin.locator('p', { hasText: 'Rivelate 2/2 fasce' })).toBeVisible();
  await expect(team.locator('.reveal-row')).toHaveCount(2);

  await adminCtx.close();
  await teamCtx.close();
});
