// Top Dieci, giocato dall'interfaccia: Sala, telefoni delle squadre, regia e
// tabellone. Le classifiche del mazzo hanno una sola variante ciascuna, così
// ogni domanda pescata è prevedibile anche se l'ordine è casuale.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const NS = 'ns=quizzettone-49543-default-rtdb';
const ROOT_URL = `http://127.0.0.1:9000/quizzettone.json?${NS}`;
const sessionUrl = p => `http://127.0.0.1:9000/quizzettone/sessions/current/${p}.json?${NS}`;
const ITEMS = ['Uno','Due','Tre','Quattro','Cinque','Sei','Sette','Otto','Nove','Dieci'];

function config(overrides) {
  return {
    rounds: 1, questionsPerRound: [3], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 5,
    questionDurationMs: 300000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
    finalScoring: null, scoreCarryover: 'reset', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
    answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0},
    gameType: 'topdieci', top10Scoring: {positionExact:3, positionNear:1, orderPerItem:1, orderPerfectBonus:2},
    ...overrides,
  };
}
function gameState(overrides) {
  return {
    gameName:'Top Dieci', setupLocked:false, joinCode:'ABCDE', phase:'lobby', round:1, qIndex:0,
    timer: {status:'idle', startedAt:null, durationMs:300000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    history: {last:null, log:[]}, partyMode:'none', presentation:{resolvedMode:'team_devices', fallbackActive:false},
    config: config({}), ...overrides,
  };
}
const top10 = (id, pool, variants) => ({
  id, pool, category:'Geografia', answerType:'top10', question:'Classifica '+id, options:[], correctIndex:null,
  top10:{title:'Classifica '+id, items: ITEMS, variants, source:'test'}, adminNote:null, audioUrl:null, lastUsedAt:null,
});
const team = (id, name) => ({id, name, joinedAt: Date.now() - 60000});

async function seed(request, session, rootExtra) {
  const res = await request.put(ROOT_URL, { data: { sessions: { current: session }, ...(rootExtra||{}) } });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());
}
async function readSession(request, p) { return (await request.get(sessionUrl(p))).json(); }
async function openPage(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + url);
  return page;
}
async function openAdmin(browser, url) {
  const admin = await openPage(browser, '&role=admin' + (url||''));
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  return admin;
}

test.beforeEach(async ({ request }) => { await resetDatabase(request); });

test('Top Dieci: one round with all three variants, answered from the phones, scored and revealed', async ({ browser, request }) => {
  await seed(request, {
    state: gameState({}),
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta') },
  }, { questionBank: {
    t_pos: top10('t_pos','manche',['posizione']),
    t_ord: top10('t_ord','manche',['ordina']),
    t_pri: top10('t_pri','manche',['primo']),
    f_pri: top10('f_pri','finale',['primo']),
  } });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  const beta = await openPage(browser, '&role=team&id=team_b');
  const display = await openPage(browser, '&role=display');

  await expect(alfa.locator('.top10-rules')).toBeVisible();
  await expect(display.locator('.top10-rules')).toBeVisible();
  await admin.click('#btnStart');
  await expect(admin.locator('#startSummaryOverlay')).toContainText('Top Dieci');
  await admin.click('#startSummaryConfirm');

  const expected = { team_a: 0, team_b: 0 };
  const seen = [];
  for (let i = 0; i < 3; i++) {
    await expect.poll(async () => (await readSession(request, 'state')).qIndex).toBe(i);
    await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('question');
    const q = (await readSession(request, 'questionInstances/rounds/1'))[i];
    seen.push(q.top10Variant);
    await expect(alfa.locator('.top10-title')).toHaveText(q.top10.title);

    if (q.top10Variant === 'posizione') {
      await expect(alfa.locator('.top10-positions .opt')).toHaveCount(10);
      const near = q.correctIndex === 9 ? 8 : q.correctIndex + 1;
      await alfa.click(`.opt[data-idx="${q.correctIndex}"]`);
      await beta.click(`.opt[data-idx="${near}"]`);
      expected.team_a += 3; expected.team_b += 1;
    } else if (q.top10Variant === 'ordina') {
      await expect(alfa.locator('#btnTop10Submit')).toBeDisabled();
      for (const o of q.correctOrder) await alfa.click(`[data-order-idx="${o}"]`);
      await alfa.click('#btnTop10Submit');
      // Beta sbaglia, ricomincia e consegna l'ordine al contrario: 0 al posto giusto.
      await beta.click(`[data-order-idx="${q.correctOrder[1]}"]`);
      await beta.click('#btnTop10Reset');
      await expect(beta.locator('[data-order-idx]')).toHaveCount(4);
      for (const o of [...q.correctOrder].reverse()) await beta.click(`[data-order-idx="${o}"]`);
      await beta.click('#btnTop10Submit');
      expected.team_a += 6;
    } else {
      await alfa.click(`.opt[data-idx="${q.correctIndex}"]`);
      await beta.click(`.opt[data-idx="${(q.correctIndex + 1) % 4}"]`);
      expected.team_a += 1;
    }
    await expect(alfa.locator('.status-banner.sent')).toBeVisible();
    await expect(beta.locator('.status-banner.sent')).toBeVisible();
    await expect.poll(async () => Object.keys(await readSession(request, 'answers') || {}).length).toBe(2);

    if (await admin.locator('#btnCloseNow').count()) await admin.click('#btnCloseNow');
    await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('closed');
    // Regia: classifica completa sempre visibile; Display e telefoni: coperta finché non si svela.
    await expect(admin.locator('[data-top10-board] .top10-row.revealed')).toHaveCount(10);
    await expect(display.locator('[data-top10-board] .top10-row.revealed')).toHaveCount(0);
    await admin.click('#btnTop10RevealNext');
    await expect(display.locator('[data-top10-board] .top10-row.revealed')).toHaveCount(1);
    await expect(display.locator('[data-top10-board] .top10-row.revealed')).toContainText('Dieci');
    await admin.click('#btnTop10RevealAll');
    await expect(alfa.locator('[data-top10-board] .top10-row.revealed')).toHaveCount(10);
    await admin.click('#btnRevealSolution');
    if (q.top10Variant === 'ordina') await expect(beta.locator('.top10-slot.wrong')).toHaveCount(4);
    await admin.click('#btnNext');
  }
  expect(seen.sort()).toEqual(['ordina','posizione','primo']);
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('checkpoint');
  await expect(admin.locator('.rank-row', { hasText: 'Alfa' })).toContainText(String(expected.team_a));
  await expect(admin.locator('.rank-row', { hasText: 'Beta' })).toContainText(String(expected.team_b));
});

test('Top Dieci from the hub link: the preset fills the Sala form, saving it sets the game type', async ({ browser, request }) => {
  await seed(request, { state: gameState({ gameName:'Quizzettone', config: config({ gameType:'quiz', questionsPerRound:[15] }) }) });
  const admin = await openAdmin(browser, '&gioco=topdieci');
  await expect(admin.locator('#setupGameType')).toHaveValue('topdieci');
  await expect(admin.locator('#setupQuestionsPerRound')).toHaveValue('5');
  await expect(admin.locator('#salaPresetNote')).toContainText('Top Dieci');
  await admin.click('#btnSaveSetup');
  await expect.poll(async () => (await readSession(request, 'state')).config.gameType).toBe('topdieci');
  await expect(admin.locator('.eyebrow', { hasText: 'Pannello Admin' })).toContainText('Top Dieci');
});

test('Top Dieci: a ranking added from the question manager is stored and validated', async ({ browser, request }) => {
  await seed(request, { state: gameState({}) }, { questionBank: { f_pri: top10('f_pri','finale',['primo']) } });
  const admin = await openAdmin(browser);
  await admin.click('#btnToggleQuestionManager');
  await admin.fill('#t10Title', 'Le mie dieci');
  await admin.fill('#t10Items', ITEMS.slice(0, 9).join('\n'));
  await admin.click('#btnAddTop10');
  await expect(admin.locator('#t10AddMsg')).toContainText('esattamente 10');
  await admin.fill('#t10Items', ITEMS.join('\n'));
  await admin.uncheck('#t10Var_primo');
  await admin.click('#btnAddTop10');
  await expect(admin.locator('#t10AddMsg')).toContainText('aggiunta');
  const bank = await (await request.get(`http://127.0.0.1:9000/quizzettone/questionBank.json?${NS}`)).json();
  const added = Object.values(bank).find(q => q.top10 && q.top10.title === 'Le mie dieci');
  expect(added.top10.items).toEqual(ITEMS);
  expect(added.top10.variants).toEqual(['posizione','ordina']);
});

test('Top Dieci: an "ordina" ranking works as a tiebreak question', async ({ browser, request }) => {
  const tbQ = {...top10('tb_ord','finale',['ordina']), top10Variant:'ordina', top10Shown:[8,0,5,3],
    options:['Nove','Uno','Sei','Quattro'], correctOrder:[1,3,2,0], question:'Mettile in ordine'};
  await seed(request, {
    state: gameState({ setupLocked:true, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar:['team_a'], candidates:['team_b','team_c'], candidateQuestions:[tbQ], question:null, qIndex:null} }),
    questionInstances: { rounds:{1:[top10('m1','manche',['primo'])]} },
    teams: { team_a: team('team_a','Alfa'), team_b: team('team_b','Beta'), team_c: team('team_c','Gamma') },
  });
  const admin = await openAdmin(browser);
  const beta = await openPage(browser, '&role=team&id=team_b');
  const gamma = await openPage(browser, '&role=team&id=team_c');
  await expect(admin.locator('[data-tb-q="0"]')).toContainText('Ricostruisci');
  await admin.click('[data-tb-q="0"]');
  for (const o of [1,3,2,0]) await beta.click(`[data-order-idx="${o}"]`);
  await beta.click('#btnTop10Submit');
  for (const o of [0,1,2,3]) await gamma.click(`[data-order-idx="${o}"]`);
  await gamma.click('#btnTop10Submit');
  await expect(gamma.locator('.status-banner.sent')).toBeVisible();
  await admin.click('#btnCloseNow');
  await admin.click('#btnNext');
  await expect(admin.locator('text=Corretta: 1. Uno · 2. Quattro · 3. Sei · 4. Nove')).toBeVisible();
  await expect(admin.locator('.row', { hasText: 'Beta' }).filter({ hasText: '✓ corretta' })).toBeVisible();
  await expect(admin.locator('.row', { hasText: 'Gamma' }).filter({ hasText: '✗ sbagliata' })).toBeVisible();
});
