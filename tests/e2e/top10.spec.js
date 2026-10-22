// Top Dieci giocato dall'interfaccia: turni sui telefoni, risposte scritte
// (con refusi e alternative), tabellone condiviso con i dati, correzioni e
// rivelazione del presentatore, rotazione di chi parte, preset e mazzo.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const NS = 'ns=quizzettone-49543-default-rtdb';
const ROOT_URL = `http://127.0.0.1:9000/quizzettone.json?${NS}`;
const sessionUrl = p => `http://127.0.0.1:9000/quizzettone/sessions/current/${p}.json?${NS}`;
const MOUNTAINS = [
  {name:'Everest', alts:['Chomolungma'], value:'8.849 m'}, {name:'K2', value:'8.611 m'}, {name:'Kangchenjunga', value:'8.586 m'},
  {name:'Lhotse', value:'8.516 m'}, {name:'Makalu', value:'8.485 m'}, {name:'Cho Oyu', value:'8.188 m'}, {name:'Dhaulagiri I', value:'8.167 m'},
  {name:'Manaslu', value:'8.163 m'}, {name:'Nanga Parbat', value:'8.126 m'}, {name:'Annapurna I', alts:['Annapurna'], value:'8.091 m'},
];

function config(overrides) {
  return {
    rounds: 1, questionsPerRound: [1], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 5,
    questionDurationMs: 20000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
    finalScoring: null, scoreCarryover: 'keep', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
    answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0},
    gameType: 'topdieci', top10: {maxLaps:2, turnSeconds:60},
    ...overrides,
  };
}
function gameState(overrides) {
  return {
    gameName:'Top Dieci', setupLocked:false, joinCode:'ABCDE', phase:'lobby', round:1, qIndex:0,
    timer: {status:'idle', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    history: {last:null, log:[]}, partyMode:'none', presentation:{resolvedMode:'team_devices', fallbackActive:false},
    config: config({}), ...overrides,
  };
}
const ranking = (id, pool, title, items) => ({
  id, pool, category:'Geografia', answerType:'top10', question:title, options:[], correctIndex:null,
  top10:{title, items, source:'test'}, adminNote:'Fonte: test', audioUrl:null, lastUsedAt:null,
});
const team = (id, name, ageMs) => ({id, name, joinedAt: Date.now() - ageMs});

async function seed(request, session, rootExtra) {
  const res = await request.put(ROOT_URL, { data: { sessions: { current: session }, ...(rootExtra||{}) } });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());
}
async function readSession(request, p) { return (await request.get(sessionUrl(p))).json(); }
async function openPage(browser, url) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + url);
  return page;
}
async function openAdmin(browser, url) {
  const admin = await openPage(browser, '&role=admin' + (url||''));
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  return admin;
}
async function answer(page, text) {
  await page.fill('#top10Answer', text);
  await page.click('#btnTop10Send');
}
async function startGame(admin) {
  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
}

test.beforeEach(async ({ request }) => { await resetDatabase(request); });

test('Top Dieci: teams answer in turn by typing, the board fills up for everyone, points follow the position', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({}),
    teams: { team_a: team('team_a','Alfa', 60000), team_b: team('team_b','Beta', 30000) },
  }, { questionBank: {
    m1: ranking('m1','manche','Le 10 montagne più alte', MOUNTAINS),
    f1: ranking('f1','finale','Finale', MOUNTAINS),
  } });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  const beta = await openPage(browser, '&role=team&id=team_b');
  const display = await openPage(browser, '&role=display');

  await expect(display.locator('.top10-rules')).toContainText('10° posto = 10 punti');
  await startGame(admin);
  await expect(alfa.locator('.top10-title')).toHaveText('Le 10 montagne più alte');
  await expect(alfa.locator('#top10Answer')).toHaveCount(0);   // nessuno scrive prima del via
  await expect(admin.locator('#btnTop10Start')).toContainText('Alfa');
  await admin.click('#btnTop10Start');

  // Turno 1, Alfa: refuso accettato.
  await expect(beta.locator('.top10-turn-name')).toContainText('Alfa');
  await expect(beta.locator('#top10Answer')).toHaveCount(0);
  await answer(alfa, 'everst');
  await expect(display.locator('.top10-row.found')).toHaveCount(1);
  await expect(display.locator('.top10-row.found')).toContainText('Everest');
  await expect(display.locator('.top10-row.found')).toContainText('8.849 m');
  await expect(display.locator('.top10-row.found')).toContainText('Alfa');
  await expect(display.locator('.top10-row').nth(1)).toContainText('? ? ?');

  // Turno 2, Beta: risposta non riconosciuta (il presentatore la correggerà).
  await answer(beta, 'Kangch');
  await expect(display.locator('.top10-last')).toContainText('non è in classifica');

  // Turno 3, Alfa: voce già scoperta = si riprova senza perdere il turno.
  await answer(alfa, 'Everest');
  await expect(alfa.locator('.status-banner', { hasText: 'già in classifica' })).toBeVisible();
  await expect(alfa.locator('#top10Answer')).toBeVisible();
  await answer(alfa, 'Annapurna');
  await expect(display.locator('.top10-row.found')).toHaveCount(2);

  // Turno 4, Beta: ultimo turno (2 giri x 2 squadre), poi la classifica si chiude.
  await answer(beta, 'K2');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('closed');
  await expect(display.locator('.status-banner')).toContainText('Classifica chiusa');

  // Correzione: "Kangch" era Kangchenjunga (3° posto).
  await admin.selectOption('#top10AcceptSel_1', '2');
  await admin.click('[data-top10-accept="1"]');
  await expect(display.locator('.top10-row.found')).toHaveCount(4);
  await expect(admin.locator('tr', { hasText: 'Alfa' }).first()).toContainText('11');  // 1 + 10
  await expect(admin.locator('tr', { hasText: 'Beta' }).first()).toContainText('5');   // 2 + 3

  // Le voci rimaste si svelano dal basso, con il loro dato.
  await expect(admin.locator('#btnTop10RevealNext')).toContainText('9°');
  await admin.click('#btnTop10RevealNext');
  await expect(display.locator('.top10-row.revealed')).toHaveCount(1);
  await expect(display.locator('.top10-row.revealed')).toContainText('Nanga Parbat');
  await expect(display.locator('.top10-row.revealed')).toContainText('8.126 m');
  await admin.click('#btnTop10RevealAll');
  await expect(beta.locator('.top10-row.revealed')).toHaveCount(6);
  await expect(beta.locator('.top10-row', { hasText: '? ? ?' })).toHaveCount(0);

  await admin.click('#btnNext');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('checkpoint');
  await expect(admin.locator('.rank-row', { hasText: 'Alfa' })).toContainText('11');
  await expect(admin.locator('.rank-row', { hasText: 'Beta' })).toContainText('5');
});

test('Top Dieci: an expired turn passes to the next team, and the next ranking starts from the next team', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ config: config({ questionsPerRound:[2], top10:{maxLaps:0, turnSeconds:5} }) }),
    teams: { team_a: team('team_a','Alfa', 60000), team_b: team('team_b','Beta', 30000) },
  }, { questionBank: {
    m1: ranking('m1','manche','Prima', MOUNTAINS), m2: ranking('m2','manche','Seconda', MOUNTAINS),
    f1: ranking('f1','finale','Finale', MOUNTAINS),
  } });
  const admin = await openAdmin(browser);
  const beta = await openPage(browser, '&role=team&id=team_b');
  await startGame(admin);
  await admin.click('#btnTop10Start');
  await expect(beta.locator('#top10Answer')).toHaveCount(0);
  // Alfa non risponde: dopo 5 secondi tocca a Beta.
  await expect(beta.locator('#top10Answer')).toBeVisible({ timeout: 10000 });
  await expect(beta.locator('.top10-last')).toContainText('tempo scaduto');
  await admin.click('#btnTop10End');
  await admin.click('#confirmModalYes');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('closed');
  await admin.click('#btnNext');
  await expect.poll(async () => (await readSession(request, 'state')).qIndex).toBe(1);
  const boards = await readSession(request, 'state/top10Boards');
  expect(boards['1-0'].order).toEqual(['team_a','team_b']);
  expect(boards['1-1'].order).toEqual(['team_b','team_a']);
  await expect(admin.locator('#btnTop10Start')).toContainText('Beta');
});

test('Top Dieci: test teams play their turns by themselves', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({ testMode:true, config: config({ top10:{maxLaps:2, turnSeconds:30} }) }),
    teams: { test_aaaa1111: {...team('test_aaaa1111','Prova 1', 60000), isTest:true}, test_bbbb2222: {...team('test_bbbb2222','Prova 2', 30000), isTest:true} },
  }, { questionBank: { m1: ranking('m1','manche','Prova', MOUNTAINS), f1: ranking('f1','finale','Finale', MOUNTAINS) } });
  const admin = await openAdmin(browser);
  await startGame(admin);
  await admin.click('#btnTop10Start');
  await expect.poll(async () => (await readSession(request, 'state')).phase, { timeout: 20000 }).toBe('closed');
  const board = await readSession(request, 'state/top10Boards/1-0');
  expect(board.log.length).toBeGreaterThanOrEqual(4);
});

test('Top Dieci from the hub link: the preset fills the Sala form, saving it sets the game type', async ({ browser, request }) => {
  await seed(request, { state: gameState({ gameName:'Quizzettone', config: config({ gameType:'quiz', rounds:2, questionsPerRound:[15,15] }) }) });
  const admin = await openAdmin(browser, '&gioco=topdieci');
  await expect(admin.locator('#setupGameType')).toHaveValue('topdieci');
  await expect(admin.locator('#setupRounds')).toHaveValue('4');
  await expect(admin.locator('#setupQuestionsPerRound')).toHaveValue('1');
  await expect(admin.locator('#setupTop10MaxLaps')).toHaveValue('3');
  await expect(admin.locator('#salaPresetNote')).toContainText('Top Dieci');
  await admin.click('#btnSaveSetup');
  await expect.poll(async () => (await readSession(request, 'state')).config.gameType).toBe('topdieci');
  await expect(admin.locator('.eyebrow', { hasText: 'Pannello Admin' })).toContainText('Top Dieci');
});

test('Top Dieci: a ranking with alternatives and values is added from the question manager', async ({ browser, request }) => {
  await seed(request, { state: gameState({}) }, { questionBank: { f1: ranking('f1','finale','Finale', MOUNTAINS) } });
  const admin = await openAdmin(browser);
  await admin.click('#btnToggleQuestionManager');
  await admin.fill('#t10Title', 'Le mie dieci');
  const lines = MOUNTAINS.map(m => [m.name, ...(m.alts||[])].join(' / ') + ' = ' + m.value);
  await admin.fill('#t10Items', lines.slice(0, 9).join('\n'));
  await admin.click('#btnAddTop10');
  await expect(admin.locator('#t10AddMsg')).toContainText('esattamente 10');
  await admin.fill('#t10Items', lines.join('\n'));
  await admin.click('#btnAddTop10');
  await expect(admin.locator('#t10AddMsg')).toContainText('aggiunta');
  const bank = await (await request.get(`http://127.0.0.1:9000/quizzettone/questionBank.json?${NS}`)).json();
  const added = Object.values(bank).find(q => q.top10 && q.top10.title === 'Le mie dieci');
  expect(added.top10.items[0]).toEqual({name:'Everest', alts:['Chomolungma'], value:'8.849 m'});
  expect(added.top10.items[1]).toEqual({name:'K2', value:'8.611 m'});
});

test('Top Dieci: a tiebreak is played on a ranking by the tied teams only, the best score is suggested', async ({ browser, request }) => {
  const tbQ = ranking('tb1','finale','Spareggio', MOUNTAINS);
  await seed(request, {
    state: gameState({ setupLocked:true, phase:'tiebreak_setup', config: config({ top10:{maxLaps:1, turnSeconds:60} }),
      tiebreak:{qualifiedSoFar:['team_a'], candidates:['team_b','team_c'], candidateQuestions:[tbQ], question:null, qIndex:null} }),
    questionInstances: { rounds:{1:[ranking('m1','manche','Manche', MOUNTAINS)]} },
    teams: { team_a: team('team_a','Alfa', 90000), team_b: team('team_b','Beta', 60000), team_c: team('team_c','Gamma', 30000) },
  });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  const beta = await openPage(browser, '&role=team&id=team_b');
  const gamma = await openPage(browser, '&role=team&id=team_c');
  await admin.click('[data-tb-q="0"]');
  await admin.click('#btnTop10Start');
  await expect(alfa.locator('.status-banner', { hasText: 'Seguite lo spareggio' })).toBeVisible();
  await answer(beta, 'K2');
  await answer(gamma, 'Monte Bianco');
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('closed');
  await admin.click('#btnNext');
  await expect(admin.locator('.row', { hasText: 'Beta' }).filter({ hasText: '2 punti sul tabellone' })).toBeVisible();
  await expect(admin.locator('.row', { hasText: 'Beta' }).filter({ hasText: 'Suggerita' })).toBeVisible();
});
