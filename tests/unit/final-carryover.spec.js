// PL-16: scoreCarryover era configurabile in Sala pre-partita ma non veniva
// mai letto da nessuna funzione di scoring (totalScore sommava sempre
// qualificationScore + roundScore('final'), equivalente a "Mantieni").
// Verifica che le tre modalità producano davvero risultati diversi per una
// squadra finalista, e che il comportamento resti invariato per le squadre
// NON finaliste (state.finalists è null durante la qualificazione).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  totalScore, qualificationScore,
  __setTestState, __setTestGameQuestions, __setTestOverridesByTeam, __setTestAnswersByTeam
} = require('../../js/state.js');

function setup({ scoreCarryover, finalistBonusTable, finalists, qualificationScores, finalScores }) {
  // Manche 1 (qualificazione): un solo "slot", punteggio dagli override.
  // Finale: un solo "slot", punteggio dagli override — separato per round.
  __setTestGameQuestions({ rounds: { 1: [{}] }, final: [{}], tiebreak: null });
  __setTestAnswersByTeam({});
  const overrides = {};
  Object.keys(qualificationScores || {}).forEach(id => {
    overrides[id] = overrides[id] || {};
    overrides[id]['1-0'] = qualificationScores[id];
  });
  Object.keys(finalScores || {}).forEach(id => {
    overrides[id] = overrides[id] || {};
    overrides[id]['final-0'] = finalScores[id];
  });
  __setTestOverridesByTeam(overrides);
  __setTestState({
    config: { rounds: 1, scoring: {correct:1000, wrong:0, noAnswer:0}, scoreCarryover, finalistBonusTable: finalistBonusTable || [30,20,10] },
    finalists: finalists || null,
    cancelledQuestions: []
  });
}

test('scoreCarryover "reset": i finalisti iniziano la finale da 0, indipendentemente dal punteggio di qualificazione', () => {
  setup({
    scoreCarryover: 'reset',
    finalists: ['teamA', 'teamB'],
    qualificationScores: { teamA: 5000, teamB: 100 }, // enorme differenza in qualificazione...
    finalScores: { teamA: 0, teamB: 0 } // ...ma la finale non è ancora iniziata
  });
  assert.equal(totalScore('teamA'), 0);
  assert.equal(totalScore('teamB'), 0);
});

test('scoreCarryover "reset": una volta iniziata la finale, conta SOLO il punteggio della finale', () => {
  setup({
    scoreCarryover: 'reset',
    finalists: ['teamA', 'teamB'],
    qualificationScores: { teamA: 5000, teamB: 100 },
    finalScores: { teamA: 50, teamB: 200 } // teamB risponde meglio in finale...
  });
  assert.equal(totalScore('teamA'), 50);
  assert.equal(totalScore('teamB'), 200); // ...e infatti è avanti, nonostante la qualificazione enormemente peggiore
});

test('scoreCarryover "keep": il punteggio di qualificazione si somma a quello della finale (comportamento di sempre)', () => {
  setup({
    scoreCarryover: 'keep',
    finalists: ['teamA', 'teamB'],
    qualificationScores: { teamA: 500, teamB: 300 },
    finalScores: { teamA: 50, teamB: 200 }
  });
  assert.equal(totalScore('teamA'), 550);
  assert.equal(totalScore('teamB'), 500);
  assert.equal(totalScore('teamA'), qualificationScore('teamA') + 50);
});

test('scoreCarryover "convert": credito per posizione di qualificazione (piano §4.3: +30/+20/+10%), non il punteggio grezzo', () => {
  setup({
    scoreCarryover: 'convert',
    finalistBonusTable: [30, 20, 10],
    finalists: ['teamA', 'teamB', 'teamC'], // già ordinato per qualificationScore da adminRevealFinalists
    qualificationScores: { teamA: 999999, teamB: 1, teamC: 1 }, // il punteggio grezzo NON deve influire, solo la posizione
    finalScores: { teamA: 0, teamB: 0, teamC: 0 }
  });
  // valore base = config.scoring.correct = 1000
  assert.equal(totalScore('teamA'), 300); // 1ª posizione: +30% di 1000
  assert.equal(totalScore('teamB'), 200); // 2ª posizione: +20%
  assert.equal(totalScore('teamC'), 100); // 3ª posizione: +10%
});

test('scoreCarryover "convert": oltre l\'ultima voce della tabella, credito 0% (come il bonus ordine di PL-14)', () => {
  setup({
    scoreCarryover: 'convert',
    finalistBonusTable: [30, 20, 10],
    finalists: ['teamA', 'teamB', 'teamC', 'teamD'], // 4ª posizione: fuori tabella
    finalScores: { teamD: 40 }
  });
  assert.equal(totalScore('teamD'), 40); // 0% di credito + il suo punteggio finale
});

test('scoreCarryover non si applica a squadre non finaliste (state.finalists === null durante la qualificazione)', () => {
  setup({
    scoreCarryover: 'reset', // sarebbe distruttivo se applicato per errore fuori dalla finale
    finalists: null,
    qualificationScores: { teamA: 700 }
  });
  assert.equal(totalScore('teamA'), 700); // comportamento di sempre: qualificationScore + roundScore('final', vuoto)
});

test('scoreCarryover non si applica a una squadra eliminata, anche a finale iniziata', () => {
  setup({
    scoreCarryover: 'reset',
    finalists: ['teamA'], // teamB NON è tra i finalisti
    qualificationScores: { teamA: 500, teamB: 500 }
  });
  assert.equal(totalScore('teamB'), 500); // non toccata da 'reset', resta la sua qualificazione
});
