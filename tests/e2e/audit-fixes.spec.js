// Regression tests for the findings of AUDIT_QUIZZETTONE.md (2026-10-22) that
// PR #3 did not cover: tiebreaks, ties at the finalist cutoff, undo snapshot
// growth, concurrent admin writes, admin forms wiped by re-renders, rematch,
// final standings, duplicate questions, late join, tied positions, the
// Vero/Falso checklist and the admin layout on phones.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const NS = 'ns=quizzettone-49543-default-rtdb';
const ROOT_URL = `http://127.0.0.1:9000/quizzettone.json?${NS}`;
const sessionUrl = p => `http://127.0.0.1:9000/quizzettone/sessions/current/${p}.json?${NS}`;

function config(overrides) {
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
    gameName:'Quizzettone', setupLocked:true, joinCode:'ABCDE', phase:'lobby', round:1, qIndex:0,
    timer: {status:'idle', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    history: {last:null, log:[]}, partyMode:'none', presentation:{resolvedMode:'team_devices', fallbackActive:false},
    config: config({}), ...overrides,
  };
}
const q = (id, pool, correctIndex, extra) => ({id, pool, category:'Storia', question:'Domanda '+id+'?', options:['Uno','Due','Tre','Quattro'], correctIndex, adminNote:null, audioUrl:null, lastUsedAt:null, ...(extra||{})});
const team = (id, name, extra) => ({id, name, joinedAt: Date.now(), ...(extra||{})});
const running = (ms) => ({status:'running', startedAt: Date.now(), durationMs: ms || 300000, pausedRemainingMs:null, closeReason:null, closedBy:null});
const answer = (optionIndex, extra) => ({optionIndex, ts: Date.now(), ...(extra||{})});

async function seed(request, session, rootExtra) {
  const res = await request.put(ROOT_URL, { data: { sessions: { current: session }, ...(rootExtra||{}) } });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());
}
async function readSession(request, p) { return (await request.get(sessionUrl(p))).json(); }
async function openPage(browser, url, opts) {
  const ctx = await browser.newContext(opts && opts.viewport ? { viewport: opts.viewport } : {});
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

test.beforeEach(async ({ request }) => { await resetDatabase(request); });

test('team ids that the app did not generate are ignored (they end up inside HTML attributes)', async ({ browser, request }) => {
  await seed(request, { state: gameState({ setupLocked:false }), teams: {
    team_ok1: team('team_ok1', 'Squadra buona'),
    'x" onclick="alert(1)': {id:'x" onclick="alert(1)', name:'Chiave malevola', joinedAt: Date.now()},
  } });
  const admin = await openAdmin(browser);
  await expect(admin.locator('.team-tag', { hasText: 'Squadra buona' })).toBeVisible();
  await expect(admin.locator('text=Chiave malevola')).toHaveCount(0);
});

test('tiebreak: candidates answer from their phones, on a non-first question, after an earlier tiebreak', async ({ browser, request }) => {
  const TB = [q('tb0','finale',0), q('tb1','finale',1), q('tb2','finale',2)];
  await seed(request, {
    state: gameState({ phase:'tiebreak_setup', tiebreak:{qualifiedSoFar:['team_a'], candidates:['team_b','team_c'], candidateQuestions:TB, question:null, qIndex:null} }),
    questionInstances: { rounds:{1:[q('m1','manche',0)]} },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma') },
    answers: { team_b: { 'tiebreak-0': answer(3) } },
  });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  const beta = await openPage(browser, '&role=team&id=team_b');
  const gamma = await openPage(browser, '&role=team&id=team_c');

  await admin.click('[data-tb-q="2"]');
  await expect(beta.locator('.opt:not([disabled])')).toHaveCount(4);
  await expect(gamma.locator('.opt:not([disabled])')).toHaveCount(4);
  await expect(alfa.locator('text=Spareggio in corso')).toBeVisible();
  await beta.locator('.opt[data-idx="2"]').click();
  await gamma.locator('.opt[data-idx="0"]').click();
  await expect(beta.locator('.status-banner.sent')).toBeVisible();
  await expect(gamma.locator('.status-banner.sent')).toBeVisible();

  await admin.click('#btnCloseNow');
  await expect(admin.locator('#btnNext')).toBeVisible();
  await expect(alfa.locator('text=Tempo scaduto')).toHaveCount(0);
  await admin.click('#btnNext');
  await expect(admin.locator('text=Beta — ✓ corretta')).toBeVisible();
  await expect(admin.locator('text=Gamma — ✗ sbagliata')).toBeVisible();
  await expect(admin.locator('.pill', { hasText: 'Suggerita' })).toHaveCount(1);
  await admin.click('[data-assign-winner="team_b"]');
  await expect.poll(async () => (await readSession(request, 'state')).finalists).toEqual(['team_a', 'team_b']);
});

test('two teams tied for the two finalist spots both qualify without a tiebreak', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'checkpoint', checkpoint:{type:'end', round:1} }),
    questionInstances: { rounds:{1:[q('m1','manche',0)]} },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma') },
    answers: { team_a:{'1-0':answer(0)}, team_b:{'1-0':answer(0)}, team_c:{'1-0':answer(1)} },
  });
  const admin = await openAdmin(browser);
  await admin.click('#btnRevealFinalists');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('reveal_finalists');
  const s = await readSession(request, 'state');
  expect([...s.finalists].sort()).toEqual(['team_a', 'team_b']);
  expect(s.eliminated).toEqual(['team_c']);
});

test('three teams tied for first with two spots: the tiebreak assigns both spots without blocking', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'checkpoint', checkpoint:{type:'end', round:1} }),
    questionInstances: { rounds:{1:[q('m1','manche',0)]} },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma'), team_d: team('team_d','Delta') },
    answers: { team_a:{'1-0':answer(0)}, team_b:{'1-0':answer(0)}, team_c:{'1-0':answer(0)}, team_d:{'1-0':answer(1)} },
  }, { questionBank: { qf1: q('qf1','finale',0), qf2: q('qf2','finale',1) } });
  const admin = await openAdmin(browser);
  await admin.click('#btnRevealFinalists');
  await admin.click('[data-tb-q="0"]');
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
  await expect(admin.locator('text=Posti in finale ancora da assegnare: 2')).toBeVisible();
  await admin.click('[data-assign-winner="team_c"]');
  await expect(admin.locator('text=Posti in finale ancora da assegnare: 1')).toBeVisible();
  await expect(admin.locator('[data-assign-winner]')).toHaveCount(2);
  await admin.click('[data-assign-winner="team_a"]');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('reveal_finalists');
  const s = await readSession(request, 'state');
  expect(s.finalists).toEqual(['team_c', 'team_a']);
  expect([...s.eliminated].sort()).toEqual(['team_b', 'team_d']);
});

test('a tie below a clear leader still goes to a tiebreak for the remaining spot', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'checkpoint', checkpoint:{type:'end', round:1}, config: config({questionsPerRound:[2]}) }),
    questionInstances: { rounds:{1:[q('m1','manche',0), q('m2','manche',0)]} },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma') },
    answers: { team_a:{'1-0':answer(0), '1-1':answer(0)}, team_b:{'1-0':answer(0)}, team_c:{'1-1':answer(0)} },
  }, { questionBank: { qf1: q('qf1','finale',0) } });
  const admin = await openAdmin(browser);
  await admin.click('#btnRevealFinalists');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('tiebreak_setup');
  const s = await readSession(request, 'state');
  expect(s.tiebreak.qualifiedSoFar).toEqual(['team_a']);
  expect([...s.tiebreak.candidates].sort()).toEqual(['team_b', 'team_c']);
});

test('final tiebreak "a oltranza": no suggestion when both answer right, another question can be played', async ({ browser, request }) => {
  const TB = [q('tb0','finale',0), q('tb1','finale',1)];
  await seed(request, {
    state: gameState({ phase:'tiebreak_setup', round:'final', finalists:['team_a','team_b'],
      tiebreak:{qualifiedSoFar:[], candidates:['team_a','team_b'], candidateQuestions:TB, question:null, qIndex:null, forFinal:true} }),
    questionInstances: { rounds:{1:[q('m1','manche',0)]}, final:[q('f1','finale',0)] },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta') },
  });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  const beta = await openPage(browser, '&role=team&id=team_b');
  await admin.click('[data-tb-q="0"]');
  await alfa.locator('.opt[data-idx="0"]').click();
  await beta.locator('.opt[data-idx="0"]').click();
  await expect(beta.locator('.status-banner.sent')).toBeVisible();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
  await expect(admin.locator('h3:has-text("Risultato spareggio")')).toBeVisible();
  await expect(admin.locator('.pill', { hasText: 'Suggerita' })).toHaveCount(0);
  await admin.click('#btnNewTiebreakQuestion');
  await expect(admin.locator('[data-tb-q]')).toHaveCount(1);
  await admin.click('[data-tb-q="0"]');
  await expect(alfa.locator('.opt:not([disabled])')).toHaveCount(4);
  await alfa.locator('.opt[data-idx="1"]').click();
  await beta.locator('.opt[data-idx="2"]').click();
  await expect(beta.locator('.status-banner.sent')).toBeVisible();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
  await expect(admin.locator('.pill', { hasText: 'Suggerita' })).toHaveCount(1);
  await admin.click('[data-assign-winner="team_a"]');
  await expect.poll(async () => (await readSession(request, 'state')).winner).toBe('team_a');
});

test('undoable actions keep the state small, and undo still restores the previous value', async ({ browser, request }) => {
  const r1 = []; for (let i = 0; i < 15; i++) r1.push(q('a'+i, 'manche', 0));
  const teamsObj = {}; for (let i = 0; i < 10; i++) teamsObj['team_t'+i] = team('team_t'+i, 'Squadra '+i);
  await seed(request, { state: gameState({ phase:'checkpoint', checkpoint:{type:'mid', round:1}, config: config({questionsPerRound:[15]}) }), questionInstances: { rounds:{1:r1} }, teams: teamsObj });
  const admin = await openAdmin(browser);
  await admin.locator('#btnModePause').waitFor();
  const sizes = await admin.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 16; i++) {
      await adminSetCheckpointMode(i % 2 ? 'pause' : 'classifica');
      await new Promise(r => setTimeout(r, 200));
      out.push(JSON.stringify(state).length);
    }
    return out;
  });
  expect(Math.max(...sizes)).toBeLessThan(20000);
  expect((await readSession(request, 'state')).checkpointMode).toBe('pause');
  await admin.click('#btnUndoLast');
  await expect.poll(async () => (await readSession(request, 'state')).checkpointMode).toBe('classifica');
  const s = await readSession(request, 'state');
  expect(s.history.last).toBeFalsy();
  expect(s.history.log.slice(-1)[0].type).toBe('undo');
});

test('two admin tabs acting at the same moment do not cancel each other', async ({ browser, request }) => {
  await seed(request, { state: gameState({ phase:'checkpoint', checkpoint:{type:'mid', round:1} }), questionInstances: { rounds:{1:[q('m1','manche',0)]} }, teams: { team_a: team('team_a','Alfa') } });
  const a1 = await openAdmin(browser);
  const a2 = await openAdmin(browser);
  await a1.locator('#btnModePause').waitFor();
  await a2.locator('#btnModePause').waitFor();
  await Promise.all([a1.evaluate(() => adminToggleStandings()), a2.evaluate(() => adminSetCheckpointMode('classifica'))]);
  await expect.poll(async () => { const s = await readSession(request, 'state'); return [s.standingsVisible, s.checkpointMode]; }).toEqual([true, 'classifica']);
});

test('admin typing is preserved: per-question scoring during the timer, Sala while teams join and with a Display open', async ({ browser, request }) => {
  await seed(request, { state: gameState({ phase:'question', timer: running() }), questionInstances: { rounds:{1:[q('m1','manche',0), q('m2','manche',1)]} }, teams: { team_a: team('team_a','Alfa') } });
  const admin = await openAdmin(browser);
  await admin.fill('#qsCorrect', '7');
  await admin.waitForTimeout(1200);
  await expect(admin.locator('#qsCorrect')).toHaveValue('7');

  await resetDatabase(request);
  await seed(request, { state: gameState({ setupLocked:false }), teams: { team_a: team('team_a','Alfa') } });
  const sala = await openAdmin(browser);
  await sala.locator('#setupGameName').waitFor();
  await sala.fill('#setupGameName', 'Serata di Halloween');
  await sala.fill('#setupRounds', '3');
  await request.put(sessionUrl('teams/team_b'), { data: team('team_b', 'Beta') });
  await expect(sala.locator('.team-tag', { hasText: 'Beta' })).toBeVisible();
  await openPage(browser, '&role=display');
  await sala.waitForTimeout(3000);
  await expect(sala.locator('#setupGameName')).toHaveValue('Serata di Halloween');
  await expect(sala.locator('#setupRounds')).toHaveValue('3');
  await sala.click('#btnSaveSetup');
  await expect.poll(async () => (await readSession(request, 'state')).gameName).toBe('Serata di Halloween');
});

test('rematch clears the answers of rehearsal teams too', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'reveal_winner', winner:'team_a', finalists:['team_a','test_x'] }),
    questionInstances: { rounds:{1:[q('m1','manche',0)]} },
    teams: { team_a: team('team_a','Alfa'), test_x: team('test_x','Squadra prova 1', {isTest:true, ready:true}) },
    answers: { team_a:{'1-0':answer(0)}, test_x:{'1-0':answer(0)} },
  });
  const admin = await openAdmin(browser);
  await admin.click('#btnStartRematch');
  await expect.poll(async () => (await readSession(request, 'state')).phase || 'lobby').toBe('lobby');
  expect(await readSession(request, 'answers')).toBeNull();
});

test('with "Azzera" the final standings put the champion first, not an eliminated team', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'reveal_winner', round:'final', winner:'team_a', finalists:['team_a','team_b'], eliminated:['team_c'], config: config({questionsPerRound:[3], scoreCarryover:'reset'}) }),
    questionInstances: { rounds:{1:[q('m1','manche',0), q('m2','manche',0), q('m3','manche',0)]}, final:[q('f1','finale',0)] },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma') },
    answers: {
      team_a:{'1-0':answer(0), 'final-0':answer(0)},
      team_b:{'1-0':answer(0), '1-1':answer(0)},
      team_c:{'1-0':answer(0), '1-1':answer(0), '1-2':answer(0)},
    },
  });
  const display = await openPage(browser, '&role=display');
  const podium = display.locator('.rank-name', { hasText: '🥇' });
  await expect(podium).toContainText('Alfa');
  const admin = await openAdmin(browser);
  await admin.click('#btnToggleStandings');
  await expect(display.locator('.rank-row').first()).toContainText('Alfa');
});

test('duplicate questions in the bank are never drawn twice in the same game', async ({ browser, request }) => {
  const dup = { pool:'manche', category:'Storia', question:'Chi scoprì l\'America?', options:['Colombo','Vespucci','Magellano','Caboto'], correctIndex:0 };
  // 4 domande richieste e 4 nel mazzo, di cui 2 identiche: senza il blocco le pescherebbe tutte.
  await seed(request, { state: gameState({ setupLocked:false, config: config({questionsPerRound:[4]}) }), teams: { team_a: team('team_a','Alfa') } }, {
    questionBank: {
      qa: {id:'qa', ...dup}, qb: {id:'qb', ...dup},
      qc: {id:'qc', pool:'manche', category:'Sport', question:'Domanda C?', options:['1','2','3','4'], correctIndex:0},
      qd: {id:'qd', pool:'manche', category:'Musica', question:'Domanda D?', options:['1','2','3','4'], correctIndex:0},
    },
  });
  const admin = await openAdmin(browser);
  await admin.locator('#btnStart').click();
  await admin.locator('#startSummaryConfirm').click();
  await expect.poll(async () => ((await readSession(request, 'questionInstances')) || {}).rounds ? 1 : 0).toBe(1);
  const gq = await readSession(request, 'questionInstances');
  const texts = gq.rounds[1].map(x => x.question);
  expect(texts.length).toBe(3);
  expect(new Set(texts).size).toBe(3);
  await expect(admin.locator('.qtext').first()).toBeVisible();
});

test('a team joining while a question is open plays from the next one, without the "no answer" malus', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'question', timer: running(), config: config({questionsPerRound:[2], scoring:{correct:1, wrong:0, noAnswer:-1}}) }),
    questionInstances: { rounds:{1:[q('m1','manche',0, {presentedAt: Date.now() - 5000}), q('m2','manche',1)]} },
    teams: { team_a: team('team_a','Alfa') },
  });
  const late = await openPage(browser, '&role=team');
  await late.fill('#teamNameInput', 'Ritardataria');
  await late.click('#btnJoin');
  await expect(late.locator('text=partecipate dalla prossima')).toBeVisible();
  await expect(late.locator('.opt:not([disabled])')).toHaveCount(0);
  const admin = await openAdmin(browser);
  await admin.click('#btnCloseNow');
  await expect(admin.locator('td', { hasText: 'Entrata dopo' })).toBeVisible();
  const lateId = await late.evaluate(() => teamId);
  expect(await admin.evaluate(id => teamPointsForQuestion(id, 1, 0), lateId)).toBe(0);
});

test('teams with the same score share the same position in the live standings', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ phase:'checkpoint', checkpoint:{type:'end', round:1}, standingsVisible:true }),
    questionInstances: { rounds:{1:[q('m1','manche',0)]} },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma') },
    answers: { team_a:{'1-0':answer(0)}, team_b:{'1-0':answer(0)} },
  });
  const display = await openPage(browser, '&role=display');
  await expect(display.locator('.rank-num')).toHaveText(['1', '1', '3']);
});

test('Vero/Falso questions are not flagged as invalid by the pre-game checklist', async ({ browser, request }) => {
  await seed(request, { state: gameState({ setupLocked:false }) }, { questionBank: {
    vf1: {id:'vf1', pool:'manche', category:'Storia', question:'Roma fu fondata nel 753 a.C.?', options:['Vero','Falso'], correctIndex:0, answerType:'vero_falso'},
  } });
  const admin = await openAdmin(browser);
  await admin.locator('#setupGameName').waitFor();
  await expect(admin.locator('li', { hasText: 'senza risposta corretta valida' })).toHaveCount(0);
});

test('admin panel on a phone does not scroll sideways', async ({ browser, request }) => {
  const teamsObj = {}, answers = {};
  ['team_a','team_b','team_c','team_d'].forEach((id, i) => { teamsObj[id] = team(id, 'Squadronissimiinvinci' + i); answers[id] = {'3-0': answer(i % 4)}; });
  await seed(request, {
    state: gameState({ phase:'closed', round:3, config: config({rounds:3, questionsPerRound:[1,1,1]}),
      timer:{status:'closed', startedAt:Date.now(), durationMs:20000, pausedRemainingMs:null, closeReason:'manual', closedBy:'admin'} }),
    questionInstances: { rounds:{1:[q('m1','manche',0)], 2:[q('m2','manche',0)], 3:[q('m3','manche',0)]} },
    teams: teamsObj, answers,
  });
  const admin = await openAdmin(browser, { viewport: { width: 375, height: 800 } });
  await expect(admin.locator('h3:has-text("Stato squadre")')).toBeVisible();
  const [scrollWidth, innerWidth] = await admin.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
