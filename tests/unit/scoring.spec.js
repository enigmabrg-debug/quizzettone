// PL-13 (motore di scoring a profili, scope "solo plumbing"): test unitari
// sulle funzioni pure di js/state.js, senza browser/emulatore. Verificano
// due cose distinte:
//   1. config.scoringProfile/dynamicScoring esistono, hanno i default
//      dichiarati da Piano_modifiche_Quizzettone.md §4.2, e sopravvivono
//      correttamente a withDefaults() (stesso pattern di retrocompatibilità
//      già usato per scoring/tiebreakRule/lateJoin).
//   2. Il calcolo dei punti (pointsForAnswer) è OGGI identico per tutti e
//      tre i profili: PL-13 introduce solo l'interruttore e i dati riservati,
//      non ancora letti a runtime (decisione esplicita, vedi PROGRESS_LOG.md).
//      Questo test blocca una futura regressione in cui selezionare
//      "Dinamico"/"Personalizzato" cambiasse il punteggio prima che i
//      pacchetti che dovrebbero farlo (PL-14/PL-15) siano stati eseguiti.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultState, withDefaults,
  scoringFor, pointsForAnswer,
  __setTestState, __setTestGameQuestions, __setTestScoringDefaults
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
