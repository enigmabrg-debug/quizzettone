/* ================== AZIONI ADMIN (scrivono su statePath()) ================== */
// Costruisce il timer per una domanda appena aperta: parte da solo, a meno
// che l'admin abbia scelto l'avvio manuale nelle impostazioni della partita,
// oppure (PL-11) la modalità di presentazione risolta per questa partita
// richieda uno sblocco manuale delle risposte (shared_screen/hybrid): in
// quel caso la domanda si apre sempre 'idle', indipendentemente da
// timerStartMode, finché l'admin non preme "Apri risposte"
// (adminStartTimerManually più sotto sblocca entrambe le cose insieme).
function openQuestionTimer(durationMs, cfg, resolvedModeOverride){
  cfg = cfg || state.config;
  // resolvedModeOverride è usato solo da adminStartGame, l'unico punto in cui
  // presentation.resolvedMode va risolto DA ZERO sulla nuova config invece
  // che riusato da state.presentation (che a inizio funzione contiene ancora
  // il valore della partita precedente, se ce n'è stata una).
  const resolvedMode = resolvedModeOverride || (state && state.presentation && state.presentation.resolvedMode) || resolvePresentationMode(cfg);
  const forcedIdle = answerUnlockPolicyFor(resolvedMode) === 'manual';
  const manual = forcedIdle || (cfg && cfg.timerStartMode === 'manual');
  return manual
    ? {status:'idle', startedAt:null, durationMs, pausedRemainingMs:null, closeReason:null, closedBy:null}
    : {status:'running', startedAt:serverNow(), durationMs, pausedRemainingMs:null, closeReason:null, closedBy:null};
}
/* Apre una domanda scrivendo insieme, in un solo update() atomico, lo stato
   (fase/indice/timer/ecc., passati in stateFields) e lo scoringSnapshot
   congelato sull'istanza della nuova domanda corrente (PL-10): da qui in
   avanti, una modifica successiva alla config di scoring non può più
   alterare il punteggio già risolto per questa domanda. PL-11: stessa
   scrittura atomica registra anche presentedAt (sempre) e, se il timer
   costruito da stateFields.timer è già 'running' (sblocco immediato),
   inputUnlockedAt/timerStartedAt allo stesso istante; azzera inoltre
   presentation.fallbackActive, che riguarda solo la domanda precedente. */
async function openQuestionWithSnapshot(round, idx, stateFields){
  const snapshot = computeEffectiveScoringForOpen(round);
  let newGameQuestions = withScoringSnapshotApplied(gameQuestions, round, idx, snapshot);
  const presentedAt = serverNow();
  const tsFields = {presentedAt};
  const timer = stateFields.timer;
  if(timer && timer.status==='running'){
    tsFields.inputUnlockedAt = presentedAt;
    tsFields.timerStartedAt = presentedAt;
  }
  newGameQuestions = withPresentationTimestampsApplied(newGameQuestions, round, idx, tsFields);
  await db.ref(DB_ROOT).update({
    [statePath()]: {...state, ...stateFields, presentation: {...(state.presentation||{}), fallbackActive:false}},
    [questionInstancesPath()]: newGameQuestions
  });
}
/* Storico minimo + "annulla ultima azione": salva uno snapshot del path
   PRIMA della modifica, poi scrive la modifica stessa. 'path' === statePath()
   viene scritto in un'unica operazione insieme al nuovo 'history' (altrimenti
   due safeSet(statePath(), ...) sequenziali basati sullo stesso 'state' locale si
   sovrascriverebbero a vicenda, come nel bug di adminSaveSetup); per path
   diversi da statePath() (es. scoreLedgerPath(id), teamPath(id)) le due scritture
   sono su nodi indipendenti e non hanno questo rischio.

   'before' viaggia come stringa JSON (beforeJson) invece che come oggetto
   annidato: Firebase "pota" silenziosamente le proprietà annidate il cui
   valore è {} (es. una squadra senza ancora nessun punteggio manuale), quindi
   uno snapshot vuoto sparirebbe dalla scrittura di statePath() senza errori,
   rendendo l'undo successivo un no-op. Una stringa non va mai incontro a
   questa potatura, qualunque sia la forma del valore che rappresenta. */
async function withUndo(label, path, before, next){
  const log = [...((state.history && state.history.log)||[]).slice(-29), {type:'action', label, at:Date.now()}];
  const history = {last:{label, path, beforeJson: JSON.stringify(before===undefined?null:before), at:Date.now()}, log};
  let ok;
  if(path===statePath()){
    ok = await safeSet(statePath(), {...next, history}, true);
  } else {
    ok = await safeSet(statePath(), {...state, history}, true);
    if(ok) ok = await safeSet(path, next===undefined?null:next, true);
  }
  if(!ok){
    showErrorBanner('Operazione non riuscita ("'+label+'"): controlla la connessione e riprova.', ()=>withUndo(label, path, before, next));
    return false;
  }
  await refresh();
  return true;
}
async function adminUndoLast(){
  const last = state.history && state.history.last;
  if(!last) return;
  const before = JSON.parse(last.beforeJson);
  await safeSet(last.path, before, true); // ripristina il valore precedente
  const restored = await safeGet(statePath(), true); // se last.path===statePath(), il ripristino ha già cambiato anche history
  const priorLog = (restored && restored.history && restored.history.log) || [];
  const log = [...priorLog.slice(-29), {type:'undo', label:'Annullato: '+last.label, at:Date.now()}];
  // 'last' va pulito DOPO il ripristino, con una scrittura separata: garantisce
  // un solo livello di undo invece di annullamenti a catena.
  await safeSet(stateHistoryPath(), {last:null, log}, true);
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
  // PL-11 (item 4): resolvedMode va risolto DA ZERO su questa cfg, non
  // riusato da un'eventuale partita precedente (vedi nota in openQuestionTimer).
  const resolvedMode = resolvePresentationMode(cfg);
  const timer = openQuestionTimer(cfg.questionDurationMs, cfg, resolvedMode);
  // Riparte da defaultState() per azzerare i progressi della partita precedente,
  // ma preserva le regole/impostazioni scelte in lobby (config, nome partita,
  // Modalità Party) e blocca ulteriori modifiche alla configurazione.
  const s = {
    ...defaultState(),
    config: cfg,
    gameName: (state && state.gameName) || defaultState().gameName,
    setupLocked: true,
    joinCode: (state && state.joinCode) || null,
    gameId: 'game_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
    testMode: !!(state && state.testMode),
    partyMode: (state && state.partyMode) || 'none',
    party: (state && state.party) || defaultState().party,
    phase:'question', round:1, qIndex:0,
    timer,
    presentation: {resolvedMode, fallbackActive:false},
    audioCue: audioCueForQuestion(drawn[0])
  };
  // state e questionInstances sono rami separati (PL-09): scritti insieme in
  // un solo update() atomico, così non c'è mai un istante in cui l'uno è già
  // aggiornato e l'altro no. La prima domanda (manche 1, indice 0) riceve già
  // il suo scoringSnapshot (PL-10), calcolato su 'cfg' esplicitamente perché
  // qui 'state' locale non riflette ancora la config appena scelta. PL-11:
  // riceve anche presentedAt (sempre) e, se lo sblocco è immediato,
  // inputUnlockedAt/timerStartedAt allo stesso istante.
  const presentedAt = serverNow();
  const tsFields = timer.status==='running' ? {presentedAt, inputUnlockedAt:presentedAt, timerStartedAt:presentedAt} : {presentedAt};
  const initialGameQuestions = withPresentationTimestampsApplied(
    withScoringSnapshotApplied({ rounds, final:null, tiebreak:null }, 1, 0, computeEffectiveScoringForOpen(1, cfg)),
    1, 0, tsFields
  );
  let ok = true;
  try{
    await db.ref(DB_ROOT).update({
      [statePath()]: s,
      [questionInstancesPath()]: initialGameQuestions
    });
  } catch(e){ ok = false; }
  if(!ok){
    showErrorBanner('Avvio partita non riuscito: controlla la connessione e riprova.', adminStartGame);
    return;
  }
  await refresh();
}
async function adminSaveSetup(gameName, patch){
  if(state.setupLocked) return;
  // Un'unica scrittura atomica: nome partita e config vanno salvati insieme,
  // altrimenti due safeSet(statePath(), ...) sequenziali (ciascuno basato sullo
  // stesso 'state' locale non ancora aggiornato dall'eco del primo) si
  // sovrascriverebbero a vicenda perdendo parte delle modifiche.
  const nextConfig = {...state.config, ...patch};
  if(patch.scoring) nextConfig.scoring = {...state.config.scoring, ...patch.scoring};
  if(patch.tiebreakRule) nextConfig.tiebreakRule = {...state.config.tiebreakRule, ...patch.tiebreakRule};
  if(patch.lateJoin) nextConfig.lateJoin = {...state.config.lateJoin, ...patch.lateJoin};
  nextConfig.version = (state.config.version || 0) + 1;
  const ok = await safeSet(statePath(), {...state, gameName, config:nextConfig}, true);
  if(!ok){
    showErrorBanner('Salvataggio impostazioni non riuscito: controlla la connessione e riprova.', ()=>adminSaveSetup(gameName, patch));
    return;
  }
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
  const stateRef = db.ref(DB_ROOT + '/' + statePath());
  await stateRef.transaction(current=>{
    if(!current) return current;
    if(current.phase !== 'question') return; // già chiusa/avanzata da qualcun altro
    if(!current.timer || current.timer.status !== 'running') return;
    if(reason==='expired'){
      const {startedAt, durationMs} = current.timer;
      if(!startedAt || (serverNow()-startedAt) < durationMs) return; // non ancora scaduta davvero
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
  await safeSet(statePath(), {...state, phase:'question', timer:{...state.timer, status:'running', startedAt:serverNow(), durationMs:10000, closeReason:null, closedBy:null}}, true);
  await refresh();
}
async function adminCancelQuestion(){
  if(state.phase!=='question' && state.phase!=='closed') return;
  const key = qkey(state.round, state.qIndex);
  const cancelledQuestions = [...(state.cancelledQuestions||[]), key];
  const next = {...state, phase:'closed', cancelledQuestions, timer:{...state.timer, status:'closed', closeReason:'cancelled', closedBy:'admin'}};
  await withUndo('Domanda annullata', statePath(), state, next);
}
/* Sblocca l'input e fa partire il timer nello stesso istante (PL-11, item
   5): serve sia al vecchio "▶ Avvia timer" (config.timerStartMode='manual')
   sia al nuovo "🔓 Apri risposte" per lo schermo condiviso
   (answerUnlockPolicyFor==='manual') — è lo stesso identico meccanismo,
   forzato 'idle' all'apertura da openQuestionTimer in entrambi i casi, quindi
   non serve una seconda azione dedicata. Scrive anche inputUnlockedAt/
   timerStartedAt sull'istanza della domanda corrente, insieme allo stato,
   in un solo update() atomico. */
async function adminStartTimerManually(){
  if(state.phase!=='question' || state.timer.status!=='idle') return;
  const now = serverNow();
  const newGameQuestions = withPresentationTimestampsApplied(gameQuestions, state.round, state.qIndex, {inputUnlockedAt:now, timerStartedAt:now});
  await db.ref(DB_ROOT).update({
    [statePath()]: {...state, timer:{...state.timer, status:'running', startedAt:now}},
    [questionInstancesPath()]: newGameQuestions
  });
  await refresh();
}
/* PL-11 (item 7): fallback manuale per SOLO la domanda corrente ("Mostra
   domanda sui telefoni"): se lo schermo condiviso non funziona, l'admin
   sceglie di mostrare comunque la domanda sui telefoni delle squadre invece
   di aspettare "Apri risposte". Nessun fallback automatico: è sempre e solo
   una scelta esplicita dell'admin, e riguarda solo com'è mostrata la
   domanda lato squadra (vedi renderTeamQuestion) — non sblocca da sola
   l'input, che resta comunque governato da timer.status. */
async function adminActivateTeamFallback(){
  if(state.phase!=='question') return;
  await safeSet(statePath(), {...state, presentation:{...(state.presentation||{}), fallbackActive:true}}, true);
  await refresh();
}
async function adminPauseTimer(){
  if(state.phase!=='question' || state.timer.status!=='running') return;
  await safeSet(statePath(), {...state, timer:{...state.timer, status:'paused', pausedRemainingMs:timeRemaining()}}, true);
  await refresh();
}
async function adminResumeTimer(){
  if(state.phase!=='question' || state.timer.status!=='paused') return;
  const remaining = state.timer.pausedRemainingMs || 0;
  await safeSet(statePath(), {...state, timer:{...state.timer, status:'running', startedAt: serverNow()-(state.timer.durationMs-remaining), pausedRemainingMs:null}}, true);
  await refresh();
}
async function adminAdjustTimer(deltaMs){
  if(state.phase!=='question') return;
  const t = state.timer;
  if(t.status==='paused'){
    await safeSet(statePath(), {...state, timer:{...t, pausedRemainingMs:Math.max(0, (t.pausedRemainingMs||0)+deltaMs)}}, true);
  } else if(t.status==='running'){
    const newDuration = Math.max(serverNow()-t.startedAt, t.durationMs+deltaMs);
    await safeSet(statePath(), {...state, timer:{...t, durationMs:newDuration}}, true);
  } else {
    return;
  }
  await refresh();
}
async function adminRevealSolution(){
  await safeSet(statePath(), {...state, solutionRevealed:true}, true); await refresh();
}
async function adminReplayCurrentAudio(){
  const q = getQuestion(state.round, state.qIndex);
  const cue = audioCueForQuestion(q);
  if(cue) await safeSet(statePath(), {...state, audioCue:cue}, true);
  await refresh();
}
async function adminStopAudio(){
  const cue = state.audioCue;
  if(!cue) return;
  const el = document.getElementById('gameAudioEl');
  const pos = el ? el.currentTime : 0;
  await safeSet(statePath(), {...state, audioCue:{...cue, action:'stop', startAt:pos, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}}, true);
  await refresh();
}
async function adminResumeAudio(fromStart){
  const cue = state.audioCue;
  if(!cue) return;
  await safeSet(statePath(), {...state, audioCue:{...cue, action:'play', startAt: fromStart ? 0 : (cue.startAt||0), triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}}, true);
  await refresh();
}
async function adminAdjustPoints(id, round, idx, delta){
  const key = qkey(round, idx);
  const current = teamPointsForQuestion(id, round, idx);
  const before = {...(overridesByTeam[id]||{})};
  const next = {...before, [key]: current+delta};
  const label = 'Punti '+(teams[id]?teams[id].name:id)+' '+(delta>0?'+':'')+delta;
  await withUndo(label, scoreLedgerPath(id), before, next);
}
async function adminNextQuestion(){
  const round = state.round, idx = state.qIndex;
  const list = getList(round);
  const qNumber = idx+1;
  if(typeof round === 'number'){
    const midPoint = Math.ceil(list.length/2);
    const checkpointMinQuestions = (state.config && state.config.checkpointMinQuestions) || 4;
    if(list.length>=checkpointMinQuestions && qNumber===midPoint){
      await safeSet(statePath(), {...state, phase:'checkpoint', checkpoint:{type:'mid', round}, checkpointMode:null}, true);
    } else if(qNumber===list.length){
      await safeSet(statePath(), {...state, phase:'checkpoint', checkpoint:{type:'end', round}, checkpointMode:null}, true);
    } else {
      await openQuestionWithSnapshot(round, idx+1, {qIndex:idx+1, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, audioCue:audioCueForQuestion(list[idx+1])});
    }
  } else if(round==='final'){
    if(qNumber===list.length){
      await safeSet(statePath(), {...state, phase:'final_ready'}, true);
    } else {
      await openQuestionWithSnapshot('final', idx+1, {qIndex:idx+1, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, audioCue:audioCueForQuestion(list[idx+1])});
    }
  } else if(round==='tiebreak'){
    await safeSet(statePath(), {...state, phase:'tiebreak_closed'}, true);
  }
  await refresh();
}
async function adminSetCheckpointMode(mode){
  await withUndo('Modalità checkpoint: '+mode, statePath(), state, {...state, checkpointMode:mode});
}
async function adminContinueFromCheckpoint(){
  const cp = state.checkpoint;
  const totalRounds = (state.config && state.config.rounds) || 2;
  if(cp.type==='mid'){
    const nextQ = getQuestion(cp.round, state.qIndex+1);
    await openQuestionWithSnapshot(cp.round, state.qIndex+1, {qIndex:state.qIndex+1, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(nextQ)});
  } else if(cp.type==='end' && cp.round < totalRounds){
    const nextRound = cp.round+1;
    const nextQ = getQuestion(nextRound, 0);
    await openQuestionWithSnapshot(nextRound, 0, {round:nextRound, qIndex:0, phase:'question', timer:openQuestionTimer(state.config.questionDurationMs), solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(nextQ)});
  }
  await refresh();
}
async function adminRevealFinalists(){
  const finalistCount = (state.config && state.config.finalistCount) || 2;
  const tiebreakCandidateCount = (state.config && state.config.tiebreakCandidateCount) || 5;
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score:qualificationScore(id)})).sort((a,b)=>b.score-a.score);
  if(ranked.length<=finalistCount){
    await safeSet(statePath(), {...state, phase:'reveal_finalists', finalists:ranked.map(r=>r.id), eliminated:[]}, true);
    await refresh(); return;
  }
  const cutoffScore = ranked[finalistCount-1].score;
  const tiedAtCutoff = ranked.filter(r=>r.score===cutoffScore);
  const aboveCutoff = ranked.filter(r=>r.score>cutoffScore);
  if(tiedAtCutoff.length>1 && aboveCutoff.length<finalistCount){
    // il taglio cade su un pari merito: chi è sopra il taglio è già qualificato,
    // gli spareggianti si giocano i posti rimasti
    const candidateQuestions = drawQuestionsForGame('finale', tiebreakCandidateCount);
    await safeSet(statePath(), {...state, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar: aboveCutoff.map(r=>r.id), candidates: tiedAtCutoff.map(r=>r.id), candidateQuestions, question:null, qIndex:null}}, true);
  } else {
    await safeSet(statePath(), {...state, phase:'reveal_finalists', finalists: ranked.slice(0,finalistCount).map(r=>r.id), eliminated: ranked.slice(finalistCount).map(r=>r.id)}, true);
  }
  await refresh();
}
async function adminStartTiebreakQuestion(qIdx){
  const chosen = state.tiebreak.candidateQuestions[qIdx];
  await markQuestionsUsed([chosen]);
  const tb = {...state.tiebreak, question: chosen, qIndex:qIdx};
  const timer = openQuestionTimer(state.config.questionDurationMs);
  const s = {...state, round:'tiebreak', qIndex:0, phase:'question', timer, solutionRevealed:false, tiebreak: tb, audioCue:audioCueForQuestion(chosen), presentation:{...(state.presentation||{}), fallbackActive:false}};
  const gqWithTiebreak = {...gameQuestions, tiebreak: chosen};
  const snapshot = computeEffectiveScoringForOpen('tiebreak');
  const presentedAt = serverNow();
  const tsFields = timer.status==='running' ? {presentedAt, inputUnlockedAt:presentedAt, timerStartedAt:presentedAt} : {presentedAt};
  const newGameQuestions = withPresentationTimestampsApplied(
    withScoringSnapshotApplied(gqWithTiebreak, 'tiebreak', 0, snapshot), 'tiebreak', 0, tsFields
  );
  await db.ref(DB_ROOT).update({
    [statePath()]: s,
    [questionInstancesPath()]: newGameQuestions
  });
  await refresh();
}
/* Snapshot di sola lettura persistito a fine partita, sopravvive a un reset o
   a una rivincita (rimane raggiungibile via statsHistory/<gameId>, che resta
   un ramo globale: deve sopravvivere anche a un reset della sessione). */
async function persistFinalStatsSnapshot(){
  if(!state.gameId) return;
  const stats = computeFinalStats();
  if(stats) await safeSet('statsHistory/'+state.gameId, stats, true);
}
async function adminAssignTiebreakWinner(winnerId){
  if(state.tiebreak.forFinal){
    await safeSet(statePath(), {...state, phase:'reveal_winner', winner:winnerId, finalWinnerScoreSnapshot: state.tiebreak.finalScoresSnapshot||[], tiebreak:null}, true);
    await refresh();
    await persistFinalStatsSnapshot();
    return;
  }
  const finalistCount = (state.config && state.config.finalistCount) || 2;
  const finalists = [...state.tiebreak.qualifiedSoFar, winnerId].slice(0,finalistCount);
  const eliminated = Object.keys(teams).filter(id=>!finalists.includes(id));
  await safeSet(statePath(), {...state, phase:'reveal_finalists', finalists, eliminated, checkpoint:null, tiebreak:null}, true);
  await refresh();
}
async function adminContinueToFinal(){
  const finalQuestionCount = (state.config && state.config.finalQuestionCount) || 10;
  const drawn = drawQuestionsForGame('finale', finalQuestionCount);
  await markQuestionsUsed(drawn);
  const timer = openQuestionTimer(state.config.questionDurationMs);
  const s = {...state, round:'final', qIndex:0, phase:'question', timer, solutionRevealed:false, checkpoint:null, checkpointMode:null, audioCue:audioCueForQuestion(drawn[0]), presentation:{...(state.presentation||{}), fallbackActive:false}};
  const gqWithFinal = {...gameQuestions, final:drawn};
  const snapshot = computeEffectiveScoringForOpen('final');
  const presentedAt = serverNow();
  const tsFields = timer.status==='running' ? {presentedAt, inputUnlockedAt:presentedAt, timerStartedAt:presentedAt} : {presentedAt};
  const newGameQuestions = withPresentationTimestampsApplied(
    withScoringSnapshotApplied(gqWithFinal, 'final', 0, snapshot), 'final', 0, tsFields
  );
  await db.ref(DB_ROOT).update({
    [statePath()]: s,
    [questionInstancesPath()]: newGameQuestions
  });
  await refresh();
}
async function adminRevealWinner(){
  const finalists = state.finalists || [];
  const scores = finalists.map(id=>({id, score: roundScore(id,'final')})).sort((a,b)=>b.score-a.score);
  const topScore = scores.length ? scores[0].score : 0;
  const tiedTop = scores.filter(s=>s.score===topScore);
  if(tiedTop.length>1){
    // Pareggio per il primo posto in finale: stesso meccanismo di spareggio
    // usato per l'accesso in finale, non solo un flag 'TIE' con scelta libera.
    const tiebreakCandidateCount = (state.config && state.config.tiebreakCandidateCount) || 5;
    const candidateQuestions = drawQuestionsForGame('finale', tiebreakCandidateCount);
    await safeSet(statePath(), {...state, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar:[], candidates: tiedTop.map(s=>s.id), candidateQuestions, question:null, qIndex:null, forFinal:true, finalScoresSnapshot:scores}}, true);
    await refresh();
    return;
  }
  const winner = scores[0] ? scores[0].id : null;
  await safeSet(statePath(), {...state, phase:'reveal_winner', winner, finalWinnerScoreSnapshot:scores}, true);
  await refresh();
  await persistFinalStatsSnapshot();
}
async function adminToggleStandings(){
  await safeSet(statePath(), {...state, standingsVisible: !state.standingsVisible}, true);
  await refresh();
}
// Ordine di rivelazione calcolato dal sistema (mai scelto a mano dall'admin):
// dall'ultima posizione verso la prima, con i pari merito raggruppati in
// un'unica fascia rivelata insieme in un solo passo.
function computeStandingsRevealOrder(){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score: totalScore(id)})).sort((a,b)=>a.score-b.score);
  const groups = [];
  for(const r of ranked){
    const last = groups[groups.length-1];
    if(last && last.score===r.score) last.ids.push(r.id);
    else groups.push({score:r.score, ids:[r.id]});
  }
  return groups.map(g=>g.ids);
}
async function adminSetupStandingsReveal(){
  const order = computeStandingsRevealOrder();
  await safeSet(statePath(), {...state, standingsReveal:{order, revealedCount:0, speed:'normal', autoPlaying:false}}, true);
  await refresh();
}
async function adminRevealNextStanding(){
  const sr = state.standingsReveal;
  const revealedCount = Math.min(sr.order.length, sr.revealedCount+1);
  const next = {...state, standingsReveal:{...sr, revealedCount}};
  await withUndo('Rivelata posizione classifica', statePath(), state, next);
}
async function adminSkipToFullStandingsReveal(){
  const sr = state.standingsReveal;
  const next = {...state, standingsReveal:{...sr, revealedCount:sr.order.length, autoPlaying:false}};
  await withUndo('Classifica rivelata per intero', statePath(), state, next);
}
async function adminSetStandingsRevealSpeed(speed){
  await safeSet(statePath(), {...state, standingsReveal:{...state.standingsReveal, speed}}, true);
  await refresh();
}
async function adminToggleAutoPlayReveal(){
  const sr = state.standingsReveal;
  await safeSet(statePath(), {...state, standingsReveal:{...sr, autoPlaying:!sr.autoPlaying}}, true);
  await refresh();
}
async function adminCloseStandingsReveal(){
  await safeSet(statePath(), {...state, standingsReveal:null}, true);
  await refresh();
}
async function adminSetScoringDefaults(values){
  await safeSet('scoringDefaults', values, true);
  await refresh();
}
async function adminSetQuestionScoring(round, idx, values){
  const key = qkey(round, idx);
  const overrides = {...(state.scoringOverrides||{}), [key]: values};
  await safeSet(statePath(), {...state, scoringOverrides: overrides}, true);
  await refresh();
}
async function adminResetGame(){
  const ids = Object.keys(teams);
  for(const id of ids){
    await safeDelete(teamPath(id), true);
    await safeDelete(answersPath(id), true);
    await safeDelete(scoreLedgerPath(id), true);
    await safeDelete(teamNamePath(teamNameKey(teams[id].name)), true);
  }
  await safeDelete(sessionPath('presence'), true);
  await safeDelete(sessionPath('teamNames'), true); // pulizia extra di eventuali indici orfani
  const ok = await safeSet(statePath(), defaultState(), true);
  await safeSet(questionInstancesPath(), null, true);
  if(!ok){
    showErrorBanner('Reset non completato: lo stato condiviso potrebbe essere rimasto incoerente. Riprova o ricarica la pagina.', adminResetGame);
    return;
  }
  await refresh();
}

/* ================== AZIONI ADMIN · MODALITÀ PROVA ==================
   Squadre fittizie taggate isTest:true, sempre escluse dalle statistiche
   reali (vedi realTeamIds() in state.js) e dal podio finale. L'admin le
   aggiunge in Sala pre-partita e poi avvia una partita di prova esattamente
   come farebbe con quella vera, per collaudare timer/audio/display; "Reset
   partita" le rimuove insieme a tutto il resto prima della serata vera. */
async function adminToggleTestMode(){
  await safeSet(statePath(), {...state, testMode: !state.testMode}, true);
  await refresh();
}
function newTestTeamId(){ return 'test_' + Math.random().toString(36).slice(2,10); }
async function adminAddTestTeams(count){
  const existingCount = Object.values(teams).filter(t=>t.isTest).length;
  const writes = [];
  for(let i=1; i<=count; i++){
    const id = newTestTeamId();
    writes.push(safeSet(teamPath(id), {id, name:'Squadra prova '+(existingCount+i), joinedAt:Date.now(), isTest:true, ready:true}, true));
  }
  await Promise.all(writes);
  await refresh();
}
async function adminRemoveTestTeams(){
  const ids = Object.keys(teams).filter(id=>teams[id].isTest);
  for(const id of ids){
    await safeDelete(teamPath(id), true);
    await safeDelete(answersPath(id), true);
    await safeDelete(scoreLedgerPath(id), true);
  }
  await refresh();
}
/* Simula la risposta di una squadra fittizia: stessa forma di teamSubmitAnswer,
   ma parametrizzata sull'id (il client admin non ha una propria identità
   squadra) e senza il controllo "eliminata in finale", perché le squadre
   prova non arrivano mai in finale nell'uso previsto di questa modalità. */
async function adminSubmitTestAnswer(id, round, idx, optionIndex){
  const key = qkey(round, idx);
  const ts = serverNow();
  const answer = {optionIndex, ts, speedBonus: computeSpeedBonusAtSubmission(ts)};
  try{
    await db.ref(DB_ROOT + '/' + answersPath(id)).child(key).transaction(current => current ? undefined : answer);
  } catch(e){ console.error('invio risposta prova fallito', e); }
  await refresh();
}
// qkey => Set di id già "tentati" in questo giro di domanda, per non ritentare
// la stessa squadra a ogni tick da 250ms una volta che ha già risposto o è
// stata scartata dal lancio dei dadi.
let testAnswerAttempted = {};
async function simulateTestTeamAnswers(){
  if(!state || state.phase!=='question' || !state.testMode) return;
  const key = qkey(state.round, state.qIndex);
  const q = getQuestion(state.round, state.qIndex);
  if(!q) return;
  const tried = testAnswerAttempted[key] || (testAnswerAttempted[key] = new Set());
  const testTeamIds = Object.keys(teams).filter(id=>teams[id].isTest);
  for(const id of testTeamIds){
    if(tried.has(id)) continue;
    if(answersByTeam[id] && answersByTeam[id][key]) { tried.add(id); continue; }
    if(Math.random() > 0.08) continue; // ~8% di probabilità per tick: risposte scaglionate nel tempo, non tutte insieme
    tried.add(id);
    const optionIndex = Math.random() < 0.7 ? q.correctIndex : Math.floor(Math.random()*q.options.length);
    await adminSubmitTestAnswer(id, state.round, state.qIndex, optionIndex);
  }
}

/* ================== AZIONI ADMIN · RIVINCITA ==================
   Stesse squadre reali e stessa configurazione, punteggi/risposte azzerati:
   diversa dal Reset partita, che invece cancella anche le squadre. Il codice
   di ingresso resta lo stesso, così le squadre restano collegate senza dover
   rientrare a mano. */
async function adminStartRematch(){
  const cfg = state.config;
  const realIds = Object.keys(teams).filter(id=>!teams[id].isTest);
  for(const id of realIds){ await safeDelete(answersPath(id), true); await safeDelete(scoreLedgerPath(id), true); }
  const s = {
    ...defaultState(),
    config: cfg,
    gameName: state.gameName,
    setupLocked: false,
    joinCode: state.joinCode,
    partyMode: state.partyMode || 'none',
    party: state.party || defaultState().party,
  };
  await safeSet(statePath(), s, true);
  await safeSet(questionInstancesPath(), null, true);
  await refresh();
}

/* ================== AZIONI ADMIN · MODALITÀ PARTY ================== */
async function adminSetPartyMode(mode){
  await safeSet(statePath(), {...state, partyMode: mode}, true);
  await refresh();
}
async function adminMarkPartySlot(slot){
  const card = drawRandomPartyCard();
  if(!card){ alert('Il mazzo attivo non ha carte disponibili.'); return; }
  const forQuestion = (state.phase==='question' || state.phase==='closed') ? qkey(state.round, state.qIndex) : null;
  const party = {...(state.party||{}), [slot]: {card, confirmed:false, revealed:false, revealNonce:null, revealedAt:null, forQuestion}};
  await safeSet(statePath(), {...state, party}, true);
  partyPopupSlot = slot;
  partyManualListOpen = false;
  await refresh();
}
async function adminStartSurprise(){
  const card = drawRandomPartyCard();
  if(!card){ alert('Il mazzo attivo non ha carte disponibili.'); return; }
  const party = {...(state.party||{}), surprise: {card, confirmed:false, revealed:false, revealNonce:null, revealedAt:null, forQuestion:null}};
  await safeSet(statePath(), {...state, party}, true);
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
  await safeSet(statePath(), {...state, party}, true);
  partyManualListOpen = false;
  await refresh();
}
async function adminPickPartyCardManually(slot, cardId){
  const current = state.party && state.party[slot];
  const card = activePartyDeck().find(c=>c.id===cardId);
  if(!card) return;
  const party = {...(state.party||{}), [slot]: {...current, card, confirmed:true}};
  await safeSet(statePath(), {...state, party}, true);
  partyPopupSlot = null;
  partyManualListOpen = false;
  await refresh();
}
async function adminConfirmPartyCard(slot){
  const current = state.party && state.party[slot];
  if(!current) return;
  const party = {...state.party, [slot]: {...current, confirmed:true}};
  await safeSet(statePath(), {...state, party}, true);
  partyPopupSlot = null;
  partyManualListOpen = false;
  await refresh();
}
async function adminRevealPartyCard(slot){
  const current = state.party && state.party[slot];
  if(!current || !current.confirmed) return;
  const party = {...state.party, [slot]: {...current, revealed:true, revealNonce:Math.random().toString(36).slice(2), revealedAt:Date.now()}};
  await safeSet(statePath(), {...state, party}, true);
  await refresh();
}
async function adminClearPartySlot(slot){
  const party = {...(state.party||{}), [slot]: null};
  await safeSet(statePath(), {...state, party}, true);
  await refresh();
}
/* Gestione mazzi Party: aggiunge/rimuove carte da 'normale' o 'extreme'.
   I mazzi vivono come array sotto mazzi/<nome> (vedi ensureSeedPartyDecks),
   ramo globale invariato da PL-09 (persiste tra le partite come questionBank). */
async function adminAddPartyCard(deck, testo, tipo){
  const text = (testo||'').trim();
  if(!text) return;
  const card = {id:newCardId(), testo:text, tipo: tipo||'generica'};
  const current = partyDecks[deck] || [];
  await safeSet('mazzi/'+deck, [...current, card], true);
  await refresh();
}
async function adminDeletePartyCard(deck, cardId){
  const current = partyDecks[deck] || [];
  await safeSet('mazzi/'+deck, current.filter(c=>c.id!==cardId), true);
  await refresh();
}

async function adminRemoveTeam(id){
  const before = teams[id];
  if(!before) return;
  await withUndo('Squadra rimossa: '+before.name, teamPath(id), before, null);
  // Libera il nome nell'indice di unicità (PL-07): altrimenti resterebbe
  // "prenotato" per sempre, impedendo a chiunque di riusarlo, anche dopo che
  // "Annulla ultima azione" ripristina la squadra stessa.
  await safeDelete(teamNamePath(teamNameKey(before.name)), true);
}

/* ================== AZIONI SQUADRA ================== */
/* Chiave stabile e univoca per un nome squadra normalizzato (maiuscole/
   minuscole e spazi ai bordi non contano, come nel confronto usato prima),
   sicura come segmento di percorso Firebase (niente '.', '#', '$', '[', ']',
   che sono vietati nelle chiavi RTDB e non vengono escapati da
   encodeURIComponent). Usata come indice teamNames/<key> -> teamId per
   rendere il join atomico invece di un check-then-act. */
function teamNameKey(name){
  return encodeURIComponent(name.trim().toLowerCase()).replace(/\./g, '%2E');
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
// Il vincitore della transazione su teamNamePath(key) scrive teamPath(id) in
// un secondo passo, non atomico col primo: chi perde la transazione (stesso
// nome, quasi simultaneo) potrebbe leggere l'indice prima che quella
// scrittura sia arrivata. Qualche tentativo con una breve attesa copre
// questa finestra invece di far fallire un join legittimo per un timing
// sfortunato.
async function waitForTeamInfo(id, attempts){
  for(let i=0; i<attempts; i++){
    const info = await safeGet(teamPath(id), true);
    if(info) return info;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return null;
}
/* Join atomico e univoco per nome (FT-08): una transaction() su
   teamNamePath(nome-normalizzato) decide chi "vince" il nome, invece del
   vecchio check-then-act (leggi tutte le squadre, poi crea se non trovi
   corrispondenza) che due join simultanei con lo stesso nome potevano far
   sfuggire. Chi vince crea la squadra; chi perde recupera quella già creata
   dal vincitore ed entra come se fosse una riconnessione. */
async function teamJoin(name){
  const trimmed = name.trim();
  const nameKey = teamNameKey(trimmed);
  const nameIndexRef = db.ref(DB_ROOT + '/' + teamNamePath(nameKey));
  const provisionalTeamId = 'team_' + Math.random().toString(36).slice(2,9);

  let result;
  try{
    result = await nameIndexRef.transaction(current => current ? undefined : provisionalTeamId);
  } catch(e){
    throw new Error('JOIN_FAILED');
  }

  if(result.committed){
    const gameState = await safeGet(statePath(), true);
    if(!lateJoinAllowed(gameState)){
      await nameIndexRef.remove(); // il nome non deve restare "prenotato" se il join viene rifiutato
      throw new Error('LATE_JOIN_BLOCKED');
    }
    const lateJoin = !(!gameState || gameState.phase==='lobby');
    const ok = await safeSet(teamPath(provisionalTeamId), {id:provisionalTeamId, name:trimmed, joinedAt:Date.now(), lateJoin}, true);
    if(!ok){
      await nameIndexRef.remove();
      throw new Error('JOIN_FAILED');
    }
    teamId = provisionalTeamId;
    teamName = trimmed;
  } else {
    const existingId = result.snapshot.val();
    const existing = await waitForTeamInfo(existingId, 5);
    if(!existing) throw new Error('JOIN_FAILED');
    teamId = existing.id;
    teamName = existing.name;
  }

  joined = true;
  setUrlSession('team', teamId);
  saveTeamSession(teamId, teamName);
  startListening();
}
/* Rinomina da Admin: se il nome normalizzato non cambia (solo maiuscole o
   spazi diversi) basta aggiornare teamPath(id); altrimenti va prenotato
   atomicamente il nuovo indice prima di spostare il nome, e liberato quello
   vecchio solo a spostamento riuscito. */
async function adminRenameTeam(id, newName){
  const trimmed = newName.trim();
  if(!trimmed) return;
  const team = teams[id];
  if(!team) return;
  const oldKey = teamNameKey(team.name);
  const newKey = teamNameKey(trimmed);
  if(oldKey === newKey){
    const ok = await safeSet(teamPath(id), {...team, name:trimmed}, true);
    if(!ok) showErrorBanner('Rinomina non riuscita: controlla la connessione e riprova.', ()=>adminRenameTeam(id, newName));
    else await refresh();
    return;
  }
  const newIndexRef = db.ref(DB_ROOT + '/' + teamNamePath(newKey));
  let result;
  try{
    result = await newIndexRef.transaction(current => current ? undefined : id);
  } catch(e){
    showErrorBanner('Rinomina non riuscita: controlla la connessione e riprova.', ()=>adminRenameTeam(id, newName));
    return;
  }
  if(!result.committed){
    showErrorBanner('Esiste già una squadra con questo nome.');
    return;
  }
  const ok = await safeSet(teamPath(id), {...team, name:trimmed}, true);
  if(!ok){
    await newIndexRef.remove();
    showErrorBanner('Rinomina non riuscita: controlla la connessione e riprova.', ()=>adminRenameTeam(id, newName));
    return;
  }
  await safeDelete(teamNamePath(oldKey), true);
  await refresh();
}
async function teamSetReady(ready){
  const info = teams[teamId] || {id:teamId, name:teamName};
  await safeSet(teamPath(teamId), {...info, ready}, true);
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
    const info = await safeGet(teamPath(id), true);
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
    const info = await safeGet(teamPath(saved.id), true);
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
/* Invio atomico: una transaction() sul singolo nodo answersPath(teamId)/<key>
   (non più un read-then-write sull'intero oggetto answersPath(teamId)) fa sì
   che due tocchi ravvicinati, o due tab della stessa squadra che rispondono
   quasi insieme, non possano mai produrre due scritture concorrenti sulla
   stessa domanda: se il valore esiste già quando la transazione gira, la
   callback ritorna undefined e l'SDK annulla la scrittura senza sovrascrivere
   nulla (stesso pattern di closeAnswersTransactional). Ritorna true se, alla
   fine, la risposta risulta salvata (da questa chiamata o da una precedente:
   "già risposto" non è un errore), false solo per un fallimento vero. */
async function teamSubmitAnswer(round, idx, optionIndex){
  // Le squadre eliminate sono spettatrici in finale: l'interfaccia non mostra
  // già i pulsanti di risposta (renderSpectatorFinal), ma il controllo va
  // ripetuto qui perché è la scrittura che conta davvero.
  if(round==='final' && state.finalists && !state.finalists.includes(teamId)) return true;
  const key = qkey(round, idx);
  const ts = serverNow();
  const answer = {optionIndex, ts, speedBonus: computeSpeedBonusAtSubmission(ts)};
  let alreadyAnswered = false;
  let result;
  try{
    result = await db.ref(DB_ROOT + '/' + answersPath(teamId)).child(key).transaction(current => {
      if(current){ alreadyAnswered = true; return; }
      return answer;
    });
  } catch(e){
    console.error('invio risposta fallito', e);
    showErrorBanner('Invio risposta non riuscito: controlla la connessione e riprova.', ()=>teamSubmitAnswer(round, idx, optionIndex));
    return false;
  }
  if(!result.committed && !alreadyAnswered){
    showErrorBanner('Invio risposta non riuscito: controlla la connessione e riprova.', ()=>teamSubmitAnswer(round, idx, optionIndex));
    return false;
  }
  await refresh();
  return true;
}
