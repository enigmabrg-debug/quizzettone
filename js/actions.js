/* ================== AZIONI ADMIN (scrivono su 'state') ================== */
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
  // ma preserva le regole/impostazioni scelte in lobby (config, Modalità Party).
  const s = {
    ...defaultState(),
    config: cfg,
    partyMode: (state && state.partyMode) || 'none',
    party: (state && state.party) || defaultState().party,
    phase:'question', round:1, qIndex:0, questionStartedAt:Date.now(),
    gameQuestions: { rounds, final:null, tiebreak:null },
    audioCue: audioCueForQuestion(drawn[0])
  };
  await safeSet('state', s, true); await refresh();
}
async function adminCloseAnswers(){
  const s = {...state, phase:'closed'};
  await safeSet('state', s, true); await refresh();
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
  const ov = overridesByTeam[id] || {};
  ov[key] = current + delta;
  await safeSet('overrides:'+id, ov, true); await refresh();
}
async function adminNextQuestion(){
  const round = state.round, idx = state.qIndex;
  const list = getList(round);
  const qNumber = idx+1;
  if(typeof round === 'number'){
    const midPoint = Math.ceil(list.length/2);
    if(list.length>=4 && qNumber===midPoint){
      await safeSet('state', {...state, phase:'checkpoint', checkpoint:{type:'mid', round}, checkpointMode:null}, true);
    } else if(qNumber===list.length){
      await safeSet('state', {...state, phase:'checkpoint', checkpoint:{type:'end', round}, checkpointMode:null}, true);
    } else {
      await safeSet('state', {...state, qIndex:idx+1, phase:'question', questionStartedAt:Date.now(), solutionRevealed:false, audioCue:audioCueForQuestion(list[idx+1])}, true);
    }
  } else if(round==='final'){
    if(qNumber===list.length){
      await safeSet('state', {...state, phase:'final_ready'}, true);
    } else {
      await safeSet('state', {...state, qIndex:idx+1, phase:'question', questionStartedAt:Date.now(), solutionRevealed:false, audioCue:audioCueForQuestion(list[idx+1])}, true);
    }
  } else if(round==='tiebreak'){
    await safeSet('state', {...state, phase:'tiebreak_closed'}, true);
  }
  await refresh();
}
async function adminSetCheckpointMode(mode){
  await safeSet('state', {...state, checkpointMode:mode}, true); await refresh();
}
async function adminContinueFromCheckpoint(){
  const cp = state.checkpoint;
  const totalRounds = (state.config && state.config.rounds) || 2;
  if(cp.type==='mid'){
    const nextQ = getQuestion(cp.round, state.qIndex+1);
    await safeSet('state', {...state, qIndex:state.qIndex+1, phase:'question', questionStartedAt:Date.now(), solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(nextQ)}, true);
  } else if(cp.type==='end' && cp.round < totalRounds){
    const nextRound = cp.round+1;
    const nextQ = getQuestion(nextRound, 0);
    await safeSet('state', {...state, round:nextRound, qIndex:0, phase:'question', questionStartedAt:Date.now(), solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(nextQ)}, true);
  }
  await refresh();
}
async function adminRevealFinalists(){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score:qualificationScore(id)})).sort((a,b)=>b.score-a.score);
  if(ranked.length<=2){
    await safeSet('state', {...state, phase:'reveal_finalists', finalists:ranked.map(r=>r.id), eliminated:[]}, true);
    await refresh(); return;
  }
  const secondScore = ranked[1].score;
  const tiedForSecond = ranked.filter(r=>r.score===secondScore);
  if(tiedForSecond.length>1 && ranked[0].score!==secondScore){
    // primo posto chiaro, spareggio per il secondo posto
    const candidateQuestions = drawQuestionsForGame('finale', 5);
    await safeSet('state', {...state, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar:[ranked[0].id], candidates: tiedForSecond.map(r=>r.id), candidateQuestions, question:null, qIndex:null}}, true);
  } else if(ranked[0].score===secondScore){
    // pareggio anche per il primo posto: tutti i pari merito in spareggio, si prendono i primi 2
    const topScore = ranked[0].score;
    const tiedTop = ranked.filter(r=>r.score===topScore).map(r=>r.id);
    const candidateQuestions = drawQuestionsForGame('finale', 5);
    await safeSet('state', {...state, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar:[], candidates: tiedTop, candidateQuestions, question:null, qIndex:null}}, true);
  } else {
    await safeSet('state', {...state, phase:'reveal_finalists', finalists:[ranked[0].id, ranked[1].id], eliminated: ranked.slice(2).map(r=>r.id)}, true);
  }
  await refresh();
}
async function adminStartTiebreakQuestion(qIdx){
  const chosen = state.tiebreak.candidateQuestions[qIdx];
  await markQuestionsUsed([chosen]);
  const tb = {...state.tiebreak, question: chosen, qIndex:qIdx};
  await safeSet('state', {...state, round:'tiebreak', qIndex:0, phase:'question', questionStartedAt:Date.now(), solutionRevealed:false, tiebreak: tb, gameQuestions:{...state.gameQuestions, tiebreak: chosen}, audioCue:audioCueForQuestion(chosen)}, true);
  await refresh();
}
async function adminAssignTiebreakWinner(winnerId){
  const need = 2 - state.tiebreak.qualifiedSoFar.length;
  const finalists = [...state.tiebreak.qualifiedSoFar, winnerId].slice(0,2);
  const eliminated = Object.keys(teams).filter(id=>!finalists.includes(id));
  await safeSet('state', {...state, phase:'reveal_finalists', finalists, eliminated, checkpoint:null}, true);
  await refresh();
}
async function adminContinueToFinal(){
  const drawn = drawQuestionsForGame('finale', 10);
  await markQuestionsUsed(drawn);
  await safeSet('state', {...state, round:'final', qIndex:0, phase:'question', questionStartedAt:Date.now(), solutionRevealed:false, checkpoint:null, checkpointMode:null, gameQuestions:{...state.gameQuestions, final:drawn}, audioCue:audioCueForQuestion(drawn[0])}, true);
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
  await safeSet('state', {...state, standingsReveal:{...state.standingsReveal, order}}, true);
  await refresh();
}
async function adminRevealNextStanding(){
  const sr = state.standingsReveal;
  const revealedCount = Math.min(sr.order.length, sr.revealedCount+1);
  await safeSet('state', {...state, standingsReveal:{...sr, revealedCount}}, true);
  await refresh();
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

/* ================== AZIONI SQUADRA ================== */
async function findTeamByName(name){
  const teamKeys = await safeList('teaminfo:', true);
  for(const k of teamKeys){
    const t = await safeGet(k, true);
    if(t && t.name && t.name.trim().toLowerCase() === name.trim().toLowerCase()) return t;
  }
  return null;
}
async function teamJoin(name){
  const trimmed = name.trim();
  const existing = await findTeamByName(trimmed);
  if(existing){
    teamId = existing.id; teamName = existing.name;
  } else {
    teamId = 'team_' + Math.random().toString(36).slice(2,9);
    teamName = trimmed;
    await safeSet('teaminfo:'+teamId, {id:teamId, name:teamName, joinedAt:Date.now()}, true);
  }
  joined = true;
  setUrlSession('team', teamId);
  saveTeamSession(teamId, teamName);
  startListening();
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
