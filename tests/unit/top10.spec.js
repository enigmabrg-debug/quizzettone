// Top Dieci: estrazione delle varianti da una classifica e punteggi.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TOP10_SEED, isValidTop10, materializeTop10, top10Points, isAnswerCorrect, parseBulkQuestions,
  questionMatchesGameType, drawQuestionsForGame, top10BankEntry, teamPointsForQuestion,
  __setTestState, __setTestQuestionBank, __setTestGameQuestions, __setTestAnswersByTeam, __setTestOverridesByTeam
} = require('../../js/state.js');

const ITEMS = ['a','b','c','d','e','f','g','h','i','j'];
const bankQ = (id, extra) => top10BankEntry(id, {pool:'manche', category:'Geografia', title:'Classifica '+id, items: ITEMS, ...(extra||{})});
const SC = {correct:1, wrong:0, noAnswer:0};

function setState(cfg){
  __setTestState({config: {rounds:1, scoring: SC, scoringProfile:'classico', gameType:'topdieci', ...(cfg||{})}, cancelledQuestions: []});
}

test('every seed ranking is valid and has a source', () => {
  TOP10_SEED.forEach(t => {
    assert.ok(isValidTop10(bankQ('x', t)), t.title);
    assert.ok(t.source, t.title + ' has no source');
    assert.equal(new Set(t.items).size, 10, t.title + ' has repeated items');
  });
});

test('isValidTop10 rejects wrong item counts, blank items and unknown variants', () => {
  assert.equal(isValidTop10(bankQ('x', {items: ITEMS.slice(0,9)})), false);
  assert.equal(isValidTop10(bankQ('x', {items: [...ITEMS.slice(0,9), ' ']})), false);
  assert.equal(isValidTop10(bankQ('x', {variants: ['indovina']})), false);
  assert.equal(isValidTop10(bankQ('x')), true);
});

test('"posizione": the answer is the item\'s rank, options are the 10 positions', () => {
  setState();
  for(let n=0; n<30; n++){
    const q = materializeTop10(bankQ('x'), 'posizione');
    assert.equal(q.options.length, 10);
    assert.equal(q.options[q.correctIndex], (q.correctIndex+1)+'°');
    assert.ok(q.question.includes('«'+ITEMS[q.correctIndex]+'»'));
    assert.deepEqual(q.top10Shown, [q.correctIndex]);
  }
});

test('"primo": 4 distinct items, the correct one is the highest ranked', () => {
  for(let n=0; n<30; n++){
    const q = materializeTop10(bankQ('x'), 'primo');
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.top10Shown).size, 4);
    assert.equal(q.top10Shown[q.correctIndex], Math.min(...q.top10Shown));
    q.options.forEach((o,i) => assert.equal(o, ITEMS[q.top10Shown[i]]));
  }
});

test('"ordina": correctOrder lists the option indices from highest to lowest rank', () => {
  for(let n=0; n<30; n++){
    const q = materializeTop10(bankQ('x'), 'ordina');
    const ranks = q.correctOrder.map(i => q.top10Shown[i]);
    assert.deepEqual(ranks, [...ranks].sort((a,b)=>a-b));
    assert.equal(q.correctIndex, null);
    assert.ok(isAnswerCorrect(q, {order: q.correctOrder}));
    assert.ok(!isAnswerCorrect(q, {order: [...q.correctOrder].reverse()}));
  }
});

test('only the allowed variants are drawn', () => {
  for(let n=0; n<20; n++) assert.equal(materializeTop10(bankQ('x', {variants:['ordina']})).top10Variant, 'ordina');
});

test('"posizione" points: exact x3, off by one x1, otherwise the wrong-answer value', () => {
  setState();
  const q = {...materializeTop10(bankQ('x'), 'posizione'), correctIndex: 4, top10Shown:[4]};
  assert.equal(top10Points(q, {optionIndex:4}, SC), 3);
  assert.equal(top10Points(q, {optionIndex:3}, SC), 1);
  assert.equal(top10Points(q, {optionIndex:5}, SC), 1);
  assert.equal(top10Points(q, {optionIndex:7}, {correct:1, wrong:-1, noAnswer:0}), -1);
  // Il "punti corretta" della domanda (es. punti doppi) scala tutto.
  assert.equal(top10Points(q, {optionIndex:4}, {correct:2, wrong:0, noAnswer:0}), 6);
});

test('"ordina" points: one per item in place, bonus for a perfect order', () => {
  setState();
  const q = {...materializeTop10(bankQ('x'), 'ordina'), top10Shown:[7,2,5,0], correctOrder:[3,1,2,0]};
  assert.equal(top10Points(q, {order:[3,1,2,0]}, SC), 6);
  assert.equal(top10Points(q, {order:[3,1,0,2]}, SC), 2);
  assert.equal(top10Points(q, {order:[0,2,1,3]}, SC), 0);
});

test('scoring multipliers come from the game config', () => {
  setState({top10Scoring:{positionExact:5, positionNear:2, orderPerItem:2, orderPerfectBonus:0}});
  const q = {...materializeTop10(bankQ('x'), 'posizione'), correctIndex: 0, top10Shown:[0]};
  assert.equal(top10Points(q, {optionIndex:0}, SC), 5);
  assert.equal(top10Points(q, {optionIndex:1}, SC), 2);
});

test('teamPointsForQuestion routes Top Dieci answers through top10Points', () => {
  setState();
  const q = {...materializeTop10(bankQ('x'), 'ordina'), top10Shown:[7,2,5,0], correctOrder:[3,1,2,0]};
  __setTestGameQuestions({rounds:{1:[q]}, final:[], tiebreak:null});
  __setTestOverridesByTeam({});
  __setTestAnswersByTeam({team_a:{'1-0':{order:[3,1,2,0], ts:1}}, team_b:{'1-0':{order:[3,1,0,2], ts:2}}});
  assert.equal(teamPointsForQuestion('team_a', 1, 0), 6);
  assert.equal(teamPointsForQuestion('team_b', 1, 0), 2);
});

test('game type filters which questions are drawn', () => {
  const quizQ = {id:'q1', pool:'manche', category:'Storia', question:'?', options:['a','b','c','d'], correctIndex:0, answerType:'scelta'};
  __setTestGameQuestions(null);
  __setTestQuestionBank({q1: quizQ, t1: bankQ('t1'), t2: bankQ('t2')});
  setState({gameType:'quiz'});
  assert.deepEqual(drawQuestionsForGame('manche', 5).map(q=>q.id), ['q1']);
  setState({gameType:'topdieci'});
  const drawn = drawQuestionsForGame('manche', 5);
  assert.deepEqual(drawn.map(q=>q.id).sort(), ['t1','t2']);
  assert.ok(drawn.every(q=>q.top10Variant), 'top10 questions are materialized when drawn');
  setState({gameType:'misto'});
  assert.equal(drawQuestionsForGame('manche', 5).length, 3);
  assert.equal(questionMatchesGameType(quizQ), true);
});

test('bulk import accepts Top Dieci lines and rejects malformed ones', () => {
  const ok = 'top10|manche|Geografia|Titolo|'+ITEMS.join(';')+'|primo,ordina|ISTAT';
  const {parsed, errors} = parseBulkQuestions(ok + '\n' + 'top10|manche|Geografia|Titolo|a;b;c\n' + 'top10|manche|Geografia|Titolo|'+ITEMS.join(';')+'|tutte');
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].variants, ['primo','ordina']);
  assert.equal(parsed[0].source, 'ISTAT');
  assert.equal(errors.length, 2);
});
