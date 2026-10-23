// Verifies the Phase 3 "spettacolo e qualità" director's-panel additions:
// the pre-game checklist (read-only scan of the question bank against the
// chosen config, never blocking start) and the live response-count pills +
// collapsible action history in the question control panel.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const EMULATOR_ROOT = 'http://127.0.0.1:9000/quizzettone.json?ns=quizzettone-49543-default-rtdb';

// Must mirror CATEGORIES in js/state.js: the checklist flags any category
// with zero manche-pool questions, so an "all-clear" bank needs one per category.
const CATEGORIES = ["Geografia","Storia","Matematica","Musica","Scienze","Cinema","Sport","Serie TV","Tecnologia","Videogiochi","Filosofia","Arte","Letteratura","Attualità e Società","Natura e Animali","Mitologia","Food e Bevande","Moda e Costume","Fumetti e Anime","Cartoni Animati e Disney","Curiosità e Record"];

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('checklist shows all-clear against a question bank that fully covers the config', async ({ browser, request }) => {
  test.setTimeout(60_000);
  const root = {};
  // One unique manche question per category (covers every category, no duplicates).
  CATEGORIES.forEach((cat, i) => {
    root['question:m' + i] = {id:'m'+i, pool:'manche', category:cat, question:`Domanda manche numero ${i+1}?`, options:['Alfa','Beta','Gamma','Delta'], correctIndex:i%4, adminNote:null, audioUrl:null, lastUsedAt:null};
  });
  // 5 unique finale questions: matches finalQuestionCount(3)+tiebreakCandidateCount(2) below.
  for (let i = 0; i < 5; i++) {
    root['question:f' + i] = {id:'f'+i, pool:'finale', category:'Storia', question:`Domanda finale numero ${i+1}?`, options:['Uno','Due','Tre','Quattro'], correctIndex:i%4, adminNote:null, audioUrl:null, lastUsedAt:null};
  }
  root.state = {
    config: {
      rounds: 1, questionsPerRound: [CATEGORIES.length],
      finalistCount: 2, finalQuestionCount: 3, tiebreakCandidateCount: 2,
    },
  };
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await expect(admin.locator('text=Nessun problema rilevato nel mazzo di domande')).toBeVisible();
  // The checklist is informational only: it never blocks the start button.
  await expect(admin.locator('#btnStart')).toBeVisible();

  await adminCtx.close();
});

test('checklist warns when the question bank cannot cover the configured rules', async ({ browser, request }) => {
  test.setTimeout(60_000);
  // Seed a deliberately tiny question bank (well under the default config's
  // needs: 30 manche questions, 15 finale questions) plus one duplicate text,
  // so every checklist rule fires at least one issue.
  const root = {
    'question:q1': {id:'q1', pool:'manche', category:'Geografia', question:'Domanda unica?', options:['A','B','C','D'], correctIndex:0, adminNote:null, audioUrl:null, lastUsedAt:null},
    'question:q2': {id:'q2', pool:'manche', category:'Geografia', question:'Domanda unica?', options:['A','B','C','D'], correctIndex:0, adminNote:null, audioUrl:null, lastUsedAt:null},
    'question:q3': {id:'q3', pool:'finale', category:'Storia', question:'Domanda finale?', options:['A','B','C','D'], correctIndex:1, adminNote:null, audioUrl:null, lastUsedAt:null},
    state: {}, // withDefaults() fills in the rest (default config: rounds:2, questionsPerRound:[15,15], finalQuestionCount:10, tiebreakCandidateCount:5)
  };
  const res = await request.put(EMULATOR_ROOT, { data: root });
  if (!res.ok()) throw new Error('seed failed: ' + res.status());

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await expect(admin.locator('text=Checklist mazzo domande')).toBeVisible();
  await expect(admin.locator('text=testi di domanda duplicati')).toBeVisible();
  await expect(admin.locator('text=Servono 30 domande manche, disponibili 2')).toBeVisible();
  await expect(admin.locator('text=Servono almeno 15 domande finale')).toBeVisible();
  await expect(admin.locator('text=Categorie senza domande manche')).toBeVisible();

  // Still purely informational: start remains available despite the warnings.
  await expect(admin.locator('#btnStart')).toBeVisible();

  await adminCtx.close();
});

test('regia panel shows live response-count pills and a collapsible history log', async ({ browser }) => {
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

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Regia');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Regia' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toBeVisible();

  // Before anyone answers: nothing received yet, one missing.
  await expect(admin.locator('.pill', { hasText: '0 ricevute' })).toBeVisible();
  await expect(admin.locator('.pill', { hasText: '1 mancanti' })).toBeVisible();

  const correctIdx = await admin.evaluate(() => getQuestion(1, 0).correctIndex);
  await team.locator('.opt').nth(correctIdx).click();

  await expect(admin.locator('.pill', { hasText: '1 ricevute' })).toBeVisible();
  await expect(admin.locator('.pill', { hasText: '0 mancanti' })).toBeVisible();

  // History log: collapsed by default, no entries until an undoable action happens.
  await expect(admin.locator('#btnToggleHistoryLog')).toContainText('Storico azioni (0)');
  await admin.click('#btnCloseNow');

  await admin.locator('tr', { hasText: 'Team Regia' }).locator('[data-adjust]').first().click();
  await expect(admin.locator('#btnToggleHistoryLog')).toContainText('Storico azioni (1)');

  await admin.click('#btnToggleHistoryLog');
  await expect(admin.locator('text=Punti Team Regia').first()).toBeVisible();
  await expect(admin.locator('text=Nessuna azione registrata ancora.')).toHaveCount(0);

  await adminCtx.close();
  await teamCtx.close();
});
