// Regression tests for the bugs found in the code audit (AUDIT_QUIZZETTONE.md /
// PROPOSTE_MIGLIORIE.md): XSS via team names, tiebreak playability, ties at
// the qualification cutoff, atomic answer submission, device clock skew,
// admin inputs wiped by the timer tick, join write failures, the loading
// screen, and the audio upload size limit.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const NS = 'ns=quizzettone-49543-default-rtdb';
const EMULATOR_ROOT = `http://127.0.0.1:9000/quizzettone.json?${NS}`;
const emulatorPath = p => `http://127.0.0.1:9000/quizzettone/${p}.json?${NS}`;
const XSS_NAME = '<img src=x onerror=X()>';

function baseConfig(overrides) {
  return {
    rounds: 1, questionsPerRound: [1], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 5,
    questionDurationMs: 20000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
    finalScoring: null, scoreCarryover: 'reset', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
    answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0},
    ...overrides,
  };
}
function gameState(overrides) {
  return {
    gameName:'Quizzettone', setupLocked:true, joinCode:'ABCDE',
    phase:'lobby', round:1, qIndex:0,
    timer: {status:'idle', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    cancelledQuestions: [], history: {last:null, log:[]},
    checkpoint:null, checkpointMode:null,
    finalists:null, eliminated:null,
    tiebreak:null, winner:null, finalWinnerScoreSnapshot:null,
    standingsVisible:false, solutionRevealed:false, scoringOverrides:{}, standingsReveal:null,
    audioCue:null, partyMode:'none', party:{bonus:null, malus:null, surprise:null},
    gameQuestions: null,
    config: baseConfig({}),
    ...overrides,
  };
}
const q = (id, pool, correctIndex) => ({id, pool, category:'Test', question:'Domanda '+id+'?', options:['Uno','Due','Tre','Quattro'], correctIndex, adminNote:null, audioUrl:null, lastUsedAt:null});
const team = (id, name) => ({id, name, joinedAt: Date.now()});
const runningTimer = (durationMs = 300000) => ({status:'running', startedAt: Date.now(), durationMs, pausedRemainingMs:null, closeReason:null, closedBy:null});

async function seed(request, root) {
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());
}
async function readDb(request, p) {
  return (await request.get(emulatorPath(p))).json();
}
async function openPage(browser, url, opts = {}) {
  const ctx = await browser.newContext(opts.viewport ? { viewport: opts.viewport } : {});
  await ctx.addInitScript(({ skewMs }) => {
    window.X = () => { window.__xss = (window.__xss || 0) + 1; };
    if (skewMs) {
      const RealDate = Date, realNow = RealDate.now.bind(RealDate);
      class SkewedDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(realNow() + skewMs); }
        static now() { return realNow() + skewMs; }
      }
      window.Date = SkewedDate;
    }
  }, { skewMs: opts.skewMs || 0 });
  if (opts.beforeGoto) await opts.beforeGoto(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + url);
  return page;
}
async function openAdmin(browser, opts) {
  const admin = await openPage(browser, '&role=admin', opts);
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  return admin;
}

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('team names are rendered as text, never as HTML, on admin, display and team screens', async ({ browser, request }) => {
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    'teaminfo:team_x': team('team_x', XSS_NAME),
    'teaminfo:team_bad': {id:'team_bad" data-x="1"><img src=x onerror=X()>', name:'Id malevolo', joinedAt:Date.now()},
    state: gameState({ setupLocked:false }),
  });
  const admin = await openAdmin(browser);
  const display = await openPage(browser, '&role=display');
  const alfa = await openPage(browser, '&role=team&id=team_a');

  await expect(admin.locator('.team-tag', { hasText: XSS_NAME })).toBeVisible();
  const res = await request.put(emulatorPath('state/standingsVisible'), { data: true });
  expect(res.ok()).toBeTruthy();
  await expect(display.locator('.rank-name', { hasText: XSS_NAME })).toBeVisible();
  await expect(alfa.locator('.rank-name', { hasText: XSS_NAME })).toBeVisible();
  await admin.waitForTimeout(500);

  for (const p of [admin, display, alfa]) {
    expect(await p.evaluate(() => window.__xss || 0)).toBe(0);
  }
  await expect(admin.locator('text=Id malevolo')).toHaveCount(0);
});

test('tiebreak candidates can answer, even on a non-first tiebreak question and after an earlier tiebreak', async ({ browser, request }) => {
  const TB = [q('tb0','finale',0), q('tb1','finale',1), q('tb2','finale',2)];
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    'teaminfo:team_b': team('team_b', 'Beta'),
    'teaminfo:team_c': team('team_c', 'Gamma'),
    // Risposta rimasta da uno spareggio precedente nella stessa partita.
    'answers:team_b': { 'tiebreak-0': {optionIndex:3, ts:Date.now()-60000} },
    state: gameState({
      phase:'tiebreak_setup',
      tiebreak:{qualifiedSoFar:['team_a'], candidates:['team_b','team_c'], candidateQuestions:TB, question:null, qIndex:null},
      gameQuestions:{rounds:{1:[q('m1','manche',0)]}, final:null, tiebreak:null},
    }),
  });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  const beta = await openPage(browser, '&role=team&id=team_b');
  const gamma = await openPage(browser, '&role=team&id=team_c');

  await admin.click('[data-tb-q="2"]');
  await expect(beta.locator('.opt:not([disabled])')).toHaveCount(4);
  await expect(gamma.locator('.opt:not([disabled])')).toHaveCount(4);
  await expect(alfa.locator('text=Spareggio')).toBeVisible();

  await beta.locator('.opt[data-idx="2"]').click();
  await gamma.locator('.opt[data-idx="0"]').click();
  await expect(beta.locator('.status-banner.sent')).toBeVisible();
  await expect(gamma.locator('.status-banner.sent')).toBeVisible();

  await admin.click('#btnCloseNow');
  await expect(admin.locator('#btnNext')).toBeVisible();
  await expect(alfa.locator('text=Tempo scaduto')).toHaveCount(0);
  await admin.click('#btnNext');
  await expect(admin.locator('h3:has-text("Risultato spareggio")')).toBeVisible();
  await expect(admin.locator('text=Beta — ✓ corretta')).toBeVisible();
  await expect(admin.locator('text=Gamma — ✗ sbagliata')).toBeVisible();
  await expect(admin.locator('.pill', { hasText: 'Suggerita' })).toHaveCount(1);

  await admin.click('[data-assign-winner="team_b"]');
  await expect.poll(async () => (await readDb(request, 'state')).finalists).toEqual(['team_a', 'team_b']);
});

test('two teams tied for the two finalist spots both qualify without a tiebreak', async ({ browser, request }) => {
  const Q = q('m1','manche',0);
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    'teaminfo:team_b': team('team_b', 'Beta'),
    'teaminfo:team_c': team('team_c', 'Gamma'),
    'answers:team_a': { '1-0': {optionIndex:0, ts:Date.now()} },
    'answers:team_b': { '1-0': {optionIndex:0, ts:Date.now()} },
    'answers:team_c': { '1-0': {optionIndex:1, ts:Date.now()} },
    state: gameState({ phase:'checkpoint', checkpoint:{type:'end', round:1}, gameQuestions:{rounds:{1:[Q]}, final:null, tiebreak:null} }),
  });
  const admin = await openAdmin(browser);
  await admin.click('#btnRevealFinalists');
  await expect.poll(async () => (await readDb(request, 'state')).phase).toBe('reveal_finalists');
  const s = await readDb(request, 'state');
  expect([...s.finalists].sort()).toEqual(['team_a', 'team_b']);
  expect(s.eliminated).toEqual(['team_c']);
});

test('a tie below a clear leader still goes to a tiebreak for the remaining spot', async ({ browser, request }) => {
  const Q1 = q('m1','manche',0), Q2 = q('m2','manche',0);
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    'teaminfo:team_b': team('team_b', 'Beta'),
    'teaminfo:team_c': team('team_c', 'Gamma'),
    'answers:team_a': { '1-0': {optionIndex:0, ts:Date.now()}, '1-1': {optionIndex:0, ts:Date.now()} },
    'answers:team_b': { '1-0': {optionIndex:0, ts:Date.now()} },
    'answers:team_c': { '1-1': {optionIndex:0, ts:Date.now()} },
    'question:qf1': q('qf1','finale',0),
    state: gameState({ phase:'checkpoint', checkpoint:{type:'end', round:1}, config: baseConfig({questionsPerRound:[2]}), gameQuestions:{rounds:{1:[Q1,Q2]}, final:null, tiebreak:null} }),
  });
  const admin = await openAdmin(browser);
  await admin.click('#btnRevealFinalists');
  await expect.poll(async () => (await readDb(request, 'state')).phase).toBe('tiebreak_setup');
  const s = await readDb(request, 'state');
  expect(s.tiebreak.qualifiedSoFar).toEqual(['team_a']);
  expect([...s.tiebreak.candidates].sort()).toEqual(['team_b', 'team_c']);
});

test('a fast double tap keeps the first answer', async ({ browser, request }) => {
  const Q = q('m1','manche',0);
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    state: gameState({ phase:'question', timer: runningTimer(), gameQuestions:{rounds:{1:[Q]}, final:null, tiebreak:null} }),
  });
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(alfa.locator('.opt:not([disabled])')).toHaveCount(4);
  await alfa.evaluate(() => {
    document.querySelector('.opt[data-idx="0"]').click();
    document.querySelector('.opt[data-idx="1"]').click();
  });
  await expect(alfa.locator('.status-banner.sent')).toBeVisible();
  await alfa.waitForTimeout(800);
  expect((await readDb(request, 'answers:team_a'))['1-0'].optionIndex).toBe(0);
});

test('a phone whose clock runs ahead neither closes the question early nor loses time or speed bonus', async ({ browser, request }) => {
  const Q = q('m1','manche',0);
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    'teaminfo:team_b': team('team_b', 'Beta'),
    state: gameState({
      phase:'question', timer: runningTimer(20000),
      config: baseConfig({ speedBonus:{enabled:true, maxBonus:5, windowMs:10000} }),
      gameQuestions:{rounds:{1:[Q]}, final:null, tiebreak:null},
    }),
  });
  const ahead30 = await openPage(browser, '&role=team&id=team_b', { skewMs: 30000 });
  const ahead15 = await openPage(browser, '&role=team&id=team_a', { skewMs: 15000 });
  await expect(ahead15.locator('.opt:not([disabled])')).toHaveCount(4);
  const shown = parseInt(await ahead15.locator('.timer-num').textContent(), 10);
  expect(shown).toBeGreaterThanOrEqual(15);
  await ahead15.locator('.opt[data-idx="0"]').click();
  await expect(ahead15.locator('.status-banner.sent')).toBeVisible();

  const answer = (await readDb(request, 'answers:team_a'))['1-0'];
  expect(Math.abs(answer.ts - Date.now())).toBeLessThan(5000);
  expect(answer.speedBonus).toBeGreaterThanOrEqual(3);

  await ahead30.waitForTimeout(1500);
  expect((await readDb(request, 'state')).phase).toBe('question');
});

test('admin can type in the per-question scoring fields while the timer runs', async ({ browser, request }) => {
  const Q = q('m1','manche',0);
  await seed(request, {
    'teaminfo:team_a': team('team_a', 'Alfa'),
    state: gameState({ phase:'question', timer: runningTimer(), gameQuestions:{rounds:{1:[Q]}, final:null, tiebreak:null} }),
  });
  const admin = await openAdmin(browser);
  await admin.fill('#qsCorrect', '7');
  await admin.waitForTimeout(1500);
  await expect(admin.locator('#qsCorrect')).toHaveValue('7');
  await expect(admin.locator('.timer-num')).not.toHaveText('300');
});

test('a failed team registration shows an error instead of a fake "you are in"', async ({ browser, request }) => {
  await seed(request, { state: gameState({ setupLocked:false }) });
  const page = await openPage(browser, '&role=team');
  await page.evaluate(() => { window.safeSet = async () => false; });
  await page.fill('#teamNameInput', 'Delta');
  await page.click('#btnJoin');
  await expect(page.locator('#joinError')).toBeVisible();
  await expect(page.locator('#joinError')).toContainText('connessione');
  await expect(page.locator('text=Sei dentro')).toHaveCount(0);
});

test('an unreachable database shows a loading message, then an error with a reload button', async ({ browser }) => {
  const page = await openPage(browser, '&role=display', {
    beforeGoto: async ctx => {
      await ctx.routeWebSocket(/127\.0\.0\.1:9000/, () => {});
      await ctx.route(/127\.0\.0\.1:9000/, r => r.abort());
    },
  });
  await expect(page.locator('text=Connessione al gioco')).toBeVisible();
  await expect(page.locator('text=Impossibile collegarsi')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#btnReloadApp')).toBeVisible();
});

test('audio files over 10 MB are rejected before any upload starts', async ({ browser }) => {
  const page = await openPage(browser, '&role=display', {
    beforeGoto: ctx => ctx.route(/firebasestorage\.googleapis\.com/, r => r.abort()),
  });
  const result = await page.evaluate(() => Promise.race([
    uploadAudioFile(new File([new Uint8Array(11 * 1024 * 1024)], 'big.mp3', { type: 'audio/mpeg' }), 'test')
      .then(() => 'caricato', e => 'errore: ' + e.message),
    new Promise(r => setTimeout(() => r('nessuna risposta'), 3000)),
  ]));
  expect(result).toContain('troppo grande');
});

test('admin tables on a phone do not make the page scroll sideways', async ({ browser, request }) => {
  const Q = q('m1','manche',0);
  const root = { state: gameState({
    phase:'closed', round:3, config: baseConfig({ rounds:3, questionsPerRound:[1,1,1] }),
    timer: {status:'closed', startedAt:Date.now(), durationMs:20000, pausedRemainingMs:null, closeReason:'manual', closedBy:'admin'},
    gameQuestions:{rounds:{1:[Q],2:[Q],3:[Q]}, final:null, tiebreak:null},
  }) };
  ['team_a','team_b','team_c','team_d'].forEach((id, i) => {
    root['teaminfo:' + id] = team(id, 'Squadronissimiinvincibili'.slice(0, 22) + i);
    root['answers:' + id] = { '3-0': {optionIndex:i % 4, ts:Date.now()} };
  });
  await seed(request, root);
  const admin = await openAdmin(browser, { viewport: { width: 375, height: 800 } });
  await expect(admin.locator('h3:has-text("Stato squadre")')).toBeVisible();
  const [scrollWidth, innerWidth] = await admin.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
