// Verifies the finals spectator mode (eliminated teams see finalist status
// without answer text until the configured visibility point, and can't
// submit answers themselves) and the unified tiebreak flow for a final tie.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const EMULATOR_ROOT = 'http://127.0.0.1:9000/quizzettone.json?ns=quizzettone-49543-default-rtdb';

function baseConfig(overrides) {
  return {
    rounds: 2, questionsPerRound: [1, 1], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 5,
    questionDurationMs: 20000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
    finalScoring: null, scoreCarryover: 'reset', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
    answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0},
    ...overrides,
  };
}

const FINAL_Q = {id:'qf1', pool:'finale', category:'Test', question:'Domanda finale?', options:['Uno','Due','Tre','Quattro'], correctIndex:0};

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('eliminated team sees spectator status, not answer buttons, and cannot submit', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const root = {
    'teaminfo:team_f1': {id:'team_f1', name:'Finalista Uno', joinedAt:Date.now()},
    'teaminfo:team_f2': {id:'team_f2', name:'Finalista Due', joinedAt:Date.now()},
    'teaminfo:team_e1': {id:'team_e1', name:'Eliminata Uno', joinedAt:Date.now()},
    state: {
      gameName:'Quizzettone', setupLocked:true, joinCode:'ABCDE',
      phase:'question', round:'final', qIndex:0,
      timer: {status:'running', startedAt: Date.now(), durationMs:300000, pausedRemainingMs:null, closeReason:null, closedBy:null},
      cancelledQuestions: [], history: {last:null, log:[]},
      checkpoint:null, checkpointMode:null,
      finalists: ['team_f1','team_f2'], eliminated: ['team_e1'],
      tiebreak:null, winner:null, finalWinnerScoreSnapshot:null,
      standingsVisible:false, solutionRevealed:false, scoringOverrides:{}, standingsReveal:null,
      audioCue:null, partyMode:'none', party:{bonus:null, malus:null, surprise:null},
      gameQuestions: { rounds:{1:[{id:'q1',pool:'manche',category:'T',question:'Q1?',options:['A','B','C','D'],correctIndex:0}]}, final:[FINAL_Q], tiebreak:null },
      config: baseConfig({ answerVisibilityForEliminated: 'live' }),
    },
  };
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());

  // Come nell'uso reale, l'admin carica la pagina per primo: è lui a far
  // partire la migrazione one-shot dal vecchio schema piatto (PL-09) verso
  // sessions/current/..., prima che una squadra provi a recuperare la sua
  // identità da lì. Bootstrap-only: si chiude subito dopo, il resto del test
  // apre i suoi context come prima.
  const bootstrapCtx = await browser.newContext();
  const bootstrap = await bootstrapCtx.newPage();
  await bootstrap.goto(BASE + '&role=admin');
  await bootstrap.fill('#adminPinInput', '2468');
  await bootstrap.click('#btnPinConfirm');
  // Questo game è già in fase 'question' (non 'lobby'), quindi non c'è una
  // lista squadre da controllare qui: basta attendere che il pannello di
  // regia della domanda finale sia visibile, segno che 'state' è stato letto
  // correttamente dal ramo migrato.
  await expect(bootstrap.locator('.pill', { hasText: 'FINALE' })).toBeVisible();
  await bootstrapCtx.close();

  const f1Ctx = await browser.newContext();
  const f1 = await f1Ctx.newPage();
  await f1.goto(BASE + '&role=team&id=team_f1');

  const e1Ctx = await browser.newContext();
  const e1 = await e1Ctx.newPage();
  await e1.goto(BASE + '&role=team&id=team_e1');

  await expect(e1.locator('.eyebrow', { hasText: 'Modalità spettatore' })).toBeVisible();
  await expect(e1.locator('.opt')).toHaveCount(0);
  await expect(e1.locator('text=Finalista Uno')).toBeVisible();
  await expect(e1.locator('text=Finalista Due')).toBeVisible();
  await expect(e1.locator('.pill', { hasText: 'Sta pensando' })).toHaveCount(2);

  // F1 answers correctly; visibility is 'live' so the eliminated team sees
  // it immediately, status flips to locked, but correctness stays hidden
  // (grey, not green) until the admin reveals the solution.
  await f1.locator('.opt').first().click();
  await expect(e1.locator('.pill', { hasText: 'Risposta bloccata' })).toHaveCount(1);
  await expect(e1.locator('text=A) Uno')).toBeVisible();

  // Attempting to submit an answer as an eliminated team must be rejected
  // server-side even if something tried to call it directly.
  const rejected = await e1.evaluate(async () => {
    await teamSubmitAnswer('final', 0, 1);
    const snap = await db.ref('quizzettone/' + answersPath('team_e1')).once('value');
    return snap.val();
  });
  expect(rejected).toBeNull();

  await adminClosesFor();

  await expect(e1.locator('.pill', { hasText: 'Tempo scaduto' })).toHaveCount(1);

  await f1Ctx.close();
  await e1Ctx.close();

  async function adminClosesFor() {
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await admin.goto(BASE + '&role=admin');
    await admin.fill('#adminPinInput', '2468');
    await admin.click('#btnPinConfirm');
    await admin.click('#btnCloseNow');
    await adminCtx.close();
  }
});

test('a tied final score routes into the same tiebreak flow as qualification ties', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const root = {
    'teaminfo:team_f1': {id:'team_f1', name:'Finalista Uno', joinedAt:Date.now()},
    'teaminfo:team_f2': {id:'team_f2', name:'Finalista Due', joinedAt:Date.now()},
    'answers:team_f1': { 'final-0': {optionIndex:0, ts:Date.now()} },
    'answers:team_f2': { 'final-0': {optionIndex:0, ts:Date.now()} },
    // Serve almeno una domanda 'finale' nel mazzo persistente: adminRevealWinner
    // pesca i candidati di spareggio da lì (drawQuestionsForGame), non da
    // gameQuestions.final. Seedato esplicitamente per non dipendere dal
    // timing asincrono di ensureSeedQuestions().
    'question:qbank_final_1': {id:'qbank_final_1', pool:'finale', category:'Test', question:'Domanda spareggio finale?', options:['Uno','Due','Tre','Quattro'], correctIndex:0, adminNote:null, audioUrl:null, lastUsedAt:null},
    state: {
      gameName:'Quizzettone', setupLocked:true, joinCode:'ABCDE',
      phase:'final_ready', round:'final', qIndex:0,
      timer: {status:'closed', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:'manual', closedBy:'admin'},
      cancelledQuestions: [], history: {last:null, log:[]},
      checkpoint:null, checkpointMode:null,
      finalists: ['team_f1','team_f2'], eliminated: [],
      tiebreak:null, winner:null, finalWinnerScoreSnapshot:null,
      standingsVisible:false, solutionRevealed:true, scoringOverrides:{}, standingsReveal:null,
      audioCue:null, partyMode:'none', party:{bonus:null, malus:null, surprise:null},
      gameQuestions: { rounds:{1:[],2:[]}, final:[FINAL_Q], tiebreak:null },
      config: baseConfig({}),
    },
  };
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await expect(admin.locator('h3:has-text("Finale conclusa")')).toBeVisible();
  await admin.click('#btnRevealWinner');

  // Tied final score: must land in the same tiebreak_setup screen used for
  // qualification, not an immediate "TIE, pick anyone" shortcut.
  await expect(admin.locator('h3:has-text("Spareggio necessario")')).toBeVisible();
  await expect(admin.locator('[data-tb-q]').first()).toBeVisible();
  await admin.click('[data-tb-q="0"]');

  await expect(admin.locator('.qmeta').first()).toBeVisible();
  await admin.click('#btnCloseNow');
  // Chiudere le risposte porta a 'closed'; serve un secondo comando esplicito
  // ("Verifica risultato spareggio", cioè adminNextQuestion) per passare a
  // 'tiebreak_closed' e vedere il pannello di assegnazione del vincitore.
  await admin.click('#btnNext');

  await expect(admin.locator('h3:has-text("Risultato spareggio")')).toBeVisible();
  const firstAssignBtn = admin.locator('[data-assign-winner]').first();
  const winnerId = await firstAssignBtn.getAttribute('data-assign-winner');
  await firstAssignBtn.click();

  await expect(admin.locator('text=Campioni del Quizzettone')).toBeVisible();
  const winnerName = winnerId === 'team_f1' ? 'Finalista Uno' : 'Finalista Due';
  await expect(admin.locator('.winner-name', { hasText: winnerName })).toBeVisible();

  await adminCtx.close();
});

// PL-16: scoreCarryover era configurabile ma mai letto da nessuna funzione
// di scoring. Questo test copre il percorso reale end-to-end per "Azzera":
// una squadra domina la qualificazione, l'altra non risponde affatto, ma in
// finale è quest'ultima a rispondere correttamente — con "Azzera" deve
// essere lei a vincere (il vantaggio di qualificazione va davvero a zero),
// non la squadra che aveva dominato la qualificazione. Le altre due
// modalità ("Mantieni"/"Vantaggio") sono coperte a fondo, formula per
// formula, da tests/unit/final-carryover.spec.js.
test('scoreCarryover "Azzera": la finale si decide solo sul rendimento in finale, non sulla qualificazione', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.fill('#setupFinalistCount', '2');
  await admin.fill('#setupFinalQuestionCount', '1');
  await admin.click('#btnToggleAdvancedSetup');
  await admin.selectOption('#setupScoreCarryover', 'reset');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const dominantCtx = await browser.newContext();
  const dominant = await dominantCtx.newPage();
  await dominant.goto(BASE);
  await dominant.click('#btnTeam');
  await dominant.fill('#teamNameInput', 'Squadra Dominante');
  await dominant.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Dominante' })).toBeVisible();

  const comebackCtx = await browser.newContext();
  const comeback = await comebackCtx.newPage();
  await comeback.goto(BASE);
  await comeback.click('#btnTeam');
  await comeback.fill('#teamNameInput', 'Squadra Rimonta');
  await comeback.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Rimonta' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  // Qualificazione: solo "Squadra Dominante" risponde, e risponde giusto.
  const correctIdx1 = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  await dominant.locator('.opt').nth(correctIdx1).click();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext'); // fine dell'unica manche -> con 1 sola manche va dritto a "Fine qualificazione"
  await expect(admin.locator('#btnRevealFinalists')).toBeVisible();
  await admin.click('#btnRevealFinalists');
  await expect(admin.locator('h3:has-text("Finaliste svelate")')).toBeVisible();
  await admin.click('#btnGoFinal');
  await expect(admin.locator('.qmeta').first()).toContainText('FINALE');

  // Finale: stavolta risponde solo "Squadra Rimonta", e risponde giusto.
  const correctIdx2 = await admin.evaluate(() => getQuestion('final', 0).correctIndex);
  await comeback.locator('.opt').nth(correctIdx2).click();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext'); // fine finale -> "Finale conclusa"
  await admin.click('#btnRevealWinner');

  await expect(admin.locator('text=Campioni del Quizzettone')).toBeVisible();
  // "Azzera": vince chi ha risposto meglio in FINALE, non chi dominava la
  // qualificazione — l'opposto di quel che sarebbe successo con "Mantieni".
  await expect(admin.locator('.winner-name', { hasText: 'Squadra Rimonta' })).toBeVisible();

  await adminCtx.close();
  await dominantCtx.close();
  await comebackCtx.close();
});
