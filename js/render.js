/* ================== HELPERS UI ================== */
function totalRoundsCount(){ return (state && state.config && state.config.rounds) || 2; }
function letter(i){ return ['A','B','C','D'][i]; }
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function timeRemaining(){
  if(!state || !state.questionStartedAt) return 0;
  const elapsed = Date.now() - state.questionStartedAt;
  return Math.max(0, state.timerDuration - elapsed);
}
function circleTimer(remainingMs, total){
  const pct = Math.max(0, Math.min(1, remainingMs/total));
  const r = 52, c = 2*Math.PI*r;
  const urgent = remainingMs < 6000;
  return `<div class="timer ${urgent?'urgent':''}">
    <svg width="118" height="118" viewBox="0 0 118 118">
      <circle cx="59" cy="59" r="${r}" fill="none" stroke="rgba(245,241,255,.12)" stroke-width="8"/>
      <circle cx="59" cy="59" r="${r}" fill="none" stroke="${urgent?'#FF4D6D':'#F2B705'}" stroke-width="8"
        stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" stroke-linecap="round"/>
    </svg>
    <div class="timer-num">${Math.ceil(remainingMs/1000)}</div>
  </div>`;
}
function rankRows(idsWithScores){
  return idsWithScores.map((r,i)=>`
    <div class="rank-row ${i===0?'top1':i===1?'top2':i===2?'top3':''}">
      <div class="rank-num">${i+1}</div>
      <div class="rank-name">${teams[r.id] ? teams[r.id].name : '—'}</div>
      <div class="rank-score">${r.score} pt</div>
    </div>`).join('');
}
function activeTeamsForRound(round){
  if(round==='final') return state.finalists || Object.keys(teams);
  if(round==='tiebreak') return (state.tiebreak && state.tiebreak.candidates) || [];
  return Object.keys(teams);
}
function connectionBadge(){
  if(connected) return '';
  return `<div class="pill" style="color:var(--pink);border-color:rgba(255,77,109,.4);background:rgba(255,77,109,.1);margin-top:6px;">⚠ Connessione persa, riconnessione in corso…</div>`;
}

/* ================== MODALITÀ PARTY: reveal pubblico (Display) ================== */
function partyCardAnimClass(slot, data){
  // consuma il nonce localmente così l'animazione di reveal parte una volta sola per questo schermo,
  // anche se render() viene richiamato più volte di seguito (es. il tick del timer ogni 250ms)
  if(!data || !data.revealed) return '';
  if(!data.revealNonce || data.revealNonce===lastPartyCardSeen[slot]) return '';
  lastPartyCardSeen[slot] = data.revealNonce;
  return 'party-flip-in';
}
function renderPartyRevealCards(){
  const party = (state && state.party) || {};
  const slots = [['bonus','Bonus'],['malus','Malus'],['surprise','Prova a sorpresa']];
  return slots.filter(([key])=> party[key] && party[key].revealed).map(([key,label])=>{
    const data = party[key];
    const animClass = partyCardAnimClass(key, data);
    return `<div class="card center stack party-card ${key==='malus'?'malus':''} ${animClass}">
      <div class="eyebrow pill gold">${label}</div>
      <h2>${escapeHtml(data.card.testo)}</h2>
    </div>`;
  }).join('');
}

/* ================== AUDIO (cue condiviso via Firebase, suonato solo da admin + Display) ================== */
const AUDIO_CUE_STALE_MS = 8000;
function playPendingAudioCueIfAny(){
  const cue = state && state.audioCue;
  if(!cue || cue.nonce===lastPlayedAudioNonce) return;
  lastPlayedAudioNonce = cue.nonce; // segnato come "visto" comunque, anche se scartato: mai riprovare un cue vecchio
  const el = document.getElementById('gameAudioEl');
  if(!el) return;
  if(cue.action==='stop'){ el.pause(); return; } // uno stop va sempre onorato, anche se il cue è "vecchio"
  if(Date.now() - cue.triggeredAt > AUDIO_CUE_STALE_MS) return; // scheda appena aperta a metà domanda: non sparare audio vecchio
  const seekAndPlay = ()=>{
    try{ el.currentTime = cue.startAt||0; }catch(e){}
    el.play().catch(err=>console.warn('audio bloccato dal browser', err));
  };
  if(el.src !== cue.url){
    el.src = cue.url;
    el.addEventListener('loadedmetadata', seekAndPlay, {once:true});
  } else {
    seekAndPlay();
  }
}
function audioUnlockOverlayHtml(){
  if(audioUnlocked) return '';
  return `<div class="card center stack" id="audioUnlockCard" style="position:fixed;inset:0;z-index:999;justify-content:center;background:rgba(21,12,43,.96);border-radius:0;">
    <h2>🔊 Attiva l'audio</h2>
    <p class="muted">Tocca per abilitare la riproduzione automatica su questo schermo.</p>
    <button class="btn" id="btnUnlockAudio">Attiva</button>
  </div>`;
}
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
function wireAudioUnlockOverlay(){
  const btn = document.getElementById('btnUnlockAudio');
  if(!btn) return;
  btn.onclick = ()=>{
    const el = document.getElementById('gameAudioEl');
    const finish = ()=>{ if(audioUnlocked) return; el.muted=false; audioUnlocked=true; render(); };
    el.muted = true;
    el.src = SILENT_WAV;
    const playPromise = el.play();
    if(playPromise && playPromise.then) playPromise.then(()=>{ el.pause(); finish(); }).catch(finish);
    setTimeout(finish, 1500); // rete di sicurezza se .play() resta in sospeso
  };
}
function renderLiveStandingsCard(){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score: totalScore(id)})).sort((a,b)=>b.score-a.score);
  return `<div class="card center stack final-glow">
    <div class="eyebrow pill gold">Classifica</div>
    <h2>Classifica generale</h2>
    ${rankRows(ranked)}
  </div>`;
}
function renderStandingsRevealScreen(sr){
  const total = sr.order.length;
  const revealed = sr.order.slice(0, sr.revealedCount);
  const rows = revealed.map((id,i)=>{
    const pos = total - i;
    return `<div class="reveal-row">
      <div class="reveal-pos">${pos}°</div>
      <div class="reveal-name">${escapeHtml(teams[id] ? teams[id].name : '—')}</div>
      <div class="reveal-score">${totalScore(id)} pt</div>
    </div>`;
  }).join('');
  return `<div class="card center stack final-glow">
    <div class="eyebrow pill gold">Il momento della verità</div>
    <h2>Classifica</h2>
    <div class="stack">${rows || '<p class="muted">Rullo di tamburi...</p>'}</div>
  </div>`;
}

/* ================== RENDER: SELEZIONE RUOLO ================== */
function renderRoleSelect(){
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `
    <div class="header" style="align-items:center;text-align:center;margin-top:40px;">
      <div class="eyebrow">Party Quiz</div>
      <h1 class="brand">QUIZZETTONE</h1>
    </div>
    <div class="card stack" style="margin-top:20px;">
      <button class="btn" id="btnTeam">Sono una squadra 🎉</button>
      <button class="btn secondary" id="btnAdmin">Sono l'admin 🎛️</button>
    </div>
    <p class="note center">Tieni questa scheda aperta per tutta la partita. Se la chiudi per sbaglio, rientra scegliendo lo stesso nome squadra.</p>
  `;
  document.getElementById('btnTeam').onclick = renderTeamJoin;
  document.getElementById('btnAdmin').onclick = ()=>{
    if(isAdminUnlocked()){ role='admin'; setUrlSession('admin'); startListening(); }
    else renderAdminPinEntry();
  };
}

function renderAdminPinEntry(){
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `
    <div class="header" style="align-items:center;text-align:center;margin-top:40px;">
      <div class="eyebrow">Party Quiz</div>
      <h1 class="brand">QUIZZETTONE</h1>
    </div>
    <div class="card stack" style="margin-top:20px;">
      <h3>Codice admin</h3>
      <input type="text" id="adminPinInput" placeholder="Codice" maxlength="12" inputmode="numeric" autocomplete="off">
      <div id="pinError" class="note" style="color:var(--pink);display:none;">Codice errato, riprova.</div>
      <button class="btn" id="btnPinConfirm">Entra</button>
      <button class="btn ghost small" id="btnPinBack">← Indietro</button>
    </div>
  `;
  document.getElementById('btnPinBack').onclick = renderRoleSelect;
  const input = document.getElementById('adminPinInput');
  input.focus();
  const tryUnlock = ()=>{
    if(input.value === ADMIN_PIN){
      setAdminUnlocked();
      role = 'admin';
      setUrlSession('admin');
      startListening();
    } else {
      document.getElementById('pinError').style.display = 'block';
      input.value = '';
      input.focus();
    }
  };
  document.getElementById('btnPinConfirm').onclick = tryUnlock;
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });
}

function renderTeamJoin(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header" style="align-items:center;text-align:center;margin-top:40px;">
      <div class="eyebrow">Party Quiz</div>
      <h1 class="brand">QUIZZETTONE</h1>
    </div>
    <div class="card stack" style="margin-top:20px;">
      <h3>Nome squadra</h3>
      <input type="text" id="teamNameInput" placeholder="Es. I Fenomeni" maxlength="24">
      <button class="btn" id="btnJoin">Entra in partita</button>
      <button class="btn ghost small" id="btnBack">← Indietro</button>
    </div>
  `;
  document.getElementById('btnBack').onclick = renderRoleSelect;
  const input = document.getElementById('teamNameInput');
  input.focus();
  const doJoin = async ()=>{
    if(!input.value.trim()) return;
    role='team';
    await teamJoin(input.value);
  };
  document.getElementById('btnJoin').onclick = doJoin;
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') doJoin(); });
}

/* ================== RENDER PRINCIPALE ================== */
function render(){
  if(!state) return; // il primo snapshot da Firebase non è ancora arrivato
  if(role==='team' && joined) return renderTeam();
  if(role==='admin') return renderAdmin();
  if(role==='display') return renderDisplay();
}

/* ================== VISTA SQUADRA ================== */
function renderTeam(){
  const app = document.getElementById('app');
  app.className = '';
  const s = state;
  const isFinalist = !s.finalists || s.finalists.includes(teamId);
  const isEliminated = s.eliminated && s.eliminated.includes(teamId);
  const inTiebreak = s.round==='tiebreak';
  const isTiebreakCandidate = inTiebreak && s.tiebreak && s.tiebreak.candidates && s.tiebreak.candidates.includes(teamId);

  let body = '';

  if(s.standingsReveal){
    body = renderStandingsRevealScreen(s.standingsReveal);
  }
  else if(s.standingsVisible){
    body = renderLiveStandingsCard();
  }
  else if(s.phase==='lobby'){
    body = `
      <div class="card center stack">
        <div class="eyebrow">Sei dentro!</div>
        <h2>${teamName}</h2>
        <p class="muted">In attesa che l'admin avvii la Manche 1...</p>
      </div>`;
  }
  else if(s.phase==='question' && !inTiebreak){
    body = renderTeamQuestion(s.round, s.qIndex, true);
  }
  else if(s.phase==='question' && inTiebreak){
    if(isTiebreakCandidate){
      body = renderTeamQuestion('tiebreak', s.qIndex, false, true);
    } else {
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Spareggio in corso</div>
        <h3>Due squadre si giocano l'accesso in finale</h3>
        <p class="muted">Restate collegati, tra poco si continua.</p>
      </div>`;
    }
  }
  else if(s.phase==='closed'){
    body = renderTeamQuestion(s.round, s.qIndex, false);
  }
  else if(s.phase==='tiebreak_closed'){
    body = `<div class="card center stack"><div class="eyebrow pill gold">Spareggio</div><p class="muted">L'admin sta verificando le risposte...</p></div>`;
  }
  else if(s.phase==='checkpoint'){
    const cp = s.checkpoint;
    const totalRounds = totalRoundsCount();
    if(cp.type==='mid'){
      const total = getList(cp.round).length;
      const played = Math.ceil(total/2);
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Checkpoint · Metà Manche ${cp.round}</div>
        <h2>Prendete fiato ☕</h2>
        <p class="muted">${played} domande giocate, ${total-played} da giocare</p>
        ${s.checkpointMode==='classifica' ? renderProvisionalStandings(cp.round) : ''}
      </div>`;
    } else if(cp.type==='end' && cp.round<totalRounds){
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Fine Manche ${cp.round}</div>
        <h2>Prendete fiato: la qualificazione continua con la Manche ${cp.round+1}</h2>
        ${renderEndRoundStandings(cp.round, s.checkpointMode)}
      </div>`;
    } else if(cp.type==='end' && cp.round===totalRounds){
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Fine qualificazione</div>
        <h2>Le manche sono finite!</h2>
        <p class="muted">L'admin sta per svelare le finaliste...</p>
      </div>`;
    }
  }
  else if(s.phase==='tiebreak_setup'){
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Spareggio</div>
      <h2>C'è un pareggio per l'accesso in finale!</h2>
      <p class="muted">L'admin sta preparando la domanda decisiva...</p>
    </div>`;
  }
  else if(s.phase==='reveal_finalists'){
    if(isEliminated){
      body = `<div class="card center stack">
        <div class="eyebrow">Verdetto</div>
        <h2>Siete eliminati, godetevi la finale 🍿</h2>
        <div class="divider"></div>
        <p class="muted">In finale: ${s.finalists.map(id=>teams[id]?teams[id].name:'—').join(' 🆚 ')}</p>
      </div>`;
    } else {
      body = `<div class="card center stack final-glow">
        <div class="eyebrow pill gold">Verdetto</div>
        <h2>Siete in finale! 🏆</h2>
        <p class="muted">Contro: ${s.finalists.filter(id=>id!==teamId).map(id=>teams[id]?teams[id].name:'—').join(', ')}</p>
      </div>`;
    }
  }
  else if(s.phase==='final_ready'){
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Finale conclusa</div>
      <h2>Il momento della verità sta per arrivare...</h2>
      <p class="muted">Attendete il verdetto dell'admin</p>
    </div>`;
  }
  else if(s.phase==='reveal_winner'){
    if(s.winner==='TIE'){
      body = `<div class="winner-card"><div class="eyebrow pill gold">Pareggio!</div><h2>Serve un supplementare 😅</h2></div>`;
    } else if(s.winner===teamId){
      body = `<div class="winner-card">
        <div class="eyebrow pill gold">Campioni</div>
        <div class="winner-name">${teamName}</div>
        <p>Campioni del Quizzettone! 🏆🎉</p>
      </div>`;
    } else if(isFinalist){
      body = `<div class="card center stack">
        <div class="eyebrow">Finale</div>
        <h2>Secondo posto, ma che partita! 🥈</h2>
        <p class="muted">Vince ${teams[s.winner]?teams[s.winner].name:'—'}</p>
      </div>`;
    } else {
      body = `<div class="card center stack">
        <h2>🏆 ${teams[s.winner]?teams[s.winner].name:'—'} è campione del Quizzettone!</h2>
      </div>`;
    }
  }

  const app2 = document.getElementById('app');
  app2.innerHTML = `
    <div class="header">
      <div class="eyebrow">Quizzettone · ${teamName} · <a href="#" id="lnkExit" style="color:var(--ink-dim);">non sei tu?</a></div>
      ${connectionBadge()}
    </div>
    ${body}
  `;
  attachTeamOptionHandlers();
  const exitLink = document.getElementById('lnkExit');
  if(exitLink) exitLink.onclick = (e)=>{ e.preventDefault(); if(confirm('Uscire dalla squadra '+teamName+'?')){ clearUrlSession(); clearTeamSession(); stopListening(); role=null; joined=false; teamId=null; teamName=null; renderRoleSelect(); } };
}

function renderTeamQuestion(round, idx, active, isTiebreak, readOnly){
  const q = getQuestion(round, idx);
  if(!q) return '<div class="card center">Un attimo...</div>';
  const key = qkey(round, idx);
  const myAnswer = answersByTeam[teamId] && answersByTeam[teamId][key];
  const remaining = active ? timeRemaining() : 0;
  const expired = active && remaining<=0 && !myAnswer;
  const showCorrectness = round!=='tiebreak' && !active && !!state.solutionRevealed;

  let optionsHtml = q.options.map((opt,i)=>{
    let cls = 'opt';
    if(myAnswer && myAnswer.optionIndex===i) cls += ' selected';
    if(showCorrectness){
      if(i===q.correctIndex) cls += ' correct';
      else if(myAnswer && myAnswer.optionIndex===i && i!==q.correctIndex) cls += ' wrong';
    }
    const disabled = readOnly || !active || !!myAnswer || remaining<=0;
    return `<button class="${cls}" data-idx="${i}" ${disabled?'disabled':''}>
      <span class="letter">${letter(i)}</span><span>${escapeHtml(opt)}</span>
    </button>`;
  }).join('');

  let banner = '';
  if(myAnswer) banner = `<div class="status-banner sent">✓ Risposta inviata</div>`;
  else if(expired || (!active && !myAnswer)) banner = `<div class="status-banner expired">⏱ Tempo scaduto</div>`;

  const roundLabel = round==='final' ? 'FINALE' : round==='tiebreak' ? 'SPAREGGIO' : `MANCHE ${round}`;
  const activeIds = active ? activeTeamsForRound(round) : [];
  const answeredCount = active ? activeIds.filter(id=>answersByTeam[id] && answersByTeam[id][key]).length : 0;

  return `
    <div class="card stack">
      <div class="qmeta">
        <span class="pill gold">${roundLabel}</span>
        <span class="pill">Domanda ${idx+1}/${getList(round).length}</span>
        <span class="pill">${escapeHtml(q.category)}</span>
        ${active ? `<span class="pill">✓ ${answeredCount}/${activeIds.length} risposto</span>` : ''}
      </div>
      ${active ? `<div class="timer-wrap">${circleTimer(remaining, state.timerDuration)}</div>` : ''}
      <div class="qtext">${escapeHtml(q.question)}</div>
      <div class="options">${optionsHtml}</div>
      ${banner}
    </div>
  `;
}

function attachTeamOptionHandlers(){
  document.querySelectorAll('.opt[data-idx]').forEach(btn=>{
    btn.onclick = async ()=>{
      if(btn.disabled) return;
      const idx = parseInt(btn.getAttribute('data-idx'));
      const round = state.round, qIdx = state.qIndex;
      await teamSubmitAnswer(round, qIdx, idx);
    };
  });
}

function renderProvisionalStandings(round){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score: roundScore(id, round)})).sort((a,b)=>b.score-a.score);
  return `<div class="divider"></div><h3 class="center">Classifica provvisoria</h3>${rankRows(ranked)}`;
}
function renderEndRoundStandings(round, mode){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score: roundScore(id,round)})).sort((a,b)=>b.score-a.score);
  if(mode==='complete') return `<div class="divider"></div><h3 class="center">Classifica Manche ${round}</h3>${rankRows(ranked)}`;
  if(mode==='partial') return `<div class="divider"></div><h3 class="center">Posizioni (punti nascosti)</h3>${ranked.map((r,i)=>`<div class="rank-row"><div class="rank-num">${i+1}</div><div class="rank-name">${teams[r.id]?teams[r.id].name:'—'}</div></div>`).join('')}`;
  return '';
}

/* ================== VISTA DISPLAY (schermo pubblico, sola lettura) ================== */
function renderDisplay(){
  const app = document.getElementById('app');
  app.className = '';
  const s = state;
  const inTiebreak = s.round==='tiebreak';

  let body = '';

  if(s.standingsReveal){
    body = renderStandingsRevealScreen(s.standingsReveal);
  }
  else if(s.standingsVisible){
    body = renderLiveStandingsCard();
  }
  else if(s.phase==='lobby'){
    body = `
      <div class="card center stack">
        <div class="eyebrow">Quizzettone</div>
        <h2>In attesa che l'admin avvii la Manche 1...</h2>
      </div>`;
  }
  else if(s.phase==='question' && !inTiebreak){
    body = renderTeamQuestion(s.round, s.qIndex, true, false, true);
  }
  else if(s.phase==='question' && inTiebreak){
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Spareggio in corso</div>
      <h3>Due squadre si giocano l'accesso in finale</h3>
    </div>`;
  }
  else if(s.phase==='closed'){
    body = renderTeamQuestion(s.round, s.qIndex, false, false, true);
  }
  else if(s.phase==='tiebreak_closed'){
    body = `<div class="card center stack"><div class="eyebrow pill gold">Spareggio</div><p class="muted">L'admin sta verificando le risposte...</p></div>`;
  }
  else if(s.phase==='checkpoint'){
    const cp = s.checkpoint;
    const totalRounds = totalRoundsCount();
    if(cp.type==='mid'){
      const total = getList(cp.round).length;
      const played = Math.ceil(total/2);
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Checkpoint · Metà Manche ${cp.round}</div>
        <h2>Prendete fiato ☕</h2>
        <p class="muted">${played} domande giocate, ${total-played} da giocare</p>
        ${s.checkpointMode==='classifica' ? renderProvisionalStandings(cp.round) : ''}
      </div>`;
    } else if(cp.type==='end' && cp.round<totalRounds){
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Fine Manche ${cp.round}</div>
        <h2>Prendete fiato: la qualificazione continua con la Manche ${cp.round+1}</h2>
        ${renderEndRoundStandings(cp.round, s.checkpointMode)}
      </div>`;
    } else if(cp.type==='end' && cp.round===totalRounds){
      body = `<div class="card center stack">
        <div class="eyebrow pill gold">Fine qualificazione</div>
        <h2>Le manche sono finite!</h2>
        <p class="muted">L'admin sta per svelare le finaliste...</p>
      </div>`;
    }
  }
  else if(s.phase==='tiebreak_setup'){
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Spareggio</div>
      <h2>C'è un pareggio per l'accesso in finale!</h2>
      <p class="muted">L'admin sta preparando la domanda decisiva...</p>
    </div>`;
  }
  else if(s.phase==='reveal_finalists'){
    body = `<div class="card center stack final-glow">
      <div class="eyebrow pill gold">Verdetto</div>
      <h2>In finale: ${(s.finalists||[]).map(id=>escapeHtml(teams[id]?teams[id].name:'—')).join(' 🆚 ')}</h2>
    </div>`;
  }
  else if(s.phase==='final_ready'){
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Finale conclusa</div>
      <h2>Il momento della verità sta per arrivare...</h2>
    </div>`;
  }
  else if(s.phase==='reveal_winner'){
    if(s.winner==='TIE'){
      body = `<div class="winner-card"><div class="eyebrow pill gold">Pareggio!</div><h2>Serve un supplementare 😅</h2></div>`;
    } else {
      body = `<div class="winner-card">
        <div class="eyebrow pill gold">Campioni del Quizzettone</div>
        <div class="winner-name">${escapeHtml(teams[s.winner]?teams[s.winner].name:'—')}</div>
      </div>`;
    }
  }

  app.innerHTML = `
    <div class="header">
      <div class="eyebrow">Quizzettone · Display</div>
      ${connectionBadge()}
    </div>
    ${body}
    ${renderPartyRevealCards()}
    ${audioUnlockOverlayHtml()}
  `;
  wireAudioUnlockOverlay();
  playPendingAudioCueIfAny();
}

/* ================== VISTA ADMIN ================== */
function renderAdmin(){
  const app = document.getElementById('app');
  app.className = 'admin-wide';
  const s = state;
  const teamIds = Object.keys(teams);

  let controlPanel = '';
  let liveTable = '';

  if(s.phase==='lobby'){
    const pm = s.partyMode || 'none';
    controlPanel = `
      <div class="card stack">
        <h3>Lobby</h3>
        <p class="muted">${teamIds.length} squadre collegate</p>
        <div class="stack">${teamIds.map(id=>`<div class="team-tag">🎮 ${teams[id].name}</div>`).join('') || '<p class="muted">Nessuna squadra ancora...</p>'}</div>
        <button class="btn" id="btnStart" ${teamIds.length<1?'disabled':''}>Avvia Manche 1</button>
      </div>
      <div class="card stack">
        <h3>Modalità Party</h3>
        <p class="muted">Prove a sorpresa con carte bonus/malus da mostrare sul Display durante la serata.</p>
        <div class="row">
          <button class="btn ${pm==='none'?'':'secondary'}" id="btnPartyNone">Nessuna</button>
          <button class="btn ${pm==='normale'?'':'secondary'}" id="btnPartyNormale">Normale</button>
          <button class="btn ${pm==='extreme'?'':'secondary'}" id="btnPartyExtreme">Extreme</button>
        </div>
      </div>`;
  }
  else if((s.phase==='question' || s.phase==='closed') && !getQuestion(s.round, s.qIndex)){
    // stato anomalo (es. partita vecchia senza domande pescate dal mazzo): niente da mostrare, meglio resettare
    controlPanel = `<div class="card stack">
      <h3>Stato di gioco non valido</h3>
      <p class="muted">Non ci sono domande disponibili per questo punto della partita. Usa "Reset partita" qui sotto per ripartire da zero.</p>
    </div>`;
  }
  else if(s.phase==='question' || s.phase==='closed'){
    const round = s.round, idx = s.qIndex;
    const q = getQuestion(round, idx);
    const remaining = s.phase==='question' ? timeRemaining() : 0;
    const closed = s.phase==='closed' || remaining<=0;
    if(s.phase==='question' && remaining<=0){
      // auto-chiudi quando scade il tempo
      setTimeout(()=>{ if(state.phase==='question' && timeRemaining()<=0) adminCloseAnswers(); }, 50);
    }
    const roundLabel = round==='final'?'FINALE': round==='tiebreak'?'SPAREGGIO':`MANCHE ${round}`;
    const activeTeams = activeTeamsForRound(round);

    controlPanel = `
      <div class="card stack">
        <div class="qmeta">
          <span class="pill gold">${roundLabel}</span>
          <span class="pill">Domanda ${idx+1}/${getList(round).length}</span>
          <span class="pill">${escapeHtml(q.category)}</span>
        </div>
        ${!closed?`<div class="timer-wrap">${circleTimer(remaining, s.timerDuration)}</div>`:''}
        <div class="qtext">${escapeHtml(q.question)}</div>
        <div class="options">
          ${q.options.map((opt,i)=>`<div class="opt ${i===q.correctIndex?'correct':''}" style="cursor:default;">
            <span class="letter">${letter(i)}</span><span>${escapeHtml(opt)}</span>${i===q.correctIndex?' ✓':''}
          </div>`).join('')}
        </div>
        ${q.adminNote?`<p class="note">Nota: ${escapeHtml(q.adminNote)}</p>`:''}
        ${q.audioUrl?`<div class="row"><button class="btn secondary small" id="btnReplayAudio">▶ Riproduci audio</button></div>`:''}
        <div class="divider"></div>
        <div class="eyebrow">Punteggio per questa domanda</div>
        <div class="row">
          <label class="stack">Corretta<input type="text" inputmode="numeric" id="qsCorrect" value="${scoringFor(round, idx).correct}"></label>
          <label class="stack">Sbagliata (malus)<input type="text" inputmode="numeric" id="qsWrong" value="${scoringFor(round, idx).wrong}"></label>
          <label class="stack">Non data<input type="text" inputmode="numeric" id="qsNoAnswer" value="${scoringFor(round, idx).noAnswer}"></label>
        </div>
        <button class="btn ghost small" id="btnApplyQuestionScoring">Applica solo a questa domanda</button>
        <div class="row">
          ${!closed?`<button class="btn danger" id="btnCloseNow">Chiudi subito risposte</button>`:''}
          ${closed && !s.solutionRevealed && round!=='tiebreak' ?`<button class="btn secondary" id="btnRevealSolution">Svela soluzione alle squadre</button>`:''}
          ${closed?`<button class="btn" id="btnNext">${round==='tiebreak'?'Verifica risultato spareggio':'Domanda successiva'}</button>`:''}
        </div>
      </div>`;

    if((s.partyMode||'none') !== 'none'){
      const curKey = qkey(round, idx);
      const bonusSlot = s.party && s.party.bonus;
      const malusSlot = s.party && s.party.malus;
      const bonusForThis = bonusSlot && bonusSlot.forQuestion===curKey;
      const malusForThis = malusSlot && malusSlot.forQuestion===curKey;
      controlPanel += `
        <div class="card stack">
          <div class="eyebrow">Modalità Party · mazzo ${s.partyMode}</div>
          <div class="row">
            <button class="btn ${bonusForThis?'secondary':''}" id="btnMarkBonus">${bonusForThis?'✓ Bonus marcato':'Marca Bonus'}</button>
            <button class="btn ${malusForThis?'secondary':''}" id="btnMarkMalus">${malusForThis?'✓ Malus marcato':'Marca Malus'}</button>
          </div>
        </div>`;
    }

    const nextQ = round==='tiebreak' ? null : getQuestion(round, idx+1);
    if(nextQ){
      controlPanel += `
        <div class="card stack" style="opacity:.8;">
          <div class="eyebrow">Prossima domanda · solo tu la vedi</div>
          <div class="qmeta"><span class="pill">${escapeHtml(nextQ.category)}</span></div>
          <div class="qtext" style="font-size:16px;">${escapeHtml(nextQ.question)}</div>
        </div>`;
    }

    liveTable = `
      <div class="card">
        <h3>Stato squadre</h3>
        <table><thead><tr><th>Squadra</th><th>Stato</th><th>Risposta</th><th>Punti</th></tr></thead><tbody>
        ${activeTeams.map(id=>{
          const key = qkey(round, idx);
          const ans = answersByTeam[id] && answersByTeam[id][key];
          const status = ans ? `<span class="status-dot dot-ok"></span>Risposto` : (closed ? `<span class="status-dot dot-late"></span>Nessuna risposta` : `<span class="status-dot dot-wait"></span>In attesa`);
          const answerTxt = ans ? letter(ans.optionIndex)+') '+escapeHtml(q.options[ans.optionIndex]) : '—';
          const pts = closed ? teamPointsForQuestion(id, round, idx) : '—';
          return `<tr>
            <td>${teams[id]?teams[id].name:'—'}</td>
            <td>${status}</td>
            <td>${answerTxt}</td>
            <td>${pts} ${closed?`<button class="btn ghost small" data-adjust="-1" data-team="${id}">−</button><button class="btn ghost small" data-adjust="1" data-team="${id}">+</button>`:''}</td>
          </tr>`;
        }).join('')}
        </tbody></table>
      </div>`;
  }
  else if(s.phase==='checkpoint'){
    const cp = s.checkpoint;
    const totalRounds = totalRoundsCount();
    if(cp.type==='mid'){
      controlPanel = `
        <div class="card stack">
          <h3>Checkpoint · Metà Manche ${cp.round}</h3>
          <div class="row">
            <button class="btn ${s.checkpointMode==='pause'?'':'secondary'}" id="btnModePause">Mostra solo pausa</button>
            <button class="btn ${s.checkpointMode==='classifica'?'':'secondary'}" id="btnModeClassifica">Mostra classifica provvisoria</button>
          </div>
          <div class="divider"></div>
          ${renderAdminStandings(cp.round)}
          <button class="btn" id="btnContinue">Continua</button>
        </div>`;
    } else if(cp.type==='end' && cp.round<totalRounds){
      controlPanel = `
        <div class="card stack">
          <h3>Fine Manche ${cp.round}</h3>
          <div class="stack">
            <button class="btn ${s.checkpointMode==='complete'?'':'secondary'}" id="btnModeComplete">Mostra classifica completa</button>
            <button class="btn ${s.checkpointMode==='message'?'':'secondary'}" id="btnModeMessage">Solo messaggio, niente punteggi</button>
            <button class="btn ${s.checkpointMode==='partial'?'':'secondary'}" id="btnModePartial">Solo posizioni, punti nascosti</button>
          </div>
          <div class="divider"></div>
          ${renderAdminStandings(cp.round)}
          <button class="btn" id="btnContinue">Continua con Manche ${cp.round+1}</button>
        </div>`;
    } else if(cp.type==='end' && cp.round===totalRounds){
      controlPanel = `
        <div class="card stack">
          <h3>Fine qualificazione</h3>
          ${renderAdminStandings(cp.round, true)}
          <button class="btn" id="btnRevealFinalists">Svela finaliste</button>
        </div>`;
    }
  }
  else if(s.phase==='tiebreak_setup'){
    controlPanel = `
      <div class="card stack">
        <h3>Spareggio necessario</h3>
        <p class="muted">Pari merito tra: ${s.tiebreak.candidates.map(id=>teams[id]?teams[id].name:'—').join(', ')}</p>
        <p class="muted">Scegli una domanda dal pool finale da usare come spareggio:</p>
        <div class="stack">
          ${(s.tiebreak.candidateQuestions||[]).map((q,i)=>`<button class="btn secondary small" data-tb-q="${i}">${i+1}. [${escapeHtml(q.category)}] ${escapeHtml(q.question.slice(0,50))}...</button>`).join('') || '<p class="muted">Nessuna domanda disponibile nel pool finale.</p>'}
        </div>
      </div>`;
  }
  else if(s.phase==='tiebreak_closed'){
    const tb = s.tiebreak; const q = tb.question;
    controlPanel = `
      <div class="card stack">
        <h3>Risultato spareggio</h3>
        <p class="qtext">${escapeHtml(q.question)}</p>
        <p class="muted">Corretta: ${letter(q.correctIndex)}) ${escapeHtml(q.options[q.correctIndex])}</p>
        <div class="stack">
          ${tb.candidates.map(id=>{
            const ans = answersByTeam[id] && answersByTeam[id][qkey('tiebreak', tb.qIndex)];
            const correct = ans && ans.optionIndex===q.correctIndex;
            return `<div class="row" style="align-items:center;">
              <div>${teams[id]?teams[id].name:'—'} — ${ans ? (correct?'✓ corretta':'✗ sbagliata') : 'nessuna risposta'}</div>
              <button class="btn small" data-assign-winner="${id}">Assegna finale a questa squadra</button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  else if(s.phase==='reveal_finalists'){
    controlPanel = `
      <div class="card stack">
        <h3>Finaliste svelate</h3>
        <p>🏆 ${s.finalists.map(id=>teams[id]?teams[id].name:'—').join(' 🆚 ')}</p>
        <p class="muted">Eliminate: ${(s.eliminated||[]).map(id=>teams[id]?teams[id].name:'—').join(', ') || 'nessuna'}</p>
        <button class="btn" id="btnGoFinal">Inizia la Finale</button>
      </div>`;
  }
  else if(s.phase==='final_ready'){
    const scores = (s.finalists||[]).map(id=>({id, score:roundScore(id,'final')}));
    controlPanel = `
      <div class="card stack">
        <h3>Finale conclusa</h3>
        ${scores.map(r=>`<div class="rank-row"><div class="rank-name">${teams[r.id]?teams[r.id].name:'—'}</div><div class="rank-score">${r.score} pt</div></div>`).join('')}
        <button class="btn" id="btnRevealWinner">Svela vincitore</button>
      </div>`;
  }
  else if(s.phase==='reveal_winner'){
    controlPanel = `
      <div class="winner-card">
        <div class="eyebrow pill gold">Campioni del Quizzettone</div>
        <div class="winner-name">${s.winner==='TIE' ? 'Pareggio!' : (teams[s.winner]?teams[s.winner].name:'—')}</div>
        ${(s.finalWinnerScoreSnapshot||[]).map(r=>`<p class="muted">${teams[r.id]?teams[r.id].name:'—'}: ${r.score} pt</p>`).join('')}
        ${s.winner==='TIE' ? `<div class="row">${(s.finalists||[]).map(id=>`<button class="btn small" data-declare="${id}">Dichiara ${teams[id]?teams[id].name:'—'} vincitrice</button>`).join('')}</div>`:''}
      </div>`;
  }

  const standingsRoundNums = Array.from({length: totalRoundsCount()}, (_,i)=>i+1);
  const globalStandings = `
    <div class="card">
      <h3>Classifica generale (solo admin)</h3>
      <table><thead><tr><th>Squadra</th>${standingsRoundNums.map(r=>`<th>Manche ${r}</th>`).join('')}<th>Finale</th><th>Totale</th></tr></thead><tbody>
      ${teamIds.map(id=>`<tr>
        <td>${teams[id].name}</td>
        ${standingsRoundNums.map(r=>`<td>${roundScore(id,r)}</td>`).join('')}
        <td>${state.finalists && state.finalists.includes(id) ? roundScore(id,'final') : '—'}</td>
        <td><b>${totalScore(id)}</b></td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;

  const standingsToggle = `
    <div class="card row" style="align-items:center;">
      <div style="flex:2;">
        <div class="eyebrow">Classifica squadre</div>
        <p class="muted" style="margin:2px 0 0;">${s.standingsVisible ? 'Visibile ora sugli schermi delle squadre' : 'Nascosta agli schermi delle squadre'}</p>
      </div>
      <button class="btn ${s.standingsVisible?'danger':''}" id="btnToggleStandings" style="flex:1;">${s.standingsVisible?'Nascondi classifica':'Mostra classifica'}</button>
    </div>`;

  let standingsRevealPanel = '';
  if(!s.standingsReveal){
    standingsRevealPanel = `
      <div class="card stack">
        <h3>Classifica animata</h3>
        <p class="muted">Per i momenti clou: rivela le squadre una alla volta con animazione, nell'ordine che scegli tu.</p>
        <button class="btn secondary" id="btnSetupStandingsReveal" ${teamIds.length<1?'disabled':''}>Prepara rivelazione classifica</button>
      </div>`;
  } else if(s.standingsReveal.revealedCount===0){
    standingsRevealPanel = `
      <div class="card stack">
        <h3>Classifica animata · ordina la rivelazione</h3>
        <p class="muted">Verrà rivelata dall'alto verso il basso di questa lista (di norma dall'ultima alla prima posizione).</p>
        <div class="stack">
          ${s.standingsReveal.order.map((id,i)=>`
            <div class="row" style="align-items:center;">
              <div style="flex:2;">${i+1}. ${teams[id]?teams[id].name:'—'} (${totalScore(id)} pt)</div>
              <button class="btn ghost small" data-move-reveal="${i}" data-dir="-1" ${i===0?'disabled':''}>↑</button>
              <button class="btn ghost small" data-move-reveal="${i}" data-dir="1" ${i===s.standingsReveal.order.length-1?'disabled':''}>↓</button>
            </div>`).join('')}
        </div>
        <div class="row">
          <button class="btn" id="btnRevealNextStanding">Inizia rivelazione</button>
          <button class="btn ghost" id="btnCloseStandingsReveal">Annulla</button>
        </div>
      </div>`;
  } else {
    const done = s.standingsReveal.revealedCount >= s.standingsReveal.order.length;
    standingsRevealPanel = `
      <div class="card stack">
        <h3>Classifica animata in corso</h3>
        <p class="muted">Rivelate ${s.standingsReveal.revealedCount}/${s.standingsReveal.order.length}</p>
        <div class="row">
          ${!done?`<button class="btn" id="btnRevealNextStanding">Rivela prossima</button>`:''}
          <button class="btn ghost" id="btnCloseStandingsReveal">Chiudi</button>
        </div>
      </div>`;
  }

  const questionManagerToggle = `
    <div class="card row" style="align-items:center;">
      <div style="flex:2;">
        <div class="eyebrow">Banca domande</div>
        <p class="muted" style="margin:2px 0 0;">${Object.keys(questionBank).length} domande nel mazzo</p>
      </div>
      <button class="btn secondary" id="btnToggleQuestionManager" style="flex:1;">${showQuestionManager?'Nascondi gestione':'Gestisci domande'}</button>
    </div>`;

  const scoringSettingsToggle = `
    <div class="card row" style="align-items:center;">
      <div style="flex:2;">
        <div class="eyebrow">Punteggio di default</div>
        <p class="muted" style="margin:2px 0 0;">Corretta ${scoringDefaults.correct} · Sbagliata ${scoringDefaults.wrong} · Non data ${scoringDefaults.noAnswer}</p>
      </div>
      <button class="btn secondary" id="btnToggleScoringSettings" style="flex:1;">${showScoringSettings?'Nascondi':'Modifica default'}</button>
    </div>`;
  const scoringSettingsPanel = showScoringSettings ? `
    <div class="card stack">
      <h3>Punteggio di default per tutte le domande</h3>
      <p class="note">Vale per ogni domanda, a meno che tu non lo cambi per una domanda specifica mentre è in corso.</p>
      <div class="row">
        <label class="stack">Corretta<input type="text" inputmode="numeric" id="scDefCorrect" value="${scoringDefaults.correct}"></label>
        <label class="stack">Sbagliata (malus)<input type="text" inputmode="numeric" id="scDefWrong" value="${scoringDefaults.wrong}"></label>
        <label class="stack">Non data<input type="text" inputmode="numeric" id="scDefNoAnswer" value="${scoringDefaults.noAnswer}"></label>
      </div>
      <button class="btn" id="btnSaveScoringDefaults">Salva default</button>
    </div>` : '';

  const openDisplayCard = `
    <div class="card row" style="align-items:center;">
      <div style="flex:2;">
        <div class="eyebrow">Schermo pubblico</div>
        <p class="muted" style="margin:2px 0 0;">Apri in una nuova scheda da proiettare o condividere su uno schermo.</p>
      </div>
      <button class="btn secondary" id="btnOpenDisplay" style="flex:1;">🖥️ Apri Display</button>
    </div>`;

  const audioControlCard = s.audioCue ? `
    <div class="card stack">
      <div class="eyebrow">Audio ${s.audioCue.kind==='effect'?'(effetto)':'(domanda)'}</div>
      <p class="muted" style="margin:2px 0 0;">${escapeHtml(s.audioCue.label||'')}</p>
      ${s.audioCue.action==='play'
        ? `<button class="btn danger" id="btnStopAudio">⏹ Stop</button>`
        : `<div class="row"><button class="btn" id="btnResumeAudio">▶ Riprendi da qui</button><button class="btn secondary" id="btnRestartAudio">⟲ Da capo</button></div>`}
    </div>` : '';

  const effectsToggle = `
    <div class="card row" style="align-items:center;">
      <div style="flex:2;">
        <div class="eyebrow">Effetti sonori</div>
        <p class="muted" style="margin:2px 0 0;">${Object.keys(soundEffects).length} effetti caricati</p>
      </div>
      <button class="btn secondary" id="btnToggleEffects" style="flex:1;">${showEffectsManager?'Nascondi':'Gestisci effetti'}</button>
    </div>`;
  const effectsPanel = showEffectsManager ? `
    <div class="card stack">
      <h3>Riproduci effetto</h3>
      <div class="row" style="flex-wrap:wrap;">
        ${Object.values(soundEffects).map(fx=>`<button class="btn small" data-play-effect="${fx.id}">🔊 ${escapeHtml(fx.name)}</button>`).join('') || '<p class="muted">Nessun effetto caricato.</p>'}
      </div>
      <div class="divider"></div>
      <h3>Aggiungi effetto</h3>
      <input type="text" id="fxName" placeholder="Nome effetto (es. Applausi)">
      <input type="file" id="fxFile" accept="audio/*">
      <button class="btn" id="btnUploadEffect">Carica</button>
      <div id="fxUploadMsg" class="note"></div>
      <div class="divider"></div>
      <div class="stack">
        ${Object.values(soundEffects).map(fx=>`<div class="row" style="align-items:center;"><span style="flex:2;">${escapeHtml(fx.name)}</span><button class="btn danger small" data-delete-effect="${fx.id}">Elimina</button></div>`).join('')}
      </div>
    </div>` : '';

  const app2 = document.getElementById('app');
  app2.innerHTML = `
    <div class="header">
      <div class="eyebrow">Quizzettone · Pannello Admin</div>
      ${connectionBadge()}
    </div>
    <div class="admin-grid">
      <div class="stack">
        ${controlPanel}
        ${liveTable}
      </div>
      <div class="stack">
        ${openDisplayCard}
        ${audioControlCard}
        ${renderPartyPanel()}
        ${standingsToggle}
        ${standingsRevealPanel}
        ${globalStandings}
      </div>
    </div>
    ${questionManagerToggle}
    ${showQuestionManager ? renderQuestionManager() : ''}
    ${scoringSettingsToggle}
    ${scoringSettingsPanel}
    ${effectsToggle}
    ${effectsPanel}
    <div class="row">
      <button class="btn ghost small" id="btnReset">↺ Reset partita</button>
      <button class="btn ghost small" id="btnExitAdmin">Esci da admin</button>
    </div>
    ${renderPartyPopup()}
  `;
  attachAdminHandlers();
  const exitAdmin = document.getElementById('btnExitAdmin');
  if(exitAdmin) exitAdmin.onclick = ()=>{ clearUrlSession(); stopListening(); role=null; renderRoleSelect(); };
  playPendingAudioCueIfAny();
}

/* ================== ADMIN: PANNELLO E POPUP MODALITÀ PARTY ================== */
function renderPartyPanel(){
  const mode = (state && state.partyMode) || 'none';
  if(mode==='none') return '';
  const party = state.party || {};
  const slotRow = (slot, label)=>{
    const data = party[slot];
    if(!data){
      return `<div class="row" style="align-items:center;">
        <div style="flex:2;">${label}</div>
        <span class="pill">Non pescata</span>
      </div>`;
    }
    if(!data.confirmed){
      return `<div class="row" style="align-items:center;">
        <div style="flex:2;">${label} <span class="pill">in scelta...</span></div>
        <button class="btn secondary small" data-party-review="${slot}">Rivedi scelta</button>
      </div>`;
    }
    if(!data.revealed){
      return `<div class="stack">
        <div style="flex:2;">${label} pronta: <b>${escapeHtml(data.card.testo)}</b></div>
        <button class="btn" data-party-reveal="${slot}">Rivela ${escapeHtml(label)} ora</button>
      </div>`;
    }
    return `<div class="row" style="align-items:center;">
      <div style="flex:2;">${label} rivelata: ${escapeHtml(data.card.testo)}</div>
      <button class="btn ghost small" data-party-clear="${slot}">Nuova pesca</button>
    </div>`;
  };
  return `<div class="card stack">
    <h3>Party Mode <span class="pill gold">${mode}</span></h3>
    ${slotRow('bonus','Bonus')}
    <div class="divider"></div>
    ${slotRow('malus','Malus')}
    <div class="divider"></div>
    ${slotRow('surprise','Prova a sorpresa')}
    ${!party.surprise ? `<button class="btn secondary" id="btnPartySurprise">🎲 Pesca prova a sorpresa</button>` : ''}
  </div>`;
}
function renderPartyPopup(){
  if(!partyPopupSlot) return '';
  const slot = partyPopupSlot;
  const data = state.party && state.party[slot];
  if(!data){ return ''; }
  const label = slot==='bonus' ? 'Bonus' : slot==='malus' ? 'Malus' : 'Prova a sorpresa';
  const deck = activePartyDeck();
  return `<div class="card center stack" style="position:fixed;inset:0;z-index:999;justify-content:center;background:rgba(21,12,43,.97);border-radius:0;overflow:auto;padding:24px 18px;">
    <div class="eyebrow pill gold">Pesca privata · ${label}</div>
    <h2 style="max-width:480px;">${escapeHtml(data.card.testo)}</h2>
    ${data.card.tipo?`<p class="muted">Tipo: ${escapeHtml(data.card.tipo)}</p>`:''}
    <div class="row" style="max-width:420px;width:100%;">
      <button class="btn" data-party-confirm="${slot}">Conferma</button>
      <button class="btn secondary" data-party-redraw="${slot}">Ripesca</button>
    </div>
    <button class="btn ghost small" id="btnPartyManualToggle" style="max-width:420px;width:100%;">${partyManualListOpen?'Nascondi lista':'Scegli manualmente dalla lista'}</button>
    <div id="partyManualList" style="display:${partyManualListOpen?'block':'none'};max-width:420px;width:100%;max-height:240px;overflow:auto;" class="stack">
      ${deck.map(c=>`<button class="btn ghost small" data-party-manual="${slot}" data-card-id="${c.id}" style="text-align:left;">${escapeHtml(c.testo)}</button>`).join('') || '<p class="muted">Mazzo vuoto.</p>'}
    </div>
    <button class="btn ghost small" id="btnPartyPopupClose" style="max-width:420px;width:100%;">Chiudi (decidi più tardi)</button>
  </div>`;
}

function renderQuestionManager(){
  const all = Object.values(questionBank);
  const pools = ['manche','finale'];
  const byPoolCategory = {};
  all.forEach(q=>{
    byPoolCategory[q.pool] = byPoolCategory[q.pool] || {};
    byPoolCategory[q.pool][q.category] = byPoolCategory[q.pool][q.category] || [];
    byPoolCategory[q.pool][q.category].push(q);
  });

  const countsHtml = pools.map(pool=>{
    const cats = byPoolCategory[pool] || {};
    const catNames = Object.keys(cats).sort();
    const rows = catNames.map(c=>{
      const n = cats[c].length;
      return `<div class="row" style="justify-content:space-between;"><span>${escapeHtml(c)}</span><span class="pill ${n<10?'':'gold'}">${n}</span></div>`;
    }).join('') || '<p class="muted">Nessuna domanda in questo pool.</p>';
    const total = all.filter(q=>q.pool===pool).length;
    return `<div class="stack"><h3>${pool==='manche'?'Manche':'Finale'} (${total} totali)</h3>${rows}</div>`;
  }).join('<div class="divider"></div>');

  const listHtml = pools.map(pool=>{
    const cats = byPoolCategory[pool] || {};
    const catNames = Object.keys(cats).sort();
    const details = catNames.map(c=>{
      const items = cats[c].map(q=>`
        <div class="row" style="align-items:center;">
          <div style="flex:3;">
            <div style="font-weight:600;">${escapeHtml(q.question)}</div>
            <div class="muted" style="font-size:12px;">${q.options.map((o,i)=>(i===q.correctIndex?'✓ ':'')+escapeHtml(o)).join(' · ')}</div>
          </div>
          <button class="btn danger small" data-delete-question="${q.id}">Elimina</button>
        </div>`).join('');
      return `<details><summary>${escapeHtml(c)} (${cats[c].length})</summary>${items}</details>`;
    }).join('') || '<p class="muted">Vuoto.</p>';
    return `<div class="stack"><h3>${pool==='manche'?'Manche':'Finale'}</h3>${details}</div>`;
  }).join('<div class="divider"></div>');

  return `
    <div class="card stack">
      <h3>Riepilogo mazzo</h3>
      <p class="note">Le categorie sotto le 10 domande sono evidenziate in oro: potrebbero ripetersi spesso finché non ne aggiungi altre.</p>
      ${countsHtml}
    </div>
    <div class="card stack">
      <h3>Aggiungi una domanda</h3>
      <div class="row">
        <select id="qmPool">
          <option value="manche">Manche</option>
          <option value="finale">Finale</option>
        </select>
        <select id="qmCategory">${CATEGORIES.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <input type="text" id="qmQuestion" placeholder="Testo della domanda">
      <input type="text" id="qmOpt0" placeholder="Opzione A">
      <input type="text" id="qmOpt1" placeholder="Opzione B">
      <input type="text" id="qmOpt2" placeholder="Opzione C">
      <input type="text" id="qmOpt3" placeholder="Opzione D">
      <select id="qmCorrect">
        <option value="0">Corretta: A</option>
        <option value="1">Corretta: B</option>
        <option value="2">Corretta: C</option>
        <option value="3">Corretta: D</option>
      </select>
      <input type="text" id="qmNote" placeholder="Nota per l'admin (facoltativa, es. autore canzone)">
      <input type="file" id="qmAudioFile" accept="audio/*">
      <p class="note">Audio facoltativo (es. la canzone da indovinare): parte da solo quando la domanda diventa quella corrente.</p>
      <button class="btn" id="btnAddQuestion">Aggiungi al mazzo</button>
      <div id="qmAddMsg" class="note"></div>
    </div>
    <div class="card stack">
      <h3>Incolla in blocco</h3>
      <p class="note">Un rigo per domanda, campi separati da "|":<br>
      <code>manche|Musica|Che canzone è?|Sere nere|Ti scatterò una foto|Non me lo so spiegare|Imbranato|2|Tiziano Ferro</code><br>
      L'ottavo campo è la risposta corretta (1=A, 2=B, 3=C, 4=D). Il nono campo (nota) e il decimo campo (URL audio) sono facoltativi.</p>
      <textarea id="qmBulkText" rows="6" placeholder="Incolla qui le domande, una per riga..."></textarea>
      <button class="btn" id="btnBulkImport">Importa</button>
      <div id="qmBulkMsg" class="note"></div>
    </div>
    <div class="card stack">
      <h3>Elenco domande</h3>
      ${listHtml}
    </div>
  `;
}

function renderAdminStandings(round, qualification){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score: qualification? qualificationScore(id) : roundScore(id, round)})).sort((a,b)=>b.score-a.score);
  return `<h3 class="center">${qualification?'Classifica qualificazione':'Classifica Manche '+round}</h3>${rankRows(ranked)}`;
}

function attachAdminHandlers(){
  const byId = id=>document.getElementById(id);
  if(byId('btnStart')) byId('btnStart').onclick = adminStartGame;
  if(byId('btnCloseNow')) byId('btnCloseNow').onclick = adminCloseAnswers;
  if(byId('btnRevealSolution')) byId('btnRevealSolution').onclick = adminRevealSolution;
  if(byId('btnNext')) byId('btnNext').onclick = adminNextQuestion;
  if(byId('btnContinue')) byId('btnContinue').onclick = adminContinueFromCheckpoint;
  if(byId('btnModePause')) byId('btnModePause').onclick = ()=>adminSetCheckpointMode('pause');
  if(byId('btnModeClassifica')) byId('btnModeClassifica').onclick = ()=>adminSetCheckpointMode('classifica');
  if(byId('btnModeComplete')) byId('btnModeComplete').onclick = ()=>adminSetCheckpointMode('complete');
  if(byId('btnModeMessage')) byId('btnModeMessage').onclick = ()=>adminSetCheckpointMode('message');
  if(byId('btnModePartial')) byId('btnModePartial').onclick = ()=>adminSetCheckpointMode('partial');
  if(byId('btnRevealFinalists')) byId('btnRevealFinalists').onclick = adminRevealFinalists;
  if(byId('btnGoFinal')) byId('btnGoFinal').onclick = adminContinueToFinal;
  if(byId('btnRevealWinner')) byId('btnRevealWinner').onclick = adminRevealWinner;
  if(byId('btnReset')) byId('btnReset').onclick = ()=>{ if(confirm('Sicuro di voler azzerare tutta la partita?')) adminResetGame(); };
  if(byId('btnToggleStandings')) byId('btnToggleStandings').onclick = adminToggleStandings;
  if(byId('btnSetupStandingsReveal')) byId('btnSetupStandingsReveal').onclick = adminSetupStandingsReveal;
  if(byId('btnRevealNextStanding')) byId('btnRevealNextStanding').onclick = adminRevealNextStanding;
  if(byId('btnCloseStandingsReveal')) byId('btnCloseStandingsReveal').onclick = adminCloseStandingsReveal;
  document.querySelectorAll('[data-move-reveal]').forEach(btn=>{
    btn.onclick = ()=> adminMoveStandingsRevealOrder(parseInt(btn.getAttribute('data-move-reveal')), parseInt(btn.getAttribute('data-dir')));
  });
  if(byId('btnToggleQuestionManager')) byId('btnToggleQuestionManager').onclick = ()=>{ showQuestionManager = !showQuestionManager; render(); };
  if(byId('btnToggleScoringSettings')) byId('btnToggleScoringSettings').onclick = ()=>{ showScoringSettings = !showScoringSettings; render(); };
  if(byId('btnSaveScoringDefaults')) byId('btnSaveScoringDefaults').onclick = ()=>{
    const correct = parseInt(byId('scDefCorrect').value, 10) || 0;
    const wrong = parseInt(byId('scDefWrong').value, 10) || 0;
    const noAnswer = parseInt(byId('scDefNoAnswer').value, 10) || 0;
    adminSetScoringDefaults({correct, wrong, noAnswer});
  };
  if(byId('btnApplyQuestionScoring')) byId('btnApplyQuestionScoring').onclick = ()=>{
    const correct = parseInt(byId('qsCorrect').value, 10) || 0;
    const wrong = parseInt(byId('qsWrong').value, 10) || 0;
    const noAnswer = parseInt(byId('qsNoAnswer').value, 10) || 0;
    adminSetQuestionScoring(state.round, state.qIndex, {correct, wrong, noAnswer});
  };
  if(byId('btnAddQuestion')) byId('btnAddQuestion').onclick = async ()=>{
    const pool = byId('qmPool').value;
    const category = byId('qmCategory').value;
    const question = byId('qmQuestion').value.trim();
    const opts = [byId('qmOpt0').value.trim(), byId('qmOpt1').value.trim(), byId('qmOpt2').value.trim(), byId('qmOpt3').value.trim()];
    const correctIndex = parseInt(byId('qmCorrect').value, 10);
    const note = byId('qmNote').value.trim();
    const audioFile = byId('qmAudioFile').files[0];
    const msg = byId('qmAddMsg');
    if(!question || opts.some(o=>!o)){
      msg.textContent = 'Compila la domanda e tutte e 4 le opzioni.';
      msg.style.color = 'var(--pink)';
      return;
    }
    let audioUrl = null;
    if(audioFile){
      msg.textContent = 'Caricamento audio...'; msg.style.color = '';
      try{ audioUrl = await uploadAudioFile(audioFile, 'question-audio'); }
      catch(e){ msg.textContent = 'Upload audio fallito: ' + e.message; msg.style.color = 'var(--pink)'; return; }
    }
    await addQuestion({pool, category, question, options:opts, correctIndex, adminNote: note||null, audioUrl});
    msg.textContent = 'Domanda aggiunta!';
    msg.style.color = 'var(--green)';
    ['qmQuestion','qmOpt0','qmOpt1','qmOpt2','qmOpt3','qmNote'].forEach(id=>byId(id).value='');
    byId('qmAudioFile').value = '';
  };
  if(byId('btnBulkImport')) byId('btnBulkImport').onclick = async ()=>{
    const text = byId('qmBulkText').value;
    const {parsed, errors} = parseBulkQuestions(text);
    if(parsed.length>0) await bulkAddQuestions(parsed);
    const msg = byId('qmBulkMsg');
    let text2 = parsed.length + ' domande importate.';
    if(errors.length) text2 += ' Problemi: ' + errors.join('; ');
    msg.textContent = text2;
    msg.style.color = errors.length ? 'var(--pink)' : 'var(--green)';
    if(parsed.length>0) byId('qmBulkText').value = '';
  };
  document.querySelectorAll('[data-delete-question]').forEach(btn=>{
    btn.onclick = ()=>{ if(confirm('Eliminare questa domanda dal mazzo?')) deleteQuestion(btn.getAttribute('data-delete-question')); };
  });
  document.querySelectorAll('[data-adjust]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-team');
      const delta = parseInt(btn.getAttribute('data-adjust'));
      adminAdjustPoints(id, state.round, state.qIndex, delta);
    };
  });
  document.querySelectorAll('[data-tb-q]').forEach(btn=>{
    btn.onclick = ()=> adminStartTiebreakQuestion(parseInt(btn.getAttribute('data-tb-q')));
  });
  document.querySelectorAll('[data-assign-winner]').forEach(btn=>{
    btn.onclick = ()=> adminAssignTiebreakWinner(btn.getAttribute('data-assign-winner'));
  });
  document.querySelectorAll('[data-declare]').forEach(btn=>{
    btn.onclick = ()=> adminDeclareWinnerManually(btn.getAttribute('data-declare'));
  });
  if(byId('btnOpenDisplay')) byId('btnOpenDisplay').onclick = ()=>{
    const url = new URL(window.location.href);
    url.searchParams.set('role','display'); url.searchParams.delete('id');
    window.open(url.toString(), '_blank');
  };
  if(byId('btnReplayAudio')) byId('btnReplayAudio').onclick = adminReplayCurrentAudio;
  if(byId('btnStopAudio')) byId('btnStopAudio').onclick = adminStopAudio;
  if(byId('btnResumeAudio')) byId('btnResumeAudio').onclick = ()=>adminResumeAudio(false);
  if(byId('btnRestartAudio')) byId('btnRestartAudio').onclick = ()=>adminResumeAudio(true);
  if(byId('btnToggleEffects')) byId('btnToggleEffects').onclick = ()=>{ showEffectsManager = !showEffectsManager; render(); };
  document.querySelectorAll('[data-play-effect]').forEach(btn=>{
    btn.onclick = ()=>{
      const fx = soundEffects[btn.getAttribute('data-play-effect')];
      if(fx) safeSet('state', {...state, audioCue:{url:fx.url, kind:'effect', label:fx.name, action:'play', startAt:0, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}}, true);
    };
  });
  document.querySelectorAll('[data-delete-effect]').forEach(btn=>{
    btn.onclick = ()=>{ if(confirm('Eliminare questo effetto?')) deleteEffect(btn.getAttribute('data-delete-effect')); };
  });
  if(byId('btnUploadEffect')) byId('btnUploadEffect').onclick = async ()=>{
    const name = byId('fxName').value.trim();
    const file = byId('fxFile').files[0];
    const msg = byId('fxUploadMsg');
    if(!name || !file){ msg.textContent = 'Inserisci nome e file.'; msg.style.color = 'var(--pink)'; return; }
    msg.textContent = 'Caricamento...'; msg.style.color = '';
    try{
      const url = await uploadAudioFile(file, 'effects');
      await addEffect(name, url);
      msg.textContent = 'Effetto caricato!'; msg.style.color = 'var(--green)';
      byId('fxName').value=''; byId('fxFile').value='';
    }catch(e){ msg.textContent = 'Upload fallito: ' + e.message; msg.style.color = 'var(--pink)'; }
  };

  if(byId('btnPartyNone')) byId('btnPartyNone').onclick = ()=>adminSetPartyMode('none');
  if(byId('btnPartyNormale')) byId('btnPartyNormale').onclick = ()=>adminSetPartyMode('normale');
  if(byId('btnPartyExtreme')) byId('btnPartyExtreme').onclick = ()=>adminSetPartyMode('extreme');
  if(byId('btnMarkBonus')) byId('btnMarkBonus').onclick = ()=>{
    const cur = state.party && state.party.bonus;
    const key = qkey(state.round, state.qIndex);
    if(cur && cur.forQuestion===key){ partyPopupSlot = 'bonus'; partyManualListOpen = false; render(); }
    else adminMarkPartySlot('bonus');
  };
  if(byId('btnMarkMalus')) byId('btnMarkMalus').onclick = ()=>{
    const cur = state.party && state.party.malus;
    const key = qkey(state.round, state.qIndex);
    if(cur && cur.forQuestion===key){ partyPopupSlot = 'malus'; partyManualListOpen = false; render(); }
    else adminMarkPartySlot('malus');
  };
  if(byId('btnPartySurprise')) byId('btnPartySurprise').onclick = adminStartSurprise;
  document.querySelectorAll('[data-party-review]').forEach(btn=>{
    btn.onclick = ()=>{ partyPopupSlot = btn.getAttribute('data-party-review'); partyManualListOpen = false; render(); };
  });
  document.querySelectorAll('[data-party-reveal]').forEach(btn=>{
    btn.onclick = ()=> adminRevealPartyCard(btn.getAttribute('data-party-reveal'));
  });
  document.querySelectorAll('[data-party-clear]').forEach(btn=>{
    btn.onclick = ()=> adminClearPartySlot(btn.getAttribute('data-party-clear'));
  });
  document.querySelectorAll('[data-party-confirm]').forEach(btn=>{
    btn.onclick = ()=> adminConfirmPartyCard(btn.getAttribute('data-party-confirm'));
  });
  document.querySelectorAll('[data-party-redraw]').forEach(btn=>{
    btn.onclick = ()=> adminRedrawPartyCard(btn.getAttribute('data-party-redraw'));
  });
  document.querySelectorAll('[data-party-manual]').forEach(btn=>{
    btn.onclick = ()=> adminPickPartyCardManually(btn.getAttribute('data-party-manual'), btn.getAttribute('data-card-id'));
  });
  if(byId('btnPartyManualToggle')) byId('btnPartyManualToggle').onclick = ()=>{
    partyManualListOpen = !partyManualListOpen;
    render();
  };
  if(byId('btnPartyPopupClose')) byId('btnPartyPopupClose').onclick = ()=>{ partyPopupSlot = null; partyManualListOpen = false; render(); };
}
