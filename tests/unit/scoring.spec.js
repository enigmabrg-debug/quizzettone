// PL-13 (motore di scoring a profili, scope "solo plumbing"): test unitari
// sulle funzioni pure di js/state.js, senza browser/emulatore. Verificano
// due cose distinte:
//   1. config.scoringProfile/dynamicScoring esistono, hanno i default
//      dichiarati da Piano_modifiche_Quizzettone.md §4.2, e sopravvivono
//      correttamente a withDefaults() (stesso pattern di retrocompatibilità
//      già usato per scoring/tiebreakRule/lateJoin).
//   2. (PL-13) Il calcolo dei punti (pointsForAnswer) è identico per tutti e
//      tre i profili finché orderBonusAssignments non esiste ancora
//      sull'istanza della domanda — blocca una regressione in cui
//      selezionare "Dinamico" cambiasse il punteggio prima del previsto.
//   3. (PL-14) Una volta che orderBonusAssignments esiste (calcolato alla
//      chiusura da ensureOrderBonusComputed/computeOrderBonusAssignments),
//      il profilo dinamico applica davvero il bonus per ordine di arrivo tra
//      le risposte corrette, e il bonus velocità lineare (classico) si
//      disattiva per gli altri profili.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultState, withDefaults,
  scoringFor, pointsForAnswer, computeSpeedBonusAtSubmission,
  computeOrderBonusAssignments, teamPointsForQuestion,
  __setTestState, __setTestGameQuestions, __setTestScoringDefaults,
  __setTestAnswersByTeam, __setTestOverridesByTeam
} = require('../../js/state.js');

test('defaultState().config ha scoringProfile "classico" e le tabelle di default del piano §4.2', () => {
  const cfg = defaultState().config;
  assert.equal(cfg.scoringProfile, 'classico');
  assert.deepEqual(cfg.dynamicScoring.orderBonusPercents, [25, 20, 15, 10, 5]);
  assert.equal(cfg.dynamicScoring.wrongPenaltyRate, 0.20);
  assert.deepEqual(cfg.dynamicScoring.penaltyBands, [
    {maxPercentile:10, errorMultiplier:2.00, comebackBonusPercent:0},
    {maxPercentile:25, errorMultiplier:1.75, comebackBonusPercent:0},
    {maxPercentile:50, errorMultiplier:1.40, comebackBonusPercent:2},
    {maxPercentile:75, errorMultiplier:1.10, comebackBonusPercent:5},
    {maxPercentile:100, errorMultiplier:0.70, comebackBonusPercent:8}
  ]);
});

test('withDefaults() applica scoringProfile/dynamicScoring a uno stato legacy che non li conosce', () => {
  const legacyRaw = { config: { rounds: 3, scoring: {correct:2, wrong:-1, noAnswer:0} } };
  const merged = withDefaults(legacyRaw);
  assert.equal(merged.config.rounds, 3); // il resto del merge esistente non regredisce
  assert.equal(merged.config.scoringProfile, 'classico');
  assert.deepEqual(merged.config.dynamicScoring, defaultState().config.dynamicScoring);
});

test('withDefaults() fonde una dynamicScoring parziale con i default mancanti (stesso pattern di scoring/tiebreakRule)', () => {
  const raw = { config: { scoringProfile: 'dinamico', dynamicScoring: { wrongPenaltyRate: 0.30 } } };
  const merged = withDefaults(raw);
  assert.equal(merged.config.scoringProfile, 'dinamico');
  assert.equal(merged.config.dynamicScoring.wrongPenaltyRate, 0.30); // esplicito, preservato
  assert.deepEqual(merged.config.dynamicScoring.orderBonusPercents, [25, 20, 15, 10, 5]); // non toccato, default
});

test('pointsForAnswer produce lo stesso risultato per classico/dinamico/personalizzato (nessuna differenza a runtime finché PL-14/15 non la implementano)', () => {
  const question = { question: 'Q', options: ['a','b','c','d'], correctIndex: 1 };
  __setTestGameQuestions({ rounds: { 1: [question] }, final: null, tiebreak: null });
  __setTestScoringDefaults({ correct: 1, wrong: 0, noAnswer: 0 });

  for (const profile of ['classico', 'dinamico', 'personalizzato']) {
    __setTestState({
      config: { scoring: {correct: 10, wrong: -3, noAnswer: 0}, scoringProfile: profile },
      scoringOverrides: {}
    });
    const correctPoints = pointsForAnswer(1, 0, 1, /*speedBonus*/ 0);
    const wrongPoints = pointsForAnswer(1, 0, 0, 0);
    assert.equal(correctPoints, 10, `profilo ${profile}: risposta corretta`);
    assert.equal(wrongPoints, -3, `profilo ${profile}: risposta sbagliata`);
  }
});

test('scoringFor rispetta ancora precedenza override > snapshot > config live, indipendentemente dal profilo', () => {
  const question = { question: 'Q', options: ['a','b'], correctIndex: 0, scoringSnapshot: {correct:5, wrong:-1, noAnswer:0} };
  __setTestGameQuestions({ rounds: { 1: [question] }, final: null, tiebreak: null });
  __setTestState({
    config: { scoring: {correct: 99, wrong: -99, noAnswer: 0}, scoringProfile: 'dinamico' },
    scoringOverrides: {}
  });
  assert.deepEqual(scoringFor(1, 0), {correct:5, wrong:-1, noAnswer:0}); // snapshot vince sulla config live
});

// PL-14: bonus per ordine di arrivo tra le sole risposte corrette.
test('computeOrderBonusAssignments segue la tabella configurata, in ordine di timestamp crescente', () => {
  const question = { question: 'Q', options: ['a','b','c','d'], correctIndex: 1 };
  __setTestGameQuestions({ rounds: { 1: [question] }, final: null, tiebreak: null });
  __setTestState({
    config: { scoringProfile: 'dinamico', dynamicScoring: { orderBonusPercents: [25, 20, 15, 10, 5] } }
  });
  __setTestAnswersByTeam({
    teamC: { '1-0': { optionIndex: 1, ts: 3000 } }, // terza in ordine di arrivo
    teamA: { '1-0': { optionIndex: 1, ts: 1000 } }, // prima
    teamB: { '1-0': { optionIndex: 1, ts: 2000 } }, // seconda
    teamWrong: { '1-0': { optionIndex: 0, ts: 500 } } // sbagliata: non occupa una posizione
  });
  const assignments = computeOrderBonusAssignments(1, 0);
  assert.deepEqual(assignments, { teamA: 25, teamB: 20, teamC: 15 });
  assert.equal(assignments.teamWrong, undefined);
});

test('computeOrderBonusAssignments: pari-merito a timestamp identico riceve lo stesso bonus, con numerazione competitiva', () => {
  const question = { question: 'Q', options: ['a','b'], correctIndex: 0 };
  __setTestGameQuestions({ rounds: { 1: [question] }, final: null, tiebreak: null });
  __setTestState({
    config: { scoringProfile: 'dinamico', dynamicScoring: { orderBonusPercents: [25, 20, 15, 10, 5] } }
  });
  __setTestAnswersByTeam({
    teamA: { '1-0': { optionIndex: 0, ts: 1000 } }, // pari merito 1ª
    teamB: { '1-0': { optionIndex: 0, ts: 1000 } }, // pari merito 1ª (stesso ts di teamA)
    teamC: { '1-0': { optionIndex: 0, ts: 2000 } }  // 3ª (non 2ª: numerazione competitiva)
  });
  const assignments = computeOrderBonusAssignments(1, 0);
  assert.deepEqual(assignments, { teamA: 25, teamB: 25, teamC: 15 });
});

test('pointsForAnswer aggiunge il bonus d\'ordine per il profilo dinamico, letto da orderBonusAssignments', () => {
  const question = { question: 'Q', options: ['a','b'], correctIndex: 0, orderBonusAssignments: { teamA: 20 } };
  __setTestGameQuestions({ rounds: { 1: [question] }, final: null, tiebreak: null });
  __setTestState({
    config: { scoring: {correct: 10, wrong: -2, noAnswer: 0}, scoringProfile: 'dinamico' },
    scoringOverrides: {}
  });
  assert.equal(pointsForAnswer(1, 0, 0, 0, 'teamA'), 12); // 10 + round(10*20/100) = 12
  assert.equal(pointsForAnswer(1, 0, 0, 0, 'teamZ'), 10); // nessun bonus assegnato a questa squadra: solo il base
  assert.equal(pointsForAnswer(1, 0, 1, 0, 'teamA'), -2); // sbagliata: nessun bonus, solo il malus
});

test('teamPointsForQuestion applica il bonus d\'ordine end-to-end (via answersByTeam, non un parametro esplicito)', () => {
  const question = { question: 'Q', options: ['a','b'], correctIndex: 0, orderBonusAssignments: { teamA: 25 } };
  __setTestGameQuestions({ rounds: { 1: [question] }, final: null, tiebreak: null });
  __setTestOverridesByTeam({});
  __setTestAnswersByTeam({ teamA: { '1-0': { optionIndex: 0, ts: 1000 } } });
  __setTestState({
    config: { scoring: {correct: 8, wrong: 0, noAnswer: 0}, scoringProfile: 'dinamico' },
    cancelledQuestions: []
  });
  assert.equal(teamPointsForQuestion('teamA', 1, 0), 10); // 8 + round(8*25/100) = 10
});

test('computeSpeedBonusAtSubmission è disattivato per i profili diversi da "classico", anche se speedBonus.enabled è true', () => {
  __setTestState({
    config: { scoringProfile: 'dinamico', speedBonus: {enabled:true, maxBonus:5, windowMs:10000} },
    timer: {status:'running', startedAt: 1000, durationMs: 10000}
  });
  assert.equal(computeSpeedBonusAtSubmission(2000), 0);

  __setTestState({
    config: { scoringProfile: 'classico', speedBonus: {enabled:true, maxBonus:5, windowMs:10000} },
    timer: {status:'running', startedAt: 1000, durationMs: 10000}
  });
  assert.ok(computeSpeedBonusAtSubmission(2000) > 0); // comportamento classico invariato
});
