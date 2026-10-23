// Schermo condiviso (PROPOSTA_SCHERMO_CONDIVISO_completa.md): modalità
// risolta, requisiti, politica di sblocco, contratto delle attività, risposte
// di un'altra apertura scartate, domande già giocate.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePresentationMode, resolveUnlockPolicy, effectiveRequirement, activityTypeFor, activityContract, ACTIVITY_TYPES,
  withQuestionDefaults, filterStaleAnswers, drawQuestionsForGame,
  __setTestState, __setTestQuestionBank, __setTestGameQuestions
} = require('../../js/state.js');

const q = extra => withQuestionDefaults({id:'q', pool:'manche', category:'Storia', question:'?', options:['a','b','c','d'], correctIndex:0, ...(extra||{})});
const cfg = (displayMode, extra) => ({displayMode, timerStartMode:'auto', sharedScreen:{answerUnlockPolicy:'manual'}, ...(extra||{})});

test('§6: la modalità della partita vale se la domanda non dice altro', () => {
  assert.equal(resolvePresentationMode(q(), cfg('team_devices'), true), 'team_devices');
  assert.equal(resolvePresentationMode(q(), cfg('shared_screen'), true), 'shared_screen');
  assert.equal(resolvePresentationMode(q(), cfg('hybrid'), true), 'shared_screen');
});

test('§6: senza Display pronto, schermo condiviso e mista ripiegano sui telefoni', () => {
  assert.equal(resolvePresentationMode(q(), cfg('shared_screen'), false), 'team_devices');
  assert.equal(resolvePresentationMode(q(), cfg('hybrid'), false), 'team_devices');
});

test('§5.1: la domanda può forzare i telefoni o preferire lo schermo', () => {
  assert.equal(resolvePresentationMode(q({presentation:{mode:'team_devices'}}), cfg('shared_screen'), true), 'team_devices');
  assert.equal(resolvePresentationMode(q({presentation:{mode:'shared_screen'}}), cfg('team_devices'), true), 'shared_screen');
  assert.equal(resolvePresentationMode(q({presentation:{mode:'shared_screen'}}), cfg('team_devices'), false), 'team_devices');
});

test('§5.2: un\'attività che richiede il Display si blocca senza Display, anche in una partita sui telefoni', () => {
  const req = q({sharedScreenRequirement:'required'});
  assert.equal(effectiveRequirement(req), 'required');
  assert.equal(resolvePresentationMode(req, cfg('team_devices'), false), 'blocked');
  assert.equal(resolvePresentationMode(req, cfg('team_devices'), true), 'shared_screen');
});

test('§8: politica di sblocco', () => {
  // Senza schermo: subito, o manuale se l'admin ha scelto l'avvio manuale del timer.
  assert.equal(resolveUnlockPolicy(q(), cfg('team_devices'), 'team_devices'), 'immediate');
  assert.equal(resolveUnlockPolicy(q(), cfg('team_devices', {timerStartMode:'manual'}), 'team_devices'), 'manual');
  // Con schermo: default manuale (regola 4), configurabile, sovrascrivibile dalla domanda.
  assert.equal(resolveUnlockPolicy(q(), cfg('shared_screen'), 'shared_screen'), 'manual');
  assert.equal(resolveUnlockPolicy(q(), cfg('shared_screen', {sharedScreen:{answerUnlockPolicy:'delayed'}}), 'shared_screen'), 'delayed');
  assert.equal(resolveUnlockPolicy(q({presentation:{inputUnlockPolicy:'immediate'}}), cfg('shared_screen'), 'shared_screen'), 'immediate');
  // "A fine audio" senza audio diventa manuale.
  assert.equal(resolveUnlockPolicy(q({presentation:{inputUnlockPolicy:'after_media'}}), cfg('shared_screen'), 'shared_screen'), 'manual');
  assert.equal(resolveUnlockPolicy(q({audioUrl:'x.mp3', presentation:{inputUnlockPolicy:'after_media'}}), cfg('shared_screen'), 'shared_screen'), 'after_media');
});

test('§21-22: ogni tipo di attività dichiara il suo contratto', () => {
  const keys = ['sharedScreenRequirement','supportedPresentationModes','teamController','contentDistribution','inputUnlockPolicy','timerPolicy','fallbackStrategy','spectatorPolicy'];
  Object.entries(ACTIVITY_TYPES).forEach(([name, t]) => keys.forEach(k => assert.ok(t[k]!==undefined, name+' manca '+k)));
  assert.equal(activityTypeFor(q()), 'scelta');
  assert.equal(activityTypeFor(q({answerType:'vero_falso'})), 'vero_falso');
  assert.equal(activityTypeFor(q({imageUrl:'x.png'})), 'immagine');
  assert.equal(activityTypeFor(q({answerType:'top10'})), 'top10');
  assert.equal(activityContract(q({imageUrl:'x.png'})).fallbackStrategy, 'show_media_on_teams');
  assert.equal(ACTIVITY_TYPES.live_buzzer.sharedScreenRequirement, 'required');
});

test('§25: una risposta di un\'altra apertura della stessa domanda non vale; quelle senza instanceId sì', () => {
  const gq = {rounds:{1:[{instanceId:'act_nuova'}]}, final:[], tiebreak:{instanceId:'act_tb2'}};
  const out = filterStaleAnswers({
    a: {'1-0': {optionIndex:0, instanceId:'act_nuova'}, 'tiebreak-0': {optionIndex:1, instanceId:'act_tb1'}},
    b: {'1-0': {optionIndex:2, instanceId:'act_vecchia'}},
    c: {'1-0': {optionIndex:3}},
  }, gq);
  assert.ok(out.a['1-0']);
  assert.equal(out.a['tiebreak-0'], undefined);
  assert.equal(out.b['1-0'], undefined);
  assert.ok(out.c['1-0']);
});

test('domande già giocate: si pescano prima quelle nuove, poi le meno recenti', () => {
  __setTestState({config:{gameType:'quiz', blockDuplicateQuestions:true}});
  __setTestGameQuestions(null);
  const mk = (id, cat, lastUsedAt) => q({id, category:cat, question:'Domanda '+id, lastUsedAt});
  __setTestQuestionBank({a: mk('a','Storia',null), b: mk('b','Storia',500), c: mk('c','Arte',100), d: mk('d','Arte',null)});
  for(let n=0; n<10; n++){
    assert.deepEqual(drawQuestionsForGame('manche', 2).map(x=>x.id).sort(), ['a','d']);
    assert.deepEqual(drawQuestionsForGame('manche', 3).map(x=>x.id).sort(), ['a','c','d']); // poi la giocata da più tempo
  }
});
