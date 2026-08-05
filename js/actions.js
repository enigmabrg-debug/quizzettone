/* ================== AZIONI ADMIN (scrivono su 'state') ================== */
// Costruisce il timer per una domanda appena aperta: parte da solo, a meno
// che l'admin abbia scelto l'avvio manuale nelle impostazioni della partita.
function openQuestionTimer(durationMs, cfg){
  cfg = cfg || state.config;
  const manual = cfg && cfg.timerStartMode === 'manual';
  return manual
    ? {status:'idle', startedAt:null, durationMs, pausedRemainingMs:null, closeReason:null, closedBy:null}
    : {status:'running', startedAt:Date.now(), durationMs, pausedRemainingMs:null, closeReason:null, closedBy:null};
}
/* Storico minimo + "annulla ultima azione": salva uno snapshot del path
   PRIMA della modifica, poi scrive la modifica stessa. 'path' === 'state'
   viene scritto in un'unica operazione insieme al nuovo 'history' (altrimenti
   due safeSet('state', ...) sequenziali basati sullo stesso 'state' locale si
   sovrascriverebbero a vicenda, come nel bug di adminSaveSetup); per path
   diversi da 'state' (es. 'overrides:'+id, 'teaminfo:'+id) le due scritture
   sono su nodi indipendenti e non hanno questo rischio.

   'before' viaggia come stringa JSON (beforeJson) invece che come oggetto
   annidato: Firebase "pota" silenziosamente le proprietà annidate il cui
   valore è {} (es. una squadra senza ancora nessun punteggio manuale), quindi
   uno snapshot vuoto sparirebbe dalla scrittura di 'state' senza errori,
   rendendo l'undo successivo un no-op. Una stringa non va mai incontro a
   questa potatura, qualunque sia la forma del valore che rappresenta. */
async function withUndo(label, path, before, next){
  const log = [...((state.history && state.history.log)||[]).slice(-29), {type:'action', label, at:Date.now()}];
  const history = {last:{label, path, beforeJson: JSON.stringify(before===undefined?null:before), at:Date.now()}, log};
  if(path==='state'){
    await safeSet('state', {...next, history}, true);
  } else {
    await safeSet('state', {...state, history}, true);
    await safeSet(path, next===undefined?null:next, true);
  }
  await refresh();
}
async function adminUndoLast(){
  const last = state.history && state.history.last;
  if(!last) return;
  const before = JSON.parse(last.beforeJson);
  await safeSet(last.path, before, true); // ripristina il valore precedente
  const restored = await safeGet('state', true); // se last.path==='state', il ripristino ha già cambiato anche history
  const priorLog = (restored && restored.history && restored.history.log) || [];
  const log = [...priorLog.slice(-29), {type:'undo', label:'Annullato: '+last.label, at:Date.now()}];
  // 'last' va pulito DOPO il ripristino, con una scrittura separata: garantisce
  // un solo livello di undo invece di annullamenti a catena.
  await safeSet('state/history', {last:null, log}, true);
  await refresh();
}
async function adminStartGame(){
  const cfg = (state && state.config) || defaultState().config;
  const totalNeeded = cfg.questionsPerRound.reduce((a,b)=>a+b, 0);
  const drawn = drawQuestionsForGame('manche', totalNeeded);
  await markQuestionsUsed(drawn);
  const rounds = {};
  let offset = 0;
  for(let r=1; r<=cfg.rounds; r++){
    const count = cfg.questionsPerRound[r-1] || 0;
    rounds[r] = drawn.slice(offset, offset+count);
    offset += count;
  }
  // Riparte da defaultState() per azzerare i progressi della partita precedente,
  // ma preserva le regole/impostazioni scelte in lobby (config, nome partita,
  // Modalità Party) e blocca ulteriori modifiche alla configurazione.
  const s = {
    ...defaultState(),
    config: cfg,
    gameName: (state && state.gameName) || defaultState().gameName,
    setupLocked: true,
    partyMode: (state && state.partyMode) || 'none',
    party: (state && state.party) || defaultState().party,
    phase:'question', round:1, qIndex:0,
    timer: openQuestionTimer(cfg.questionDurationMs, cfg),
    gameQuestions: { rounds, final:null, tiebreak:null },
    audioCue: audioCueForQuestion(drawn[0])
  };
  await safeSet('state', s, true); await refresh();
}
async function adminSaveSetup(gameName, patch){
  if(state.setupLocked) return;
  // Un'unica scrittura atomica: nome partita e config vanno salvati insieme,
  // altrimenti due safeSet('state', ...) sequenziali (ciascuno basato sullo
  // stesso 'state' locale non ancora aggiornato dall'eco del primo) si
  // sovrascriverebbero a vicenda perdendo parte delle modifiche.
  const nextConfig = {...state.config, ...patch};
  if(patch.scoring) nextConfig.scoring = {...state.config.scoring, ...patch.scoring};
  if(patch.tiebreakRule) nextConfig.tiebreakRule = {...state.config.tiebreakRule, ...patch.tiebreakRule};
  if(patch.lateJoin) nextConfig.lateJoin = {...state.config.lateJoin, ...patch.lateJoin};
  await safeSet('state', {...state, gameName, config:nextConfig}, true);
  await refresh();
}
/* Chiusura delle risposte unificata: sia il click manuale dell'admin sia la
   scadenza rilevata dal tick di QUALSIASI client (vedi startUiTick in
   state.js) passano da qui. È una transaction() Firebase pura e idempotente:
   se più schede la eseguono nello stesso istante (es. il timer scade mentre
   4 dispositivi hanno la tab aperta), solo la prima che raggiunge il server
   trova ancora phase==='question' e scrive; le altre, rieseguite dall'SDK
   sul valore già aggiornato, si fermano restituendo undefined (nessuna
   doppia chiusura, nessun evento duplicato). Questo sostituisce il vecchio
   meccanismo che chiudeva la domanda solo se la tab dell'admin era aperta e
   si ri-renderizzava per caso in quel momento. */
async function closeAnswersTransactional(reason){
  const stateRef = db.ref(DB_ROOT + '/state');
  await stateRef.transaction(current=>{
    if(!current) return current;
    if(current.phase !== 'question') return; // già chiusa/avanzata da qualcun altro
    if(!current.timer || current.timer.status !== 'running') return;
    if(reason==='expired'){
      const {startedAt, durationMs} = current.timer;
      if(!startedAt || (Date.now()-startedAt) < durationMs) return; // non ancora scaduta davvero
    }
    return {...current, phase:'closed', timer:{...current.timer, status:'closed', closeReason:reason, closedBy: reason==='expired' ? 'auto' : 'admin'}};
  });
}
async function adminCloseAnswers(){
  await closeAnswersTransactional('manual');
  await refresh();
}
async function adminReopenAnswers(){
  // "Riapre per un intervallo breve in caso di errore tecnico": non riprende
  // il tempo residuo di prima, apre una finestra breve fissa per correggere.
  if(state.phase !== 'closed') return;
  await safeSet('state', {...state, phase:'question', timer:{...state.timer, status:'running', startedAt:Date.now(), durationMs:10000, closeReason:null, closedBy:null}}, true);
  await refresh();
}
async function adminCancelQuestion(){
  if(state.phase!=='question' && state.phase!=='closed') return;
  const key = qkey(state.round, state.qIndex);
  const cancelledQuestions = [...(state.cancelledQuestions||[]), key];
  const next = {...state, phase:'closed', cancelledQuestions, timer:{...state.timer, status:'closed', closeReason:'cancelled', closedBy:'admin'}};
  await withUndo('Domanda annullata', 'state', state, next);
}
async function adminStartTimerManually(){
  if(state.phase!=='question' || state.timer.status!=='idle') return;
  await safeSet('state', {...state, timer:{...state.timer, status:'running', startedAt:Date.now()}}, true);
  await refresh();
}
async function adminPauseTimer(){
  if(state.phase!=='question' || state.timer.status!=='running') return;
  await safeSet('state', {...state, timer:{...state.timer, status:'paused', pausedRemainingMs:timeRemaining()}}, true);
  await refresh();
}
async function adminResumeTimer(){
  if(state.phase!=='question' || state.timer.status!=='paused') return;
  const remaining = state.timer.pausedRemainingMs || 0;
  await safeSet('state', {...state, timer:{...state.timer, status:'running', startedAt: Date.now()-(state.timer.durationMs-remaining), pausedRemainingMs:null}}, true);
  await refresh();
}
async function adminAdjustTimer(deltaMs){
  if(state.phase!=='question') return;
  const t = state.timer;
  if(t.status==='paused'){
    await safeSet('state', {...state, timer:{...t, pausedRemainingMs:Math.max(0, (t.pausedRemainingMs||0)+deltaMs)}}, true);
  } else if(t.status==='running'){
    const newDuration = Math.max(Date.now()-t.startedAt, t.durationMs+deltaMs);
    await safeSet('state', {...state, timer:{...t, durationMs:newDuration}}, true);
  } else {
    return;
  }
  await refresh();
}
async function adminRevealSolution(){
  await safeSet('state', {...state, solutionRevealed:true}, true); await refresh();
}
async function adminReplayCurrentAudio(){
  const q = getQuestion(state.round, state.qIndex);
  const cue = audioCueForQuestion(q);
  if(cue) await safeSet('state', {...state, audioCue:cue}, true);
  await refresh();
}
async function adminStopAudio(){
  const cue = state.audioCue;
  if(!cue) return;
  const el = document.getElementById('gameAudioEl');
  const pos = el ? el.currentTime : 0;
  await safeSet('state', {...state, audioCue:{...cue, action:'stop', startAt:pos, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}}, true);
  await refresh();
}
async function adminResumeAudio(fromStart){
  const cue = state.audioCue;
  if(!cue) return;
  await safeSet('state', {...state, audioCue:{...cue, action:'play', startAt: fromStart ? 0 : (cue.startAt||0), triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}}, true);
  await refresh();
}
async function adminAdjustPoints(id, round, idx, delta){
  const key = qkey(round, idx);
  const current = teamPointsForQuestion(id, round, idx);
  const before = {...(overridesByTeam[id]||{})};
  const next = {...before, [key]: current+delta};
  const label = 'Punti '+(teams[id]?teams[id].name:id)+' '+(delta>0?'+':'')+delta;
  await withUndo(label, 'overrides:'+id, before, next);
}
async function adminNextQuestion(){
  const round = state.round, idx = state.qIndex;
  const list = getList(round);
  const qNumber = idx+1;
  if(typeof round === 'number'){
    const midPoint = Math.ceil(list.length/2);
    const checkpointMinQuestions = (state.config && state.config.checkpointMinQuestions) || 4;
    if(list.length>=checkpointMinQuestions && qNumber===midPoint){
      await safeSet('state', {...state, phase:'checkpoint', checkpoint:{type:'mid', round}, checkpointMode:null}, true);
    } else if(qNumber===list.length){
      await safeSet('state', {...state, phase:'checkpoint', checkpoint:{type:'end', round}, checkpointMode:null}, true);
    } else {
      await safeSet('state', {...state, qIndex:idx+1, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, audioCue:audioCueForQuestion(list[idx+1])}, true);
    }
  } else if(round==='final'){
    if(qNumber===list.length){
      await safeSet('state', {...state, phase:'final_ready'}, true);
    } else {
      await safeSet('state', {...state, qIndex:idx+1, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, audioCue:audioCueForQuestion(list[idx+1])}, true);
    }
  } else if(round==='tiebreak'){
    await safeSet('state', {...state, phase:'tiebreak_closed'}, true);
  }
  await refresh();
}
async function adminSetCheckpointMode(mode){
  await withUndo('Modalità checkpoint: '+mode, 'state', state, {...state, checkpointMode:mode});
}
async function adminContinueFromCheckpoint(){
  const cp = state.checkpoint;
  const totalRounds = (state.config && state.config.rounds) || 2;
  if(cp.type==='mid'){
    const nextQ = getQuestion(cp.round, state.qIndex+1);
    await safeSet('state', {...state, qIndex:state.qIndex+1, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(nextQ)}, true);
  } else if(cp.type==='end' && cp.round < totalRounds){
    const nextRound = cp.round+1;
    const nextQ = getQuestion(nextRound, 0);
    await safeSet('state', {...state, round:nextRound, qIndex:0, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(nextQ)}, true);
  }
  await refresh();
}
async function adminRevealFinalists(){
  const finalistCount = (state.config && state.config.finalistCount) || 2;
  const tiebreakCandidateCount = (state.config && state.config.tiebreakCandidateCount) || 5;
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score:qualificationScore(id)})).sort((a,b)=>b.score-a.score);
  if(ranked.length<=finalistCount){
    await safeSet('state', {...state, phase:'reveal_finalists', finalists:ranked.map(r=>r.id), eliminated:[]}, true);
    await refresh(); return;
  }
  const cutoffScore = ranked[finalistCount-1].score;
  const tiedAtCutoff = ranked.filter(r=>r.score===cutoffScore);
  const aboveCutoff = ranked.filter(r=>r.score>cutoffScore);
  if(tiedAtCutoff.length>1 && aboveCutoff.length<finalistCount){
    // il taglio cade su un pari merito: chi è sopra il taglio è già qualificato,
    // gli spareggianti si giocano i posti rimasti
    const candidateQuestions = drawQuestionsForGame('finale', tiebreakCandidateCount);
    await safeSet('state', {...state, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar: aboveCutoff.map(r=>r.id), candidates: tiedAtCutoff.map(r=>r.id), candidateQuestions, question:null, qIndex:null}}, true);
  } else {
    await safeSet('state', {...state, phase:'reveal_finalists', finalists: ranked.slice(0,finalistCount).map(r=>r.id), eliminated: ranked.slice(finalistCount).map(r=>r.id)}, true);
  }
  await refresh();
}
async function adminStartTiebreakQuestion(qIdx){
  const chosen = state.tiebreak.candidateQuestions[qIdx];
  await markQuestionsUsed([chosen]);
  const tb = {...state.tiebreak, question: chosen, qIndex:qIdx};
  await safeSet('state', {...state, round:'tiebreak', qIndex:0, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, tiebreak: tb, gameQuestions:{...state.gameQuestions, tiebreak: chosen}, audioCue:audioCueForQuestion(chosen)}, true);
  await refresh();
}
async function adminAssignTiebreakWinner(winnerId){
  const finalistCount = (state.config && state.config.finalistCount) || 2;
  const finalists = [...state.tiebreak.qualifiedSoFar, winnerId].slice(0,finalistCount);
  const eliminated = Object.keys(teams).filter(id=>!finalists.includes(id));
  await safeSet('state', {...state, phase:'reveal_finalists', finalists, eliminated, checkpoint:null}, true);
  await refresh();
}
async function adminContinueToFinal(){
  const finalQuestionCount = (state.config && state.config.finalQuestionCount) || 10;
  const drawn = drawQuestionsForGame('finale', finalQuestionCount);
  await markQuestionsUsed(drawn);
  await safeSet('state', {...state, round:'final', qIndex:0, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, checkpoint:null, checkpointMode:null, gameQuestions:{...state.gameQuestions, final:drawn}, audioCue:audioCueForQuestion(drawn[0])}, true);
  await refresh();
}
async function adminRevealWinner(){
  const finalists = state.finalists || [];
  const scores = finalists.map(id=>({id, score: roundScore(id,'final')}));
  scores.sort((a,b)=>b.score-a.score);
  let winner = scores[0] ? scores[0].id : null;
  if(scores.length===2 && scores[0].score===scores[1].score) winner = 'TIE';
  await safeSet('state', {...state, phase:'reveal_winner', winner, finalWinnerScoreSnapshot:scores}, true);
  await refresh();
}
async function adminDeclareWinnerManually(id){
  const finalists = state.finalists || [];
  const scores = finalists.map(fid=>({id:fid, score: roundScore(fid,'final')}));
  await safeSet('state', {...state, phase:'reveal_winner', winner:id, finalWinnerScoreSnapshot:scores}, true);
  await refresh();
}
async function adminToggleStandings(){
  await safeSet('state', {...state, standingsVisible: !state.standingsVisible}, true);
  await refresh();
}
async function adminSetupStandingsReveal(){
  const ids = Object.keys(teams);
  const order = ids.map(id=>({id, score: totalScore(id)})).sort((a,b)=>a.score-b.score).map(r=>r.id);
  await safeSet('state', {...state, standingsReveal:{order, revealedCount:0}}, true);
  await refresh();
}
async function adminMoveStandingsRevealOrder(index, direction){
  const order = [...state.standingsReveal.order];
  const target = index + direction;
  if(target<0 || target>=order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  const next = {...state, standingsReveal:{...state.standingsReveal, order}};
  await withUndo('Ordine classifica modificato', 'state', state, next);
}
async function adminRevealNextStanding(){
  const sr = state.standingsReveal;
  const revealedCount = Math.min(sr.order.length, sr.revealedCount+1);
  const next = {...state, standingsReveal:{...sr, revealedCount}};
  await withUndo('Rivelata posizione classifica', 'state', state, next);
}
async function adminCloseStandingsReveal(){
  await safeSet('state', {...state, standingsReveal:null}, true);
  await refresh();
}
async function adminSetScoringDefaults(values){
  await safeSet('scoringDefaults', values, true);
  await refresh();
}
async function adminSetQuestionScoring(round, idx, values){
  const key = qkey(round, idx);
  const overrides = {...(state.scoringOverrides||{}), [key]: values};
  await safeSet('state', {...state, scoringOverrides: overrides}, true);
  await refresh();
}
async function adminResetGame(){
  const teamKeys = await safeList('teaminfo:', true);
  for(const k of teamKeys) await safeDelete(k, true);
  const ids = Object.keys(teams);
  for(const id of ids){ await safeDelete('answers:'+id, true); await safeDelete('overrides:'+id, true); }
  await safeDelete('presence', true);
  await safeSet('state', defaultState(), true);
  await refresh();
}

/* ================== AZIONI ADMIN · MODALITÀ PARTY ================== */
async function adminSetPartyMode(mode){
  await safeSet('state', {...state, partyMode: mode}, true);
  await refresh();
}
async function adminMarkPartySlot(slot){
  const card = drawRandomPartyCard();
  if(!card){ alert('Il mazzo attivo non ha carte disponibili.'); return; }
  const forQuestion = (state.phase==='question' || state.phase==='closed') ? qkey(state.round, state.qIndex) : null;
  const party = {...(state.party||{}), [slot]: {card, confirmed:false, revealed:false, revealNonce:null, revealedAt:null, forQuestion}};
  await safeSet('state', {...state, party}, true);
  partyPopupSlot = slot;
  partyManualListOpen = false;
  await refresh();
}
async function adminStartSurprise(){
  const card = drawRandomPartyCard();
  if(!card){ alert('Il mazzo attivo non ha carte disponibili.'); return; }
  const party = {...(state.party||{}), surprise: {card, confirmed:false, revealed:false, revealNonce:null, revealedAt:null, forQuestion:null}};
  await safeSet('state', {...state, party}, true);
  partyPopupSlot = 'surprise';
  partyManualListOpen = false;
  await refresh();
}
async function adminRedrawPartyCard(slot){
  const current = state.party && state.party[slot];
  if(!current) return;
  const card = drawRandomPartyCard(current.card && current.card.id);
  if(!card){ alert("Non c'è un'altra carta disponibile nel mazzo."); return; }
  const party = {...state.party, [slot]: {...current, card, confirmed:false}};
  await safeSet('state', {...state, party}, true);
  partyManualListOpen = false;
  await refresh();
}
async function adminPickPartyCardManually(slot, cardId){
  const current = state.party && state.party[slot];
  const card = activePartyDeck().find(c=>c.id===cardId);
  if(!card) return;
  const party = {...(state.party||{}), [slot]: {...current, card, confirmed:true}};
  await safeSet('state', {...state, party}, true);
  partyPopupSlot = null;
  partyManualListOpen = false;
  await refresh();
}
async function adminConfirmPartyCard(slot){
  const current = state.party && state.party[slot];
  if(!current) return;
  const party = {...state.party, [slot]: {...current, confirmed:true}};
  await safeSet('state', {...state, party}, true);
  partyPopupSlot = null;
  partyManualListOpen = false;
  await refresh();
}
async function adminRevealPartyCard(slot){
  const current = state.party && state.party[slot];
  if(!current || !current.confirmed) return;
  const party = {...state.party, [slot]: {...current, revealed:true, revealNonce:Math.random().toString(36).slice(2), revealedAt:Date.now()}};
  await safeSet('state', {...state, party}, true);
  await refresh();
}
async function adminClearPartySlot(slot){
  const party = {...(state.party||{}), [slot]: null};
  await safeSet('state', {...state, party}, true);
  await refresh();
}

async function adminRemoveTeam(id){
  const before = teams[id];
  if(!before) return;
  await withUndo('Squadra rimossa: '+before.name, 'teaminfo:'+id, before, null);
}

/* ================== AZIONI SQUADRA ================== */
async function findTeamByName(name){
  const teamKeys = await safeList('teaminfo:', true);
  for(const k of teamKeys){
    const t = await safeGet(k, true);
    if(t && t.name && t.name.trim().toLowerCase() === name.trim().toLowerCase()) return t;
  }
  return null;
}
// Una squadra che rientra con lo stesso nome non è mai considerata "in ritardo"
// (è una riconnessione, non un nuovo ingresso): il limite si applica solo alla
// creazione di una squadra che prima non esisteva.
function lateJoinAllowed(gameState){
  if(!gameState || gameState.phase==='lobby') return true;
  const policy = (gameState.config && gameState.config.lateJoin && gameState.config.lateJoin.policy) || 'until_round1_end';
  if(policy==='always') return true;
  if(policy==='blocked_after_start') return false;
  // 'until_round1_end': consentito per tutta la manche 1 (comprese le sue pause)
  return typeof gameState.round === 'number' && gameState.round===1;
}
async function teamJoin(name){
  const trimmed = name.trim();
  const existing = await findTeamByName(trimmed);
  if(existing){
    teamId = existing.id; teamName = existing.name;
  } else {
    const gameState = await safeGet('state', true);
    if(!lateJoinAllowed(gameState)) throw new Error('LATE_JOIN_BLOCKED');
    teamId = 'team_' + Math.random().toString(36).slice(2,9);
    teamName = trimmed;
    const lateJoin = !(!gameState || gameState.phase==='lobby');
    await safeSet('teaminfo:'+teamId, {id:teamId, name:teamName, joinedAt:Date.now(), lateJoin}, true);
  }
  joined = true;
  setUrlSession('team', teamId);
  saveTeamSession(teamId, teamName);
  startListening();
}
async function teamSetReady(ready){
  const info = teams[teamId] || {id:teamId, name:teamName};
  await safeSet('teaminfo:'+teamId, {...info, ready}, true);
  await refresh();
}

/* ================== SESSIONE (URL + localStorage) ==================
   L'URL mantiene la sessione se ricarichi la pagina; localStorage la
   recupera anche se il browser viene chiuso del tutto (l'URL con i
   parametri va perso, ma il dispositivo è lo stesso). */
const LS_TEAM_KEY = 'quizzettone_team';
const LS_ADMIN_KEY = 'quizzettone_admin_unlocked';
const ADMIN_PIN = '2468'; // cambia questo codice per proteggere l'ingresso admin
function saveTeamSession(id, name){
  try{ localStorage.setItem(LS_TEAM_KEY, JSON.stringify({id, name})); }catch(e){}
}
function loadTeamSession(){
  try{ return JSON.parse(localStorage.getItem(LS_TEAM_KEY)); }catch(e){ return null; }
}
function clearTeamSession(){
  try{ localStorage.removeItem(LS_TEAM_KEY); }catch(e){}
}
function isAdminUnlocked(){
  try{ return localStorage.getItem(LS_ADMIN_KEY)==='1'; }catch(e){ return false; }
}
function setAdminUnlocked(){
  try{ localStorage.setItem(LS_ADMIN_KEY, '1'); }catch(e){}
}
function setUrlSession(r, id){
  const url = new URL(window.location.href);
  url.searchParams.set('role', r);
  if(id) url.searchParams.set('id', id); else url.searchParams.delete('id');
  window.history.replaceState({}, '', url.toString());
}
function clearUrlSession(){
  const url = new URL(window.location.href);
  url.searchParams.delete('role'); url.searchParams.delete('id');
  window.history.replaceState({}, '', url.toString());
}
async function restoreFromUrl(){
  const params = new URLSearchParams(window.location.search);
  const r = params.get('role');
  const id = params.get('id');
  if(r==='admin'){
    if(!isAdminUnlocked()){ renderAdminPinEntry(); return true; }
    role = 'admin';
    startListening();
    return true;
  }
  if(r==='display'){
    role = 'display';
    startListening();
    return true;
  }
  if(r==='team' && id){
    const info = await safeGet('teaminfo:'+id, true);
    if(info){
      role = 'team'; teamId = info.id; teamName = info.name; joined = true;
      saveTeamSession(teamId, teamName);
      startListening();
      return true;
    } else {
      clearUrlSession();
    }
  }
  // Nessuna sessione nell'URL: prova a recuperarla da localStorage
  // (es. il browser è stato chiuso del tutto e poi riaperto).
  const saved = loadTeamSession();
  if(saved && saved.id){
    const info = await safeGet('teaminfo:'+saved.id, true);
    if(info){
      role = 'team'; teamId = info.id; teamName = info.name; joined = true;
      setUrlSession('team', teamId);
      startListening();
      return true;
    } else {
      clearTeamSession();
    }
  }
  // Scorciatoia per il QR/codice breve: ?role=team senza una sessione valida
  // da recuperare porta dritti alla schermata "inserisci nome squadra",
  // saltando la selezione del ruolo.
  if(r==='team'){
    renderTeamJoin();
    return true;
  }
  return false;
}
async function teamSubmitAnswer(round, idx, optionIndex){
  const key = qkey(round, idx);
  const current = await safeGet('answers:'+teamId, true) || {};
  if(current[key]) return; // già risposto
  current[key] = {optionIndex, ts: Date.now()};
  await safeSet('answers:'+teamId, current, true);
  await refresh();
}
