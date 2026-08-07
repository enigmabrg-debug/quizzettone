// PL-15 (penalità adattiva + bonus rimonta): test unitari sulle funzioni
// pure di js/state.js. Verificano che computeFrozenLeaderboardBands assegni
// le fasce del piano §4.2 in base alla posizione (totalScore) tra le
// squadre attive, e che pointsForAnswer applichi davvero moltiplicatore di
// penalità e bonus rimonta letti dalla fascia congelata su
// leaderboardBands, invece del sc.wrong/sc.correct fisso di sempre.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultState, pointsForAnswer, computeFrozenLeaderboardBands,
  __setTestState, __setTestGameQuestions, __setTestAnswersByTeam, __setTestOverridesByTeam
} = require('../../js/state.js');

const DEFAULT_BANDS = defaultState().config.dynamicScoring.penaltyBands;

function setupTeamsWithScores(scoresById){
  // Un solo "slot" di domanda nella manche 1: il punteggio di ogni squadra
  // viene interamente dall'override (adminAdjustPoints), che
  // teamPointsForQuestion legge PRIMA di guardare gameQuestions/risposte —
  // basta perché roundScore/qualificationScore/totalScore iterino su
  // qualcosa (serve almeno un elemento in rounds[1], altrimenti la lista è
  // vuota e la somma resta sempre 0 indipendentemente dagli override).
  __setTestGameQuestions({ rounds: { 1: [{}] }, final: null, tiebreak: null });
  __setTestAnswersByTeam({});
  const overrides = {};
  Object.keys(scoresById).forEach(id => { overrides[id] = { '1-0': scoresById[id] }; });
  __setTestOverridesByTeam(overrides);
  __setTestState({
    config: { rounds: 1, scoringProfile: 'dinamico', dynamicScoring: { penaltyBands: DEFAULT_BANDS } },
    cancelledQuestions: []
  });
}

test('computeFrozenLeaderboardBands assegna le 5 fasce del piano §4.2 in base alla posizione, con 10 squadre (confini esatti)', () => {
  // 10 squadre, punteggi strettamente decrescenti: le posizioni 1..10
  // cadono esattamente sui confini 10/25/50/75/100% della tabella.
  const scores = {};
  for (let i = 1; i <= 10; i++) scores['team' + i] = 1000 - i * 10; // team1 primo, team10 ultimo
  setupTeamsWithScores(scores);
  const ids = Object.keys(scores);
  const bands = computeFrozenLeaderboardBands(ids);
  assert.deepEqual(bands.team1, {errorMultiplier:2.00, comebackBonusPercent:0});  // 10%: prima fascia
  assert.deepEqual(bands.team2, {errorMultiplier:1.75, comebackBonusPercent:0});  // 20% -> 11-25%
  assert.deepEqual(bands.team3, {errorMultiplier:1.40, comebackBonusPercent:2});  // 30% -> 26-50%
  assert.deepEqual(bands.team5, {errorMultiplier:1.40, comebackBonusPercent:2});  // 50% -> ancora 26-50%
  assert.deepEqual(bands.team6, {errorMultiplier:1.10, comebackBonusPercent:5});  // 60% -> 51-75%
  assert.deepEqual(bands.team8, {errorMultiplier:0.70, comebackBonusPercent:8});  // 80% -> ultime 25%
  assert.deepEqual(bands.team10, {errorMultiplier:0.70, comebackBonusPercent:8}); // 100%: ultima
});

test('computeFrozenLeaderboardBands: squadre a pari punti condividono la stessa fascia (numerazione competitiva, come computeOrderBonusAssignments)', () => {
  // Tutte a 0 punti, come tipicamente a inizio partita: nessuna divisione
  // arbitraria per ordine di iscrizione, tutte nella stessa fascia.
  setupTeamsWithScores({ teamA: 0, teamB: 0, teamC: 0 });
  const bands = computeFrozenLeaderboardBands(['teamA','teamB','teamC']);
  assert.deepEqual(bands.teamA, bands.teamB);
  assert.deepEqual(bands.teamB, bands.teamC);

  // Pari merito parziale: due squadre appaiate al primo posto, una terza
  // staccata. Le prime due condividono la fascia di testa; la terza, pur
  // essendo "seconda" per numero di squadre davanti, riceve la fascia della
  // TERZA posizione (numerazione competitiva: 1,1,3 — non 1,1,2).
  setupTeamsWithScores({ teamA: 500, teamB: 500, teamC: 100 });
  const bands2 = computeFrozenLeaderboardBands(['teamA','teamB','teamC']);
  assert.deepEqual(bands2.teamA, bands2.teamB);
  assert.notDeepEqual(bands2.teamC, bands2.teamA);
});

test('computeFrozenLeaderboardBands ritorna {} senza squadre attive o senza tabella di fasce configurata', () => {
  setupTeamsWithScores({});
  assert.deepEqual(computeFrozenLeaderboardBands([]), {});
  __setTestState({ config: { rounds: 1, scoringProfile: 'dinamico', dynamicScoring: { penaltyBands: [] } } });
  assert.deepEqual(computeFrozenLeaderboardBands(['teamA']), {});
});

test('pointsForAnswer: piano §4.2, domanda da 1.000 punti, aliquota 20% -> il leader perde 400, l\'ultima ne perde 140', () => {
  const question = { question:'Q', options:['a','b'], correctIndex:0, leaderboardBands: {
    leader: {errorMultiplier:2.00, comebackBonusPercent:0},
    last: {errorMultiplier:0.70, comebackBonusPercent:8}
  }};
  __setTestGameQuestions({ rounds:{1:[question]}, final:null, tiebreak:null });
  __setTestOverridesByTeam({});
  __setTestState({
    config: { scoring:{correct:1000, wrong:-999, noAnswer:0}, scoringProfile:'dinamico', dynamicScoring:{wrongPenaltyRate:0.20} },
    scoringOverrides: {}
  });
  assert.equal(pointsForAnswer(1, 0, 1, 0, 'leader'), -400); // sc.wrong (-999) NON viene usato: la fascia lo sostituisce
  assert.equal(pointsForAnswer(1, 0, 1, 0, 'last'), -140);
});

test('pointsForAnswer applica il bonus rimonta sulla risposta corretta per le fasce basse', () => {
  const question = { question:'Q', options:['a','b'], correctIndex:0, leaderboardBands: { teamZ: {errorMultiplier:0.70, comebackBonusPercent:8} } };
  __setTestGameQuestions({ rounds:{1:[question]}, final:null, tiebreak:null });
  __setTestOverridesByTeam({});
  __setTestState({
    config: { scoring:{correct:1000, wrong:0, noAnswer:0}, scoringProfile:'dinamico', dynamicScoring:{wrongPenaltyRate:0.20} },
    scoringOverrides: {}
  });
  assert.equal(pointsForAnswer(1, 0, 0, 0, 'teamZ'), 1080); // 1000 + round(1000*8/100), nessun bonus ordine (assente)
});

test('pointsForAnswer: senza una fascia congelata per la squadra, resta il malus fisso di sempre (nessuna sorpresa)', () => {
  const question = { question:'Q', options:['a','b'], correctIndex:0 }; // niente leaderboardBands
  __setTestGameQuestions({ rounds:{1:[question]}, final:null, tiebreak:null });
  __setTestOverridesByTeam({});
  __setTestState({
    config: { scoring:{correct:1000, wrong:-250, noAnswer:0}, scoringProfile:'dinamico', dynamicScoring:{wrongPenaltyRate:0.20} },
    scoringOverrides: {}
  });
  assert.equal(pointsForAnswer(1, 0, 1, 0, 'teamSenzaFascia'), -250);
});
