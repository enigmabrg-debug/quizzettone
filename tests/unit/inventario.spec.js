// Inventario pronto: data/inventario.json deve corrispondere ai file di testo
// in data/inventario/, avere 1000 domande ben formate e 100 classifiche
// giocabili, e l'import non deve mai creare doppioni.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {build} = require('../../scripts/build-inventario.js');
const {
  CATEGORIES, DIFFICULTIES, isValidTop10, top10Items, normalizeTop10Text, matchTop10Answer,
  top10BankEntry, planInventoryImport
} = require('../../js/state.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/inventario.json'), 'utf8'));

test('inventario.json is up to date with the text sources', () => {
  assert.deepEqual(data, build(), 'run: node scripts/build-inventario.js');
});

test('1000 questions, every category covered, mixed difficulty', () => {
  assert.equal(data.questions.length, 1000);
  const perCategory = {};
  data.questions.forEach(q => { perCategory[q.category] = (perCategory[q.category] || 0) + 1; });
  assert.deepEqual(Object.keys(perCategory).sort(), [...CATEGORIES].sort());
  Object.entries(perCategory).forEach(([c, n]) => assert.ok(n >= 40, c + ' has only ' + n + ' questions'));
  const perLevel = {};
  data.questions.forEach(q => { perLevel[q.difficulty] = (perLevel[q.difficulty] || 0) + 1; });
  DIFFICULTIES.forEach(l => assert.ok(perLevel[l] >= 150, l + ': ' + perLevel[l]));
  // Le difficili vanno in finale, le altre nelle manche.
  data.questions.forEach(q => assert.equal(q.pool, q.difficulty === 'difficile' ? 'finale' : 'manche', q.question));
});

test('every question has 4 distinct options and a valid correct index', () => {
  const seen = new Set();
  data.questions.forEach(q => {
    assert.ok(q.question.trim(), q.id);
    assert.equal(q.options.length, 4, q.question);
    assert.equal(new Set(q.options.map(o => o.trim().toLowerCase())).size, 4, 'repeated option: ' + q.question);
    assert.ok(q.options.every(o => o.trim()), 'empty option: ' + q.question);
    assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4, q.question);
    const k = q.question.trim().toLowerCase();
    assert.ok(!seen.has(k), 'duplicate question: ' + q.question);
    seen.add(k);
  });
  // Il mescolamento non deve lasciare la risposta giusta sempre al primo posto.
  const firsts = data.questions.filter(q => q.correctIndex === 0).length;
  assert.ok(firsts > 150 && firsts < 350, 'correct answer in first position ' + firsts + ' times');
});

test('100 Top Ten rankings, valid, sourced, with 10 distinct items and a value each', () => {
  assert.equal(data.top10.length, 100);
  const titles = new Set();
  data.top10.forEach(t => {
    assert.ok(CATEGORIES.includes(t.category), t.title + ': ' + t.category);
    assert.ok(t.pool === 'manche' || t.pool === 'finale', t.title);
    assert.ok(t.source, t.title + ' has no source');
    const q = top10BankEntry(t.id, t);
    assert.ok(isValidTop10(q), t.title);
    const items = top10Items(q);
    assert.equal(new Set(items.map(it => normalizeTop10Text(it.name))).size, 10, t.title + ' has repeated items');
    assert.ok(items.every(it => it.value), t.title + ' has an item without value');
    assert.ok(!titles.has(t.title.toLowerCase()), 'duplicate title: ' + t.title);
    titles.add(t.title.toLowerCase());
  });
});

test('every name and alternative of every ranking is recognised as its own item', () => {
  data.top10.forEach(t => {
    const q = top10BankEntry(t.id, t);
    top10Items(q).forEach((it, i) => {
      [it.name, ...it.alts].forEach(a => {
        assert.ok(normalizeTop10Text(a), t.title + ': "' + a + '" is empty once normalised');
        const r = matchTop10Answer(q, {}, a);
        assert.equal(r.index, i, t.title + ': "' + a + '" matched item ' + r.index);
      });
    });
  });
});

test('ids are unique and stable across builds', () => {
  const ids = [...data.questions, ...data.top10].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(build().questions.map(q => q.id), data.questions.map(q => q.id));
});

test('import plan adds everything to an empty bank and nothing the second time', () => {
  const first = planInventoryImport(data, {});
  assert.equal(first.quiz, 1000);
  assert.equal(first.top10, 100);
  assert.equal(first.skipped, 0);
  const bank = Object.fromEntries(first.entries.map(e => [e.id, e]));
  const entry = bank[data.questions[0].id];
  assert.equal(entry.difficulty, data.questions[0].difficulty);
  assert.equal(entry.options[entry.correctIndex], data.questions[0].options[data.questions[0].correctIndex]);
  const again = planInventoryImport(data, bank);
  assert.equal(again.entries.length, 0);
  assert.equal(again.skipped, 1100);
});

test('import plan skips questions already written by hand with the same text', () => {
  const q = data.questions[5], t = data.top10[3];
  const bank = {
    a: {id:'a', answerType:'scelta', question:'  ' + q.question.toUpperCase() + ' ', options:['x','y','z','w'], correctIndex:0},
    b: {id:'b', answerType:'top10', question:t.title, top10:{title:t.title, items:[]}}
  };
  const plan = planInventoryImport(data, bank);
  assert.equal(plan.skipped, 2);
  assert.equal(plan.quiz, 999);
  assert.equal(plan.top10, 99);
});
