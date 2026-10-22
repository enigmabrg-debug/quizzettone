// PL-18 (contratto comune delle domande): withQuestionDefaults applica il
// contratto in lettura, così le domande salvate prima di questo pacchetto
// (incluse le seed Q1/Q2/QF) restano valide senza una migrazione manuale.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withQuestionDefaults, CONTENT_TYPES, ANSWER_TYPES, ANSWER_POLICIES, DIFFICULTIES } = require('../../js/state.js');

test('withQuestionDefaults applica tutti i default a una domanda legacy senza i nuovi campi', () => {
  const legacy = {id:'q1', pool:'manche', category:'Musica', question:'Che canzone è?', options:['a','b','c','d'], correctIndex:2, adminNote:'Nota', audioUrl:null, lastUsedAt:12345};
  const withDefaults = withQuestionDefaults(legacy);
  assert.equal(withDefaults.contentType, 'testo');
  assert.equal(withDefaults.answerType, 'scelta');
  assert.equal(withDefaults.tolerance, null);
  assert.equal(withDefaults.answerPolicy, 'definitiva');
  assert.equal(withDefaults.difficulty, 'media');
  assert.deepEqual(withDefaults.presentation, {mode: 'inherit'});
  assert.equal(withDefaults.sharedScreenRequirement, false);
  // i campi originali non vengono toccati
  assert.equal(withDefaults.question, legacy.question);
  assert.equal(withDefaults.correctIndex, 2);
  assert.equal(withDefaults.lastUsedAt, 12345);
});

test('withQuestionDefaults preserva i campi già dichiarati esplicitamente, non li sovrascrive', () => {
  const q = {
    id:'q2', pool:'finale', category:'Scienze', question:'Quanto pesa?', options:['1kg','2kg'], correctIndex:0,
    contentType:'immagine', answerType:'numero', tolerance:0.5, answerPolicy:'modificabile', difficulty:'difficile',
    presentation: {mode:'shared_screen'}, sharedScreenRequirement: true
  };
  const result = withQuestionDefaults(q);
  assert.equal(result.contentType, 'immagine');
  assert.equal(result.answerType, 'numero');
  assert.equal(result.tolerance, 0.5);
  assert.equal(result.answerPolicy, 'modificabile');
  assert.equal(result.difficulty, 'difficile');
  assert.deepEqual(result.presentation, {mode:'shared_screen'});
  assert.equal(result.sharedScreenRequirement, true);
});

test('withQuestionDefaults: tolerance 0 (valore legittimo, non "assente") non viene scambiato per null', () => {
  const result = withQuestionDefaults({id:'q3', tolerance: 0});
  assert.equal(result.tolerance, 0);
});

test('withQuestionDefaults(null) non lancia, ritorna null (nessuna domanda a questo indice)', () => {
  assert.equal(withQuestionDefaults(null), null);
  assert.equal(withQuestionDefaults(undefined), undefined);
});

test('gli enum del contratto sono quelli dichiarati dal piano (item 15)', () => {
  assert.deepEqual(CONTENT_TYPES, ['testo','immagine','audio','video']);
  assert.deepEqual(ANSWER_TYPES, ['scelta','vero_falso','ordinamento','numero','testo_libero']);
  assert.deepEqual(ANSWER_POLICIES, ['definitiva','modificabile']);
  assert.deepEqual(DIFFICULTIES, ['facile','media','difficile']);
});

// PL-19 (domanda fotografica)
test('withQuestionDefaults: imageUrl è null di default su una domanda legacy, preservato se già presente', () => {
  assert.equal(withQuestionDefaults({id:'q4'}).imageUrl, null);
  assert.equal(withQuestionDefaults({id:'q5', imageUrl:'https://example.com/a.jpg'}).imageUrl, 'https://example.com/a.jpg');
});

// PL-19 (vero/falso): una domanda con esattamente 2 opzioni resta valida
// col contratto — nessun campo extra richiesto, il motore a scelta multipla
// esistente non fa distinzioni sul numero di opzioni.
test('withQuestionDefaults applica il contratto anche a una domanda con solo 2 opzioni (Vero/Falso)', () => {
  const vf = withQuestionDefaults({id:'q6', question:'La Terra è piatta?', options:['Vero','Falso'], correctIndex:1, answerType:'vero_falso'});
  assert.equal(vf.options.length, 2);
  assert.equal(vf.answerType, 'vero_falso');
});
