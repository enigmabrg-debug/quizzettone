// Schermo condiviso (PROPOSTA_SCHERMO_CONDIVISO_completa.md): modalità
// risolta domanda per domanda, preparazione privata e "Mostra domanda",
// sblocco manuale / dopo la lettura, telefono come pulsantiera, stato del
// Display in regia, Display obbligatorio, disconnessione e fallback.
const { test, expect } = require('@playwright/test');
const { resetDatabase, readPath } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const NS = 'ns=quizzettone-49543-default-rtdb';
const ROOT_URL = `http://127.0.0.1:9000/quizzettone.json?${NS}`;
const sessionUrl = p => `http://127.0.0.1:9000/quizzettone/sessions/current/${p}.json?${NS}`;

function config(overrides) {
  return {
    rounds: 1, questionsPerRound: [2], finalistCount: 2, finalQuestionCount: 1, tiebreakCandidateCount: 5,
    questionDurationMs: 60000, timerStartMode: 'auto', scoring: {correct:1, wrong:0, noAnswer:0},
    finalScoring: null, scoreCarryover: 'reset', tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
    lateJoin: {policy:'always'}, checkpointMinQuestions: 4, blockDuplicateQuestions: true,
    answerVisibilityForEliminated: 'after_reveal', speedBonus: {enabled:false, maxBonus:0, windowMs:0},
    gameType: 'quiz', displayMode: 'shared_screen',
    sharedScreen: {answerUnlockPolicy:'manual', readingDelayMs:5000, prepareStep:true, teamTimer:'visible', teamOptionLabels:'letters_text', emergency:'confirm', autoFallbackGraceMs:5000, spectatorContentMode:'always_full'},
    ...overrides,
  };
}
const q = (id, extra) => ({id, pool:'manche', category:'Storia', question:'Domanda '+id+'?', options:['Uno','Due','Tre','Quattro'], correctIndex:1, adminNote:null, audioUrl:null, lastUsedAt:null, ...(extra||{})});
const team = (id, name) => ({id, name, joinedAt: Date.now() - 60000});

async function seed(request, cfg, bank, teams) {
  const state = {gameName:'Quizzettone', setupLocked:false, joinCode:'ABCDE', phase:'lobby', round:1, qIndex:0,
    timer:{status:'idle', startedAt:null, durationMs:60000}, history:{last:null, log:[]}, partyMode:'none', config: cfg};
  const res = await request.put(ROOT_URL, { data: {
    sessions: { current: { state, teams: teams || { team_a: team('team_a','Alfa') } } },
    questionBank: bank || { q1: q('q1'), q2: q('q2'), f1: {...q('f1'), pool:'finale'} },
  } });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());
}
async function readSession(request, p) { return (await request.get(sessionUrl(p))).json(); }
// Le schede restano aperte tra un test e l'altro: un Display dimenticato
// continuerebbe a mandare il battito nel test successivo.
let contexts = [];
async function openPage(browser, url) {
  const ctx = await browser.newContext();
  contexts.push(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + url);
  return page;
}
async function openAdmin(browser) {
  const admin = await openPage(browser, '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  return admin;
}
async function openDisplay(browser) {
  const display = await openPage(browser, '&role=display');
  await display.click('#btnUnlockAudio').catch(()=>{});
  return display;
}
async function start(admin) {
  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
}

test.beforeEach(async ({ browser, request }) => {
  // Anche i Display lasciati aperti dai file di test precedenti.
  await Promise.all(browser.contexts().map(c => c.close().catch(()=>{})));
  await resetDatabase(request);
});
test.afterEach(async () => { await Promise.all(contexts.map(c => c.close().catch(()=>{}))); contexts = []; });

test('con il Display pronto: preparazione privata, "Mostra domanda", risposte bloccate, poi il telefono fa da pulsantiera', async ({ browser, request }) => {
  await seed(request, config({}));
  const admin = await openAdmin(browser);
  const display = await openDisplay(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('#displayStatusSlot, .team-tag').first()).toBeVisible();
  await start(admin);

  // Fase 1: solo la regia vede la domanda.
  await expect(admin.locator('.pres-status')).toContainText('In preparazione');
  await expect(admin.locator('#displayStatusSlot')).toContainText('Connesso');
  await expect(display.locator('h2', { hasText: 'Prossima domanda in arrivo' })).toBeVisible();
  await expect(alfa.locator('.status-banner', { hasText: 'Prossima domanda in arrivo' })).toBeVisible();
  const before = await readSession(request, 'state');
  expect(before.presentation.resolvedMode).toBe('shared_screen');
  expect(before.timer.status).toBe('idle');

  // Fase 2: sul Display, risposte ancora chiuse.
  await admin.click('#btnShowQuestion');
  await expect(display.locator('.qtext')).toBeVisible();
  await expect(alfa.locator('.status-banner', { hasText: 'Guarda lo schermo condiviso' })).toBeVisible();
  await expect(alfa.locator('.opt')).toHaveCount(0);
  await expect(admin.locator('#displayStatusSlot')).toContainText('Sincronizzato');

  // Fase 4: aperte; sul telefono solo i pulsanti, niente testo della domanda.
  await admin.click('#btnStartTimer');
  await expect(alfa.locator('.opt').first()).toBeEnabled();
  await expect(alfa.locator('.qtext')).toHaveCount(0);
  await expect(alfa.locator('.timer-num')).toBeVisible();
  const inst = (await readSession(request, 'questionInstances/rounds/1'))[0];
  expect(inst.instanceId).toBeTruthy();
  expect(inst.presentedAt).toBeLessThanOrEqual(inst.inputUnlockedAt);
  expect(inst.inputUnlockedAt).toBe(inst.timerStartedAt);

  // La risposta porta l'identità dell'attività.
  await alfa.locator('.opt').nth(1).click();
  await expect.poll(async () => (await readSession(request, 'answers/team_a/1-0') || {}).instanceId).toBe(inst.instanceId);
});

test('senza Display la domanda va sui telefoni da sola, con un avviso per la regia', async ({ browser, request }) => {
  await seed(request, config({}));
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('.team-tag', { hasText: 'Alfa' })).toBeVisible();
  await start(admin);
  await expect(admin.locator('.status-banner', { hasText: 'non era pronto' })).toBeVisible();
  await expect(alfa.locator('.qtext')).toBeVisible();
  await expect(alfa.locator('.opt').first()).toBeEnabled();   // senza schermo: sblocco immediato
  expect((await readSession(request, 'state')).presentation.resolvedMode).toBe('team_devices');
});

test('fallback "Mostra anche sui telefoni": la domanda compare sul telefono, le risposte restano chiuse', async ({ browser, request }) => {
  await seed(request, config({}));
  const admin = await openAdmin(browser);
  await openDisplay(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('#displayStatusSlot, .team-tag').first()).toBeVisible();
  await start(admin);
  await admin.click('#btnShowQuestion');
  await expect(alfa.locator('.status-banner', { hasText: 'Guarda lo schermo condiviso' })).toBeVisible();
  await admin.click('#btnActivateTeamFallback');
  await expect(alfa.locator('.qtext')).toBeVisible();
  await expect(alfa.locator('.opt').first()).toBeDisabled();
  await expect(alfa.locator('.status-banner', { hasText: "In attesa che l'host avvii il timer" })).toBeVisible();
  await expect(admin.locator('#btnRestoreSharedScreen')).toBeVisible();
  await admin.click('#btnRestoreSharedScreen');
  await expect(alfa.locator('.status-banner', { hasText: 'Guarda lo schermo condiviso' })).toBeVisible();
});

test('apertura dopo il tempo di lettura: le risposte si aprono da sole', async ({ browser, request }) => {
  await seed(request, config({ sharedScreen: {...config({}).sharedScreen, answerUnlockPolicy:'delayed', readingDelayMs:3000} }));
  const admin = await openAdmin(browser);
  await openDisplay(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('#displayStatusSlot, .team-tag').first()).toBeVisible();
  await start(admin);
  await admin.click('#btnShowQuestion');
  await expect(alfa.locator('.muted', { hasText: 'Le risposte si aprono tra' })).toBeVisible();
  await expect(alfa.locator('.opt').first()).toBeEnabled({ timeout: 8000 });
  expect((await readSession(request, 'state')).timer.status).toBe('running');
});

test('solo lettere e timer a barra sui telefoni', async ({ browser, request }) => {
  await seed(request, config({ sharedScreen: {...config({}).sharedScreen, prepareStep:false, answerUnlockPolicy:'immediate', teamOptionLabels:'letters', teamTimer:'progress_only'} }));
  const admin = await openAdmin(browser);
  await openDisplay(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('#displayStatusSlot, .team-tag').first()).toBeVisible();
  await start(admin);
  await expect(alfa.locator('.opt.letter-only')).toHaveCount(4);
  await expect(alfa.locator('.opt', { hasText: 'Uno' })).toHaveCount(0);
  await expect(alfa.locator('.timer-bar')).toBeVisible();
});

test('una domanda che richiede il Display si ferma senza Display; la variante la porta sui telefoni', async ({ browser, request }) => {
  await seed(request, config({ displayMode:'team_devices', questionsPerRound:[1] }), {
    q1: q('q1', { sharedScreenRequirement:'required' }), f1: {...q('f1'), pool:'finale'},
  });
  const admin = await openAdmin(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('.team-tag', { hasText: 'Alfa' })).toBeVisible();
  await start(admin);
  await expect(admin.locator('.status-banner', { hasText: 'richiede uno schermo condiviso' })).toBeVisible();
  await expect(alfa.locator('.opt')).toHaveCount(0);
  expect((await readSession(request, 'state')).presentation.resolvedMode).toBe('blocked');
  await admin.click('#btnUseTeamVariant');
  await expect(alfa.locator('.qtext')).toBeVisible();
  await expect(alfa.locator('.opt').first()).toBeEnabled();
});

test('Display che si disconnette durante la lettura: avviso, e con "Consenti" la domanda passa da sola ai telefoni', async ({ browser, request }) => {
  await seed(request, config({ sharedScreen: {...config({}).sharedScreen, emergency:'allow', autoFallbackGraceMs:1000} }));
  const admin = await openAdmin(browser);
  const display = await openDisplay(browser);
  const alfa = await openPage(browser, '&role=team&id=team_a');
  await expect(admin.locator('#displayStatusSlot, .team-tag').first()).toBeVisible();
  await start(admin);
  await admin.click('#btnShowQuestion');
  await expect(alfa.locator('.status-banner', { hasText: 'Guarda lo schermo condiviso' })).toBeVisible();
  await display.context().close();
  await expect(alfa.locator('.qtext')).toBeVisible({ timeout: 15000 });
  const p = (await readSession(request, 'state')).presentation;
  expect(p.fallbackActive).toBe(true);
  expect(p.fallbackReason).toBe('display_disconnect');
});

test('battito del Display: stato e revisione su displayHealth, rimosso alla chiusura', async ({ browser, request }) => {
  const ctx = await browser.newContext();
  const display = await ctx.newPage();
  await display.goto(BASE + '&role=display');
  await expect.poll(async () => Object.values(await readPath(request, 'sessions/current/displayHealth') || {}).length).toBe(1);
  const entry = Object.values(await readPath(request, 'sessions/current/displayHealth'))[0];
  expect(entry.connected).toBe(true);
  expect(typeof entry.lastSeenAt).toBe('number');
  await ctx.close();
  await expect.poll(async () => await readPath(request, 'sessions/current/displayHealth')).toBeNull();
});

test('le domande giocate vengono scartate dalla partita successiva; le prove con squadre fittizie non le consumano', async ({ browser, request }) => {
  await seed(request, config({ displayMode:'team_devices', questionsPerRound:[1] }), {
    q1: q('q1'), q2: q('q2'), f1: {...q('f1'), pool:'finale'},
  });
  const admin = await openAdmin(browser);
  await expect(admin.locator('.team-tag', { hasText: 'Alfa' })).toBeVisible();
  await start(admin);
  const first = (await readSession(request, 'questionInstances/rounds/1'))[0].id;
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:9000/quizzettone/questionBank/${first}.json?${NS}`)).json()).lastUsedAt).toBeTruthy();
  // Seconda partita con la stessa squadra: esce l'altra domanda.
  await admin.evaluate(() => db.ref(DB_ROOT + '/' + statePath()).update({phase:'lobby', setupLocked:false}));
  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect.poll(async () => (await readSession(request, 'questionInstances/rounds/1'))[0].id).not.toBe(first);
  // Rimetti in gioco dal gestore domande.
  await admin.click('#btnToggleQuestionManager');
  await admin.click('#btnResetUsedQuiz');
  await admin.click('#confirmModalYes');
  await expect(admin.locator('#qmResetMsg')).toContainText('di nuovo in gioco');
  const bank = await (await request.get(`http://127.0.0.1:9000/quizzettone/questionBank.json?${NS}`)).json();
  expect(Object.values(bank).every(x => !x.lastUsedAt)).toBe(true);
});

test('prova con sole squadre fittizie: il mazzo non si consuma', async ({ browser, request }) => {
  await seed(request, config({ displayMode:'team_devices', questionsPerRound:[1] }), {
    q1: q('q1'), f1: {...q('f1'), pool:'finale'},
  }, { test_aaaa1111: {...team('test_aaaa1111','Prova 1'), isTest:true} });
  const admin = await openAdmin(browser);
  await expect(admin.locator('.team-tag', { hasText: 'Prova 1' })).toBeVisible();
  await start(admin);
  await expect.poll(async () => (await readSession(request, 'state')).phase).toBe('question');
  await admin.waitForTimeout(800);
  const q1 = await (await request.get(`http://127.0.0.1:9000/quizzettone/questionBank/q1.json?${NS}`)).json();
  expect(q1.lastUsedAt || null).toBeNull();
});
