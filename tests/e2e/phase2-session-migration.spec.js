// PL-09: a database still in the old flat shape (chiavi a prefisso stringa
// direttamente sotto DB_ROOT, com'era prima di questo pacchetto) must be
// migrated automatically -- and without losing data -- to the new
// sessions/current/... schema the first time an admin loads the app.
const { test, expect } = require('@playwright/test');
const { resetDatabase, seedFlatData, readPath } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('a legacy flat database is migrated to sessions/current on first admin load, without losing data', async ({ page, request }) => {
  test.setTimeout(30_000);
  await seedFlatData(request, {
    state: {
      gameName: 'Serata Vecchia',
      setupLocked: false,
      phase: 'lobby',
      round: 1, qIndex: 0,
      config: {
        rounds: 2, questionsPerRound: [15, 15], finalistCount: 2, finalQuestionCount: 10,
        tiebreakCandidateCount: 5, questionDurationMs: 20000, timerStartMode: 'auto',
        scoring: { correct: 1, wrong: 0, noAnswer: 0 },
        lateJoin: { policy: 'until_round1_end' },
        tiebreakRule: { qualification: 'prima_corretta', final: 'oltranza' },
        checkpointMinQuestions: 4
      },
      timer: { status: 'idle', startedAt: null, durationMs: 20000, pausedRemainingMs: null, closeReason: null, closedBy: null },
      history: { last: null, log: [] },
      party: { bonus: null, malus: null, surprise: null },
      // Vecchia forma pre-PL-09: gameQuestions viveva DENTRO state. Round 1
      // ha una domanda vera (non un array vuoto): Firebase pota via i valori
      // vuoti/null in scrittura, quindi un array vuoto non sopravvivrebbe
      // affatto al seed REST, rendendo la verifica sotto priva di senso.
      gameQuestions: {
        rounds: { 1: [{ id: 'q_round1', pool: 'manche', category: 'Storia', question: 'Domanda manche vecchia?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 }] },
        final: null, tiebreak: null
      }
    },
    'teaminfo:team_legacy1': { id: 'team_legacy1', name: 'Squadra Storica', joinedAt: Date.now() },
    'question:q_legacy1': {
      id: 'q_legacy1', pool: 'manche', category: 'Storia', question: 'Domanda vecchia?',
      options: ['A', 'B', 'C', 'D'], correctIndex: 0, adminNote: null, audioUrl: null, lastUsedAt: null
    }
  });

  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');

  // I dati vecchi devono comparire nella UI, letti attraverso il nuovo schema.
  await expect(page.locator('#setupGameName')).toHaveValue('Serata Vecchia');
  await expect(page.locator('.team-tag', { hasText: 'Squadra Storica' })).toBeVisible();

  // Le vecchie chiavi piatte devono sparire...
  await expect(async () => {
    expect(await readPath(request, 'state')).toBeNull();
    expect(await readPath(request, 'teaminfo:team_legacy1')).toBeNull();
    expect(await readPath(request, 'question:q_legacy1')).toBeNull();
  }).toPass({ timeout: 10_000 });

  // ...e i dati devono essere interamente presenti nei nuovi rami, non solo
  // parzialmente (verifica esplicita "nessuna perdita di dati").
  const newState = await readPath(request, 'sessions/current/state');
  expect(newState.gameName).toBe('Serata Vecchia');
  expect(newState.config.rounds).toBe(2);
  expect(newState.gameQuestions).toBeUndefined(); // spostato nel ramo separato, non deve restare duplicato in state

  const newQuestionInstances = await readPath(request, 'sessions/current/questionInstances');
  expect(newQuestionInstances.rounds['1']).toHaveLength(1);
  expect(newQuestionInstances.rounds['1'][0].question).toBe('Domanda manche vecchia?');

  const newTeam = await readPath(request, 'sessions/current/teams/team_legacy1');
  expect(newTeam.name).toBe('Squadra Storica');

  const newQuestion = await readPath(request, 'questionBank/q_legacy1');
  expect(newQuestion.question).toBe('Domanda vecchia?');
});
