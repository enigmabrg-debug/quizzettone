// Verifies the remaining Phase 3 features: test mode (fake teams that answer
// on their own so the admin can rehearse timer/audio/display without real
// players) and the final-stats + rematch flow (podium/accuracy computed at
// game end, "Rivincita" keeps the same real teams and config with scores
// reset instead of wiping everything like a full reset).
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const EMULATOR_ROOT = 'http://127.0.0.1:9000/quizzettone.json?ns=quizzettone-49543-default-rtdb';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('test mode teams answer on their own during a rehearsal question, and are tagged PROVA', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(500);

  await admin.click('#btnToggleTestMode');
  await expect(admin.locator('#btnToggleTestMode')).toContainText('Disattiva');
  await admin.click('#btnAddTestTeams');
  await expect(admin.locator('.team-tag', { hasText: 'PROVA' })).toHaveCount(4);

  await admin.click('#btnStart');
  await expect(admin.locator('.qmeta').first()).toBeVisible();

  // All 4 fake teams answer on their own within the question's timer window,
  // without any external browser context acting on their behalf.
  await expect(admin.locator('.pill', { hasText: '4 ricevute' })).toBeVisible({ timeout: 25_000 });

  await adminCtx.close();
});

test('final stats show a podium and "Rivincita" resets scores while keeping the same real teams and config', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const root = {
    'teaminfo:team_a': {id:'team_a', name:'Squadra Vincente', joinedAt:Date.now()},
    'teaminfo:team_b': {id:'team_b', name:'Squadra Seconda', joinedAt:Date.now()},
    'answers:team_a': { '1-0': {optionIndex:0, ts:1000}, 'final-0': {optionIndex:0, ts:1000} },
    'answers:team_b': { '1-0': {optionIndex:1, ts:2000}, 'final-0': {optionIndex:1, ts:2000} },
    state: {
      gameName:'Quizzettone', setupLocked:true, joinCode:'ABCDE',
      phase:'reveal_winner', round:'final', qIndex:0,
      timer: {status:'closed', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:'manual', closedBy:'admin'},
      cancelledQuestions: [], history: {last:null, log:[]},
      checkpoint:null, checkpointMode:null,
      finalists: ['team_a','team_b'], eliminated: [],
      tiebreak:null, winner:'team_a', finalWinnerScoreSnapshot: [{id:'team_a', score:1}, {id:'team_b', score:0}],
      standingsVisible:false, solutionRevealed:true, scoringOverrides:{}, standingsReveal:null,
      audioCue:null, partyMode:'none', party:{bonus:null, malus:null, surprise:null},
      gameId: 'game_test123',
      gameQuestions: {
        rounds: {1:[{id:'q1', pool:'manche', category:'Test', question:'Domanda manche?', options:['Giusta','Sbagliata','C','D'], correctIndex:0}]},
        final: [{id:'qf1', pool:'finale', category:'Test', question:'Domanda finale?', options:['Giusta','Sbagliata','C','D'], correctIndex:0}],
        tiebreak: null,
      },
      config: {
        rounds: 1, questionsPerRound: [1], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 2,
        questionDurationMs: 20000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
        finalScoring: null, scoreCarryover: 'reset', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
        lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
        answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0},
      },
    },
  };
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await expect(admin.locator('text=Statistiche della serata')).toBeVisible();
  // Podium: the winning team appears first (🥇), ahead of the runner-up.
  const podiumRows = admin.locator('.rank-row');
  await expect(podiumRows.first()).toContainText('Squadra Vincente');
  await expect(admin.locator('text=100% di risposte corrette')).toHaveCount(0); // team_b got both wrong: accuracy must be 50%, not 100%
  await expect(admin.locator('text=50% di risposte corrette')).toBeVisible();

  await admin.click('#btnStartRematch');

  // Back in the lobby, same real teams still present, config preserved,
  // scores reset — a rematch, not a full wipe.
  await expect(admin.locator('h3:has-text("Sala pre-partita")')).toBeVisible();
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Vincente' })).toBeVisible();
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Seconda' })).toBeVisible();

  const scores = await admin.evaluate(() => Object.keys(teams).map(id => totalScore(id)));
  expect(scores.every(s => s === 0)).toBe(true);
  const roundsCfg = await admin.evaluate(() => state.config.rounds);
  expect(roundsCfg).toBe(1);

  await adminCtx.close();
});
