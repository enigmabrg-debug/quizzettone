// Top Dieci a turni: riconoscimento delle risposte scritte, punti per
// posizione, formato delle voci e filtro per tipo di gioco.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TOP10_SEED, isValidTop10, top10Items, normalizeTop10Text, matchTop10Answer, top10TeamPoints,
  top10BoardDefaults, top10CurrentTeam, parseTop10ItemLine, top10ItemLine, parseBulkQuestions,
  questionMatchesGameType, drawQuestionsForGame, top10BankEntry, teamPointsForQuestion,
  __setTestState, __setTestQuestionBank, __setTestGameQuestions, __setTestAnswersByTeam, __setTestOverridesByTeam
} = require('../../js/state.js');

const SC = {correct:1, wrong:0, noAnswer:0};
const mountains = top10BankEntry('m', TOP10_SEED[0]);
const presidents = top10BankEntry('p', TOP10_SEED.find(t => t.title.includes('Presidenti')));
const found = (...idx) => Object.fromEntries(idx.map(i => ['i'+i, {t:'x', turn:0}]));

function setState(cfg, extra){
  __setTestState({config: {rounds:1, scoring: SC, scoringProfile:'classico', gameType:'topdieci', ...(cfg||{})}, cancelledQuestions: [], ...(extra||{})});
}

test('every seed ranking is valid, has a source, 10 distinct items and a value for each', () => {
  TOP10_SEED.forEach(t => {
    const q = top10BankEntry('x', t);
    assert.ok(isValidTop10(q), t.title);
    assert.ok(t.source, t.title + ' has no source');
    const items = top10Items(q);
    assert.equal(new Set(items.map(it => normalizeTop10Text(it.name))).size, 10, t.title + ' has repeated items');
    assert.ok(items.every(it => it.value), t.title + ' has an item without value');
  });
});

test('old string items are still read', () => {
  const q = top10BankEntry('x', {pool:'manche', category:'Geografia', title:'T', items:['a','b','c','d','e','f','g','h','i','j']});
  assert.ok(isValidTop10(q));
  assert.deepEqual(top10Items(q)[0], {name:'a', alts:[], value:null});
});

test('answers ignore case, accents, punctuation and leading articles', () => {
  assert.deepEqual(matchTop10Answer(mountains, {}, 'everest'), {kind:'ok', index:0});
  assert.deepEqual(matchTop10Answer(mountains, {}, "  L'Everest! "), {kind:'ok', index:0});
  const sanremo = top10BankEntry('s', TOP10_SEED.find(t => t.title.includes('Sanremo')));
  assert.equal(matchTop10Answer(sanremo, {}, 'Maneskin').index, 3);
  assert.equal(matchTop10Answer(sanremo, {}, 'Måneskin').index, 3);
});

test('alternatives, surnames and small typos are accepted', () => {
  assert.equal(matchTop10Answer(mountains, {}, 'Chomolungma').index, 0);
  assert.equal(matchTop10Answer(mountains, {}, 'Kanchenjunga').index, 2);
  assert.equal(matchTop10Answer(mountains, {}, 'Nanga Parbatt').index, 8);   // 1 refuso
  assert.equal(matchTop10Answer(mountains, {}, 'Annapurna').index, 9);       // alternativa
  assert.equal(matchTop10Answer(presidents, {}, 'pertini').index, 6);        // solo cognome
  assert.equal(matchTop10Answer(presidents, {}, 'Sandro Pertinni').index, 6);
});

test('short answers need to be exact, wrong answers are rejected', () => {
  assert.equal(matchTop10Answer(mountains, {}, 'K2').kind, 'ok');
  assert.equal(matchTop10Answer(mountains, {}, 'K3').kind, 'wrong');
  assert.equal(matchTop10Answer(mountains, {}, 'Monte Bianco').kind, 'wrong');
  assert.equal(matchTop10Answer(mountains, {}, '').kind, 'wrong');
});

test('an item already on the board is reported as "dup"', () => {
  assert.deepEqual(matchTop10Answer(mountains, found(0), 'Everest'), {kind:'dup', index:0});
});

test('with Mahmood already found, "Mahmood" stays a duplicate and "Blanco" finds the 2022 entry', () => {
  const sanremo = top10BankEntry('s', TOP10_SEED.find(t => t.title.includes('Sanremo')));
  const mahmood = top10Items(sanremo).findIndex(it => it.name==='Mahmood');
  const duo = top10Items(sanremo).findIndex(it => it.name==='Mahmood e Blanco');
  assert.equal(matchTop10Answer(sanremo, {}, 'Mahmood').index, mahmood);
  assert.equal(matchTop10Answer(sanremo, found(mahmood), 'Mahmood').kind, 'dup');
  assert.equal(matchTop10Answer(sanremo, found(mahmood), 'Blanco').index, duo);
});

test('points: position x "correct" for each item found, "wrong" for each error or timeout', () => {
  const b = top10BoardDefaults({order:['a','b'], turn:5,
    found: {i0:{t:'a', turn:0}, i9:{t:'b', turn:1}, i4:{t:'a', turn:2}},
    log: [{t:'a', r:'ok'}, {t:'b', r:'ok'}, {t:'a', r:'ok'}, {t:'b', r:'wrong'}, {t:'a', r:'timeout'}, {t:'b', r:'dup'}, {t:'b', r:'skip'}]});
  assert.equal(top10TeamPoints(b, 'a', SC), 1 + 5);
  assert.equal(top10TeamPoints(b, 'b', SC), 10);
  assert.equal(top10TeamPoints(b, 'a', {correct:2, wrong:-1, noAnswer:0}), 2*(1+5) - 1);
  assert.equal(top10TeamPoints(b, 'b', {correct:1, wrong:-1, noAnswer:0}), 10 - 1); // dup e skip non contano
});

test('turns go round the order', () => {
  const b = top10BoardDefaults({order:['a','b','c'], turn:4});
  assert.equal(top10CurrentTeam(b), 'b');
});

test('teamPointsForQuestion reads Top Dieci points from the board, overrides still win', () => {
  __setTestGameQuestions({rounds:{1:[mountains]}, final:[], tiebreak:null});
  __setTestAnswersByTeam({});
  __setTestOverridesByTeam({});
  setState({}, {top10Boards: {'1-0': {order:['a','b'], turn:2, found:{i7:{t:'a', turn:0}}, log:[{t:'a', r:'ok', i:7}, {t:'b', r:'wrong'}]}}});
  assert.equal(teamPointsForQuestion('a', 1, 0), 8);
  assert.equal(teamPointsForQuestion('b', 1, 0), 0);
  __setTestOverridesByTeam({b: {'1-0': 3}});
  assert.equal(teamPointsForQuestion('b', 1, 0), 3);
});

test('item lines: "Name / alt / alt = value"', () => {
  assert.deepEqual(parseTop10ItemLine('Everest / Chomolungma = 8.849 m'), {name:'Everest', alts:['Chomolungma'], value:'8.849 m'});
  assert.deepEqual(parseTop10ItemLine('K2'), {name:'K2', alts:[], value:null});
  assert.equal(parseTop10ItemLine('   '), null);
  assert.equal(top10ItemLine({name:'Everest', alts:['Chomolungma'], value:'8.849 m'}), 'Everest / Chomolungma = 8.849 m');
});

test('bulk import accepts Top Dieci lines and rejects malformed ones', () => {
  const items = Array.from({length:10}, (_,i) => 'Voce '+i+' / Alt'+i+' = '+i);
  const ok = 'top10|manche|Geografia|Titolo|'+items.join(';')+'|ISTAT';
  const {parsed, errors} = parseBulkQuestions(ok + '\n' + 'top10|manche|Geografia|Titolo|a;b;c\n' + 'top10|altro|Geografia|Titolo|'+items.join(';'));
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].items[3], {name:'Voce 3', alts:['Alt3'], value:'3'});
  assert.equal(parsed[0].source, 'ISTAT');
  assert.equal(errors.length, 2);
});

test('game type filters which questions are drawn', () => {
  const quizQ = {id:'q1', pool:'manche', category:'Storia', question:'?', options:['a','b','c','d'], correctIndex:0, answerType:'scelta'};
  __setTestGameQuestions(null);
  __setTestQuestionBank({q1: quizQ, t1: {...mountains, id:'t1'}, t2: {...presidents, id:'t2', pool:'manche'}});
  setState({gameType:'quiz'});
  assert.deepEqual(drawQuestionsForGame('manche', 5).map(q=>q.id), ['q1']);
  setState({gameType:'topdieci'});
  assert.deepEqual(drawQuestionsForGame('manche', 5).map(q=>q.id).sort(), ['t1','t2']);
  assert.equal(questionMatchesGameType(quizQ), false);
});

test('numbers and roman numerals must be typed exactly', () => {
  const kings = top10BankEntry('k', {pool:'manche', category:'Storia', title:'Re', items:[
    'Guglielmo I','Guglielmo II','Enrico I','Stefano','Enrico II','Riccardo I','Giovanni','Enrico III','Edoardo I','Edoardo II'].map(name=>({name}))});
  assert.equal(matchTop10Answer(kings, {}, 'Enrico II').index, 4);
  assert.equal(matchTop10Answer(kings, {}, 'enrico 2').kind, 'wrong');
  assert.equal(matchTop10Answer(kings, {}, 'Enrico IV').kind, 'wrong');
  assert.equal(matchTop10Answer(kings, {}, 'Guglielmo').kind, 'wrong');
  assert.equal(matchTop10Answer(kings, {}, 'Riccardo II').kind, 'wrong');
  // Il refuso nel nome resta tollerato se il numero è giusto.
  assert.equal(matchTop10Answer(kings, {}, 'Ricardo I').index, 5);
  const years = top10BankEntry('y', {pool:'manche', category:'Sport', title:'Anni', items:
    ['1934','1938','1982','2006','1990','1968','1970','1994','2021','2000'].map(name=>({name}))});
  assert.equal(matchTop10Answer(years, {}, '1998').kind, 'wrong');
  assert.equal(matchTop10Answer(years, {}, '1982').index, 2);
});

test('a surname alone is not accepted when it names another item too', () => {
  const q = top10BankEntry('s', {pool:'manche', category:'Sport', title:'Tenniste', items:[
    'Serena Williams','Venus Williams','Leopard','Snow Leopard','Steffi Graf','Martina Navratilova','Chris Evert','Monica Seles','Justine Henin','Kim Clijsters'].map(name=>({name}))});
  assert.equal(matchTop10Answer(q, {}, 'Williams').kind, 'wrong');
  assert.equal(matchTop10Answer(q, {}, 'Serena Williams').index, 0);
  assert.equal(matchTop10Answer(q, {}, 'Leopard').index, 2);
  assert.equal(matchTop10Answer(q, {}, 'Snow Leopard').index, 3);
  assert.equal(matchTop10Answer(q, {}, 'Graf').index, 4);
});

test('items spelled almost the same need the exact spelling, no typo can cross over', () => {
  const q = top10BankEntry('e', {pool:'manche', category:'Scienze', title:'Elementi', items:[
    'Cesio','Bario','Lantanio','Cerio','Titano','Titania','Esagono','Eptagono','Venere','Cerere'].map(name=>({name}))});
  assert.equal(matchTop10Answer(q, {}, 'cerio').index, 3);
  assert.equal(matchTop10Answer(q, {}, 'cesio').index, 0);
  ['cecio','titani','titanio','estagono'].forEach(a => assert.equal(matchTop10Answer(q, {}, a).kind, 'wrong', a));
  // Lontano da tutte le altre voci il refuso passa ancora.
  assert.equal(matchTop10Answer(q, {}, 'lantamio').index, 2);
});
