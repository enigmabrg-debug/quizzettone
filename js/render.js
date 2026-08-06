/* ================== HELPERS UI ================== */
function totalRoundsCount(){ return (state && state.config && state.config.rounds) || 2; }
function letter(i){ return ['A','B','C','D'][i]; }
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/* Unico punto da cui si stampa il nome di una squadra in HTML: centralizza
   l'escaping così un nuovo punto di rendering non può dimenticarlo (era
   successo in rankRows() e altrove, lasciando un XSS reale sulle schermate
   di classifica viste da tutti). */
function teamNameHtml(id){
  return escapeHtml(teams[id] ? teams[id].name : '—');
}
function timeRemaining(){
  if(!state || !state.timer) return 0;
  const t = state.timer;
  if(t.status==='paused') return t.pausedRemainingMs || 0;
  if(t.status!=='running' || !t.startedAt) return 0;
  return Math.max(0, t.durationMs - (Date.now() - t.startedAt));
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
      <div class="rank-name">${teamNameHtml(r.id)}</div>
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

/* Modale di conferma generica per le azioni ad alto impatto (rimozione
   squadra, reset partita): appesa a document.body invece che dentro #app,
   così sopravvive a un render() nel frattempo e non serve gestirla nel
   normale ciclo di re-render. */
function showConfirmModal(message, confirmLabel, onConfirm){
  const existing = document.getElementById('confirmModalOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'confirmModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;';
  overlay.innerHTML = `
    <div class="card stack" style="max-width:360px;margin:20px;">
      <p>${escapeHtml(message)}</p>
      <div class="row">
        <button class="btn danger" id="confirmModalYes">${escapeHtml(confirmLabel)}</button>
        <button class="btn ghost" id="confirmModalNo">Annulla</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('confirmModalYes').onclick = ()=>{ overlay.remove(); onConfirm(); };
  document.getElementById('confirmModalNo').onclick = ()=>{ overlay.remove(); };
}

/* Banner di errore per un'operazione Firebase fallita (FT-05): appeso a
   document.body come showConfirmModal, così non sparisce al prossimo
   render(). onRetry è opzionale: se assente il banner ha solo "Chiudi". */
function showErrorBanner(message, onRetry){
  const existing = document.getElementById('errorBannerOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'errorBannerOverlay';
  overlay.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:1001;display:flex;justify-content:center;padding:16px;';
  overlay.innerHTML = `
    <div class="card stack" style="max-width:420px;border-color:rgba(255,77,109,.4);">
      <p style="color:var(--pink);font-weight:700;margin:0;">${escapeHtml(message)}</p>
      <div class="row">
        ${onRetry ? `<button class="btn danger" id="errorBannerRetry">Riprova</button>` : ''}
        <button class="btn ghost" id="errorBannerClose">Chiudi</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('errorBannerClose').onclick = ()=> overlay.remove();
  if(onRetry) document.getElementById('errorBannerRetry').onclick = ()=>{ overlay.remove(); onRetry(); };
}

/* Reset partita a due passaggi (FT-01, versione "checklist di backup manuale"
   al posto di un secondo progetto Firebase separato — vedi PL-05 nel piano):
   Step 1 costringe l'admin a spuntare esplicitamente che ha pensato al
   backup PRIMA di poter proseguire; Step 2 è l'ultima conferma esplicita,
   che è l'unico punto che richiama davvero onConfirm(). Un reset non può
   più partire da un solo click distratto. */
function showResetChecklistModal(onConfirm){
  const existing = document.getElementById('resetChecklistOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'resetChecklistOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;';
  document.body.appendChild(overlay);

  const items = [
    'Ho salvato o annotato il podio/le statistiche della serata, se mi servono.',
    'Nessuna squadra deve ancora vedere un risultato non ancora rivelato.',
    "Sono sicuro/a: squadre, risposte e punteggi verranno cancellati. L'azione non è annullabile con \"Annulla ultima azione\"."
  ];

  function renderStep1(){
    overlay.innerHTML = `
      <div class="card stack" style="max-width:420px;margin:20px;">
        <h3>Prima di azzerare la partita</h3>
        <div class="stack">
          ${items.map((label,i)=>`
            <label class="row" style="align-items:flex-start;gap:10px;">
              <input type="checkbox" id="resetCheck${i}" style="margin-top:3px;">
              <span>${escapeHtml(label)}</span>
            </label>`).join('')}
        </div>
        <div class="row">
          <button class="btn danger" id="resetContinue" disabled>Continua</button>
          <button class="btn ghost" id="resetCancel1">Annulla</button>
        </div>
      </div>`;
    const checkboxes = items.map((_,i)=>document.getElementById('resetCheck'+i));
    const continueBtn = document.getElementById('resetContinue');
    const updateContinueEnabled = ()=>{ continueBtn.disabled = !checkboxes.every(cb=>cb.checked); };
    checkboxes.forEach(cb=> cb.onchange = updateContinueEnabled);
    continueBtn.onclick = ()=>{ if(!continueBtn.disabled) renderStep2(); };
    document.getElementById('resetCancel1').onclick = ()=> overlay.remove();
  }
  function renderStep2(){
    overlay.innerHTML = `
      <div class="card stack" style="max-width:420px;margin:20px;">
        <h3>Conferma definitiva</h3>
        <p>Questo azzera davvero squadre, risposte e punteggi. Procedere?</p>
        <div class="row">
          <button class="btn danger" id="resetConfirmFinal">Reset definitivo</button>
          <button class="btn ghost" id="resetCancel2">Annulla</button>
        </div>
      </div>`;
    document.getElementById('resetConfirmFinal').onclick = ()=>{ overlay.remove(); onConfirm(); };
    document.getElementById('resetCancel2').onclick = ()=> overlay.remove();
  }
  renderStep1();
}

/* Rinomina squadra da Admin (PL-07): un modale semplice invece di
   window.prompt(), coerente con lo stile del resto dell'app (niente dialog
   nativi del browser). */
function showRenameTeamModal(currentName, onRename){
  const existing = document.getElementById('renameTeamOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'renameTeamOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;';
  overlay.innerHTML = `
    <div class="card stack" style="max-width:360px;margin:20px;">
      <h3>Rinomina squadra</h3>
      <input type="text" id="renameTeamInput" maxlength="24">
      <div class="row">
        <button class="btn" id="renameTeamConfirm">Rinomina</button>
        <button class="btn ghost" id="renameTeamCancel">Annulla</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById('renameTeamInput');
  input.value = currentName;
  input.focus();
  input.select();
  const confirmRename = ()=>{
    const val = input.value.trim();
    overlay.remove();
    if(val && val!==currentName) onRename(val);
  };
  document.getElementById('renameTeamConfirm').onclick = confirmRename;
  document.getElementById('renameTeamCancel').onclick = ()=> overlay.remove();
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') confirmRename(); });
}

/* Codice breve + QR per entrare in partita: il QR punta a ?role=team, che
   restoreFromUrl() apre direttamente sulla schermata "inserisci nome
   squadra" (vedi js/actions.js), saltando la selezione del ruolo. */
function renderJoinCodeBlock(joinCode){
  if(!joinCode) return '<p class="muted">Codice in generazione...</p>';
  let qrSvg = '';
  if(typeof qrcode !== 'undefined'){
    try{
      const joinUrl = location.origin + location.pathname + '?role=team';
      const qr = qrcode(0, 'M');
      qr.addData(joinUrl);
      qr.make();
      qrSvg = qr.createSvgTag({scalable:true});
    } catch(e){ qrSvg = ''; }
  }
  return `
    <div class="stack center">
      <div class="pill gold" style="font-size:22px;letter-spacing:.14em;padding:10px 20px;width:fit-content;">${escapeHtml(joinCode)}</div>
      ${qrSvg ? `<div style="width:150px;">${qrSvg}</div>` : ''}
      <p class="muted" style="font-size:12px;">Scansiona il QR per entrare al volo, oppure vai su ${escapeHtml(location.origin + location.pathname)} · codice serata: ${escapeHtml(joinCode)}</p>
    </div>`;
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
/* Statistiche finali: calcolate al volo da computeFinalStats() (state.js),
   non lette da statsHistory (quel nodo esiste solo come archivio che
   sopravvive a un reset/rivincita, non serve per mostrare QUESTA schermata,
   che è live mentre la partita appena conclusa è ancora quella corrente). */
function renderFinalStatsBlock(){
  const stats = computeFinalStats();
  if(!stats) return '';
  return `
    <div class="card stack">
      <div class="eyebrow">📊 Statistiche della serata</div>
      ${stats.podium.length ? `<div class="stack">
        ${stats.podium.map((p,i)=>`<div class="rank-row"><div class="rank-name">${['🥇','🥈','🥉'][i]||''} ${escapeHtml(p.name)}</div><div class="rank-score">${p.score} pt</div></div>`).join('')}
      </div>` : ''}
      ${stats.accuracy!==null ? `<p class="muted">✓ ${stats.accuracy}% di risposte corrette su tutta la serata (${stats.totalCorrect}/${stats.totalAnswered})</p>` : ''}
      ${stats.easiestQuestion ? `<p class="muted">🟢 Domanda più facile: "${escapeHtml(stats.easiestQuestion.question)}" (${Math.round(stats.easiestQuestion.rate*100)}% corrette)</p>` : ''}
      ${stats.hardestQuestion ? `<p class="muted">🔴 Domanda più difficile: "${escapeHtml(stats.hardestQuestion.question)}" (${Math.round(stats.hardestQuestion.rate*100)}% corrette)</p>` : ''}
      ${stats.fastestTeam ? `<p class="muted">⚡ Squadra più veloce: ${escapeHtml(stats.fastestTeam.name)}</p>` : ''}
      ${stats.bestComeback ? `<p class="muted">📈 Miglior rimonta: ${escapeHtml(stats.bestComeback.name)} (dal ${stats.bestComeback.fromRank}° al ${stats.bestComeback.toRank}° posto)</p>` : ''}
    </div>`;
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
  // sr.order è una lista di FASCE (gruppi di squadre a pari merito rivelate
  // insieme in un solo passo), non una lista piatta di singole squadre.
  const totalTeams = sr.order.reduce((sum,group)=>sum+group.length, 0);
  const revealedGroups = sr.order.slice(0, sr.revealedCount);
  let teamsSoFar = 0;
  const rows = revealedGroups.map(group=>{
    teamsSoFar += group.length;
    const pos = totalTeams - teamsSoFar + 1;
    const names = group.map(id=>teams[id]?teams[id].name:'—').join(' 🤝 ');
    const score = group.length ? totalScore(group[0]) : 0;
    return `<div class="reveal-row">
      <div class="reveal-pos">${pos}°</div>
      <div class="reveal-name">${escapeHtml(names)}</div>
      <div class="reveal-score">${score} pt</div>
    </div>`;
  }).join('');
  const speedClass = sr.speed==='fast' ? 'reveal-fast' : sr.speed==='suspense' ? 'reveal-suspense' : 'reveal-normal';
  return `<div class="card center stack final-glow ${speedClass}">
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
      <div id="joinError" class="note" style="color:var(--pink);display:none;">La partita è già iniziata e non accetta più nuove squadre.</div>
      <button class="btn" id="btnJoin">Entra in partita</button>
      <button class="btn ghost small" id="btnBack">← Indietro</button>
    </div>
  `;
  document.getElementById('btnBack').onclick = renderRoleSelect;
  const input = document.getElementById('teamNameInput');
  input.focus();
  const doJoin = async ()=>{
    if(!input.value.trim()) return;
    const attemptedName = input.value;
    role='team';
    try{
      await teamJoin(attemptedName);
    } catch(e){
      if(e.message === 'LATE_JOIN_BLOCKED'){
        role = null;
        document.getElementById('joinError').style.display = 'block';
      } else if(e.message === 'JOIN_FAILED'){
        role = null;
        showErrorBanner('Impossibile entrare in partita: controlla la connessione e riprova.', ()=>{ input.value = attemptedName; doJoin(); });
      } else {
        throw e;
      }
    }
  };
  document.getElementById('btnJoin').onclick = doJoin;
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') doJoin(); });
}

/* Schermata di avvio: mostrata al posto di una pagina bianca finché il primo
   snapshot da Firebase non è arrivato. 'timeout' compare se non arriva nulla
   entro BOOT_TIMEOUT_MS (vedi startListening in state.js) o se il listener
   fallisce esplicitamente (es. regole Firebase che negano la lettura). */
function renderBootScreen(){
  const app = document.getElementById('app');
  if(!app) return;
  app.className = '';
  if(bootStatus === 'timeout'){
    app.innerHTML = `
      <div class="header" style="align-items:center;text-align:center;margin-top:40px;">
        <div class="eyebrow">Party Quiz</div>
        <h1 class="brand">QUIZZETTONE</h1>
      </div>
      <div class="card center stack" style="margin-top:20px;">
        <h3>Connessione non riuscita</h3>
        <p class="muted">Non riesco a raggiungere il server dopo qualche secondo di attesa. Controlla la connessione e riprova.</p>
        <button class="btn" id="btnBootRetry">Riprova</button>
      </div>
    `;
    const btn = document.getElementById('btnBootRetry');
    if(btn) btn.onclick = retryBoot;
    return;
  }
  app.innerHTML = `
    <div class="header" style="align-items:center;text-align:center;margin-top:40px;">
      <div class="eyebrow">Party Quiz</div>
      <h1 class="brand">QUIZZETTONE</h1>
    </div>
    <div class="card center stack" style="margin-top:20px;">
      <p class="muted">Connessione in corso...</p>
    </div>
  `;
}

/* ================== RENDER PRINCIPALE ================== */
function render(){
  if(!state) return renderBootScreen(); // il primo snapshot da Firebase non è ancora arrivato
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
    const ready = !!(teams[teamId] && teams[teamId].ready);
    body = `
      <div class="card center stack">
        <div class="eyebrow">Sei dentro!</div>
        <h2>${escapeHtml(teamName)}</h2>
        <p class="muted">In attesa che l'admin avvii la Manche 1...</p>
        <button class="btn ${ready?'':'secondary'}" id="btnTeamReady">${ready?'✓ Siamo pronti':'Siamo pronti'}</button>
      </div>`;
  }
  else if(s.phase==='question' && !inTiebreak){
    body = (s.round==='final' && isEliminated) ? renderSpectatorFinal(s) : renderTeamQuestion(s.round, s.qIndex, true);
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
    body = (s.round==='final' && isEliminated) ? renderSpectatorFinal(s) : renderTeamQuestion(s.round, s.qIndex, false);
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
    const forFinal = s.tiebreak && s.tiebreak.forFinal;
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Spareggio</div>
      <h2>${forFinal ? "C'è un pareggio per la vittoria finale!" : "C'è un pareggio per l'accesso in finale!"}</h2>
      <p class="muted">L'admin sta preparando la domanda decisiva...</p>
    </div>`;
  }
  else if(s.phase==='reveal_finalists'){
    if(isEliminated){
      body = `<div class="card center stack">
        <div class="eyebrow">Verdetto</div>
        <h2>Siete eliminati, godetevi la finale 🍿</h2>
        <div class="divider"></div>
        <p class="muted">In finale: ${s.finalists.map(id=>teamNameHtml(id)).join(' 🆚 ')}</p>
      </div>`;
    } else {
      body = `<div class="card center stack final-glow">
        <div class="eyebrow pill gold">Verdetto</div>
        <h2>Siete in finale! 🏆</h2>
        <p class="muted">Contro: ${s.finalists.filter(id=>id!==teamId).map(id=>teamNameHtml(id)).join(', ')}</p>
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
    if(s.winner===teamId){
      body = `<div class="winner-card">
        <div class="eyebrow pill gold">Campioni</div>
        <div class="winner-name">${escapeHtml(teamName)}</div>
        <p>Campioni del Quizzettone! 🏆🎉</p>
      </div>`;
    } else if(isFinalist){
      body = `<div class="card center stack">
        <div class="eyebrow">Finale</div>
        <h2>Secondo posto, ma che partita! 🥈</h2>
        <p class="muted">Vince ${teamNameHtml(s.winner)}</p>
      </div>`;
    } else {
      body = `<div class="card center stack">
        <h2>🏆 ${teamNameHtml(s.winner)} è campione del Quizzettone!</h2>
      </div>`;
    }
  }

  const app2 = document.getElementById('app');
  app2.innerHTML = `
    <div class="header">
      <div class="eyebrow">Quizzettone · ${escapeHtml(teamName)} · <a href="#" id="lnkExit" style="color:var(--ink-dim);">non sei tu?</a></div>
      ${connectionBadge()}
    </div>
    ${body}
    ${renderPartyRevealCards()}
  `;
  attachTeamOptionHandlers();
  const readyBtn = document.getElementById('btnTeamReady');
  if(readyBtn) readyBtn.onclick = ()=> teamSetReady(!(teams[teamId] && teams[teamId].ready));
  const exitLink = document.getElementById('lnkExit');
  if(exitLink) exitLink.onclick = (e)=>{ e.preventDefault(); if(confirm('Uscire dalla squadra '+teamName+'?')){ disarmPresence(teamId); clearUrlSession(); clearTeamSession(); stopListening(); role=null; joined=false; teamId=null; teamName=null; renderRoleSelect(); } };
}

/* Modalità spettatore per le squadre eliminate durante la finale: mostra lo
   stato di ogni finalista (sta pensando / risposta bloccata / tempo scaduto)
   senza far vedere il testo della risposta finché la config
   answerVisibilityForEliminated non lo consente, per non facilitare
   suggerimenti dal pubblico. L'esito corretto/sbagliato resta comunque
   nascosto finché l'admin non svela la soluzione, indipendentemente dalla
   visibilità della sola risposta. */
function renderSpectatorFinal(s){
  const finalists = s.finalists || [];
  const key = qkey(s.round, s.qIndex);
  const visibility = (s.config && s.config.answerVisibilityForEliminated) || 'after_reveal';
  const q = getQuestion(s.round, s.qIndex);
  const showAnswers = visibility==='live' ? true : visibility==='after_reveal' ? s.phase==='closed' : !!s.solutionRevealed;
  const rows = finalists.map(id=>{
    const ans = answersByTeam[id] && answersByTeam[id][key];
    const statusLabel = ans ? 'Risposta bloccata' : (s.phase==='closed' ? 'Tempo scaduto' : 'Sta pensando...');
    let answerHtml = '';
    if(showAnswers && ans && q){
      const color = s.solutionRevealed ? (ans.optionIndex===q.correctIndex ? 'var(--green)' : 'var(--pink)') : 'var(--ink)';
      answerHtml = `<div style="font-size:14px;margin-top:4px;color:${color};">${letter(ans.optionIndex)}) ${escapeHtml(q.options[ans.optionIndex])}</div>`;
    }
    return `<div class="card stack" style="padding:12px;">
      <div class="row" style="align-items:center;justify-content:space-between;">
        <b>${teamNameHtml(id)}</b>
        <span class="pill ${ans?'gold':''}">${statusLabel}</span>
      </div>
      ${answerHtml}
    </div>`;
  }).join('');
  return `<div class="card center stack">
    <div class="eyebrow pill gold">Modalità spettatore</div>
    <h2>Siete eliminati, seguite la finale 🍿</h2>
    <div class="stack">${rows}</div>
  </div>`;
}

function renderTeamQuestion(round, idx, active, isTiebreak, readOnly){
  const q = getQuestion(round, idx);
  if(!q) return '<div class="card center">Un attimo...</div>';
  const key = qkey(round, idx);
  const myAnswer = answersByTeam[teamId] && answersByTeam[teamId][key];
  // Bloccato subito al click (PL-06), non solo quando arriva l'eco della
  // scrittura: sopravvive anche ai re-render del tick ogni 250ms mentre la
  // transazione è ancora in corso, perché è pilotato da questo flag locale
  // e non da una semplice mutazione del DOM.
  const submitPending = active && pendingSubmitKey === key && !myAnswer;
  // Con l'avvio manuale del timer, la domanda è visibile ma non ancora
  // rispondibile finché l'host non preme "Avvia timer": senza questa
  // distinzione timeRemaining() (0 mentre status è 'idle') farebbe sembrare
  // il tempo già scaduto fin da subito.
  const timerIdle = active && state.timer && state.timer.status==='idle';
  const remaining = active ? (timerIdle ? state.timer.durationMs : timeRemaining()) : 0;
  const expired = active && !timerIdle && remaining<=0 && !myAnswer;
  const showCorrectness = round!=='tiebreak' && !active && !!state.solutionRevealed;

  let optionsHtml = q.options.map((opt,i)=>{
    let cls = 'opt';
    if(myAnswer && myAnswer.optionIndex===i) cls += ' selected';
    if(showCorrectness){
      if(i===q.correctIndex) cls += ' correct';
      else if(myAnswer && myAnswer.optionIndex===i && i!==q.correctIndex) cls += ' wrong';
    }
    const disabled = readOnly || !active || !!myAnswer || timerIdle || remaining<=0 || submitPending;
    return `<button class="${cls}" data-idx="${i}" ${disabled?'disabled':''}>
      <span class="letter">${letter(i)}</span><span>${escapeHtml(opt)}</span>
    </button>`;
  }).join('');

  let banner = '';
  if(submitPending) banner = `<div class="status-banner">Invio in corso...</div>`;
  else if(myAnswer){
    const bonusNote = myAnswer.speedBonus>0 ? ` (⚡ bonus velocità: +${myAnswer.speedBonus} se corretta)` : '';
    banner = `<div class="status-banner sent">✓ Risposta inviata${bonusNote}</div>`;
  }
  else if(timerIdle) banner = `<div class="status-banner">In attesa che l'host avvii il timer...</div>`;
  else if(active && state.timer && state.timer.status==='paused') banner = `<div class="status-banner">⏸ Timer in pausa</div>`;
  else if(expired || (!active && !myAnswer)) banner = `<div class="status-banner expired">⏱ Tempo scaduto</div>`;

  const roundLabel = round==='final' ? 'FINALE' : round==='tiebreak' ? 'SPAREGGIO' : `MANCHE ${round}`;
  const activeIds = active ? activeTeamsForRound(round) : [];
  const answeredCount = active ? activeIds.filter(id=>answersByTeam[id] && answersByTeam[id][key]).length : 0;

  // Regole visibili: mai una correzione nascosta. Se questa domanda ha punti
  // diversi dal default (es. una "domanda a punti doppi" impostata dall'admin
  // via override), o se il bonus velocità è attivo per la partita, le
  // squadre lo vedono PRIMA di rispondere, non lo scoprono dopo.
  let scoringPill = '';
  if(round!=='tiebreak'){
    const sc = scoringFor(round, idx);
    const baseSc = (state.config && state.config.scoring) || DEFAULT_SCORING;
    if(sc.correct!==baseSc.correct || sc.wrong!==baseSc.wrong || sc.noAnswer!==baseSc.noAnswer){
      scoringPill = `<span class="pill gold">⭐ Punti speciali: ${sc.correct>baseSc.correct?'+'+sc.correct:sc.correct}/${sc.wrong}/${sc.noAnswer}</span>`;
    }
  }
  const speedBonusPill = (active && state.config && state.config.speedBonus && state.config.speedBonus.enabled)
    ? `<span class="pill">⚡ Bonus velocità attivo</span>` : '';

  return `
    <div class="card stack">
      <div class="qmeta">
        <span class="pill gold">${roundLabel}</span>
        <span class="pill">Domanda ${idx+1}/${getList(round).length}</span>
        <span class="pill">${escapeHtml(q.category)}</span>
        ${active ? `<span class="pill">✓ ${answeredCount}/${activeIds.length} risposto</span>` : ''}
        ${scoringPill}
        ${speedBonusPill}
      </div>
      ${active ? `<div class="timer-wrap">${circleTimer(remaining, state.timer.durationMs)}</div>` : ''}
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
      const key = qkey(round, qIdx);
      pendingSubmitKey = key; // blocca subito tutte le opzioni, anche prima che la transazione risponda
      render();
      await teamSubmitAnswer(round, qIdx, idx);
      if(pendingSubmitKey === key) pendingSubmitKey = null;
      render();
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
  if(mode==='partial') return `<div class="divider"></div><h3 class="center">Posizioni (punti nascosti)</h3>${ranked.map((r,i)=>`<div class="rank-row"><div class="rank-num">${i+1}</div><div class="rank-name">${teamNameHtml(r.id)}</div></div>`).join('')}`;
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
    const teamIds = Object.keys(teams);
    body = `
      <div class="card center stack">
        <div class="eyebrow">${escapeHtml(s.gameName)}</div>
        <h2>In attesa che l'admin avvii la Manche 1...</h2>
        ${renderJoinCodeBlock(s.joinCode)}
        <div class="divider"></div>
        <p class="muted">${teamIds.length} squadre collegate</p>
        <div class="row" style="flex-wrap:wrap;justify-content:center;">${teamIds.map(id=>`<div class="team-tag">🎮 ${escapeHtml(teams[id].name)}${teams[id].ready?' ✓':''}</div>`).join('')}</div>
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
    const forFinal = s.tiebreak && s.tiebreak.forFinal;
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">Spareggio</div>
      <h2>${forFinal ? "C'è un pareggio per la vittoria finale!" : "C'è un pareggio per l'accesso in finale!"}</h2>
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
    body = `<div class="winner-card">
      <div class="eyebrow pill gold">Campioni del Quizzettone</div>
      <div class="winner-name">${escapeHtml(teams[s.winner]?teams[s.winner].name:'—')}</div>
    </div>
    ${renderFinalStatsBlock()}`;
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

/* Checklist pre-partita: puramente informativa, non blocca mai l'avvio. */
function renderPreGameChecklist(){
  const issues = computePreGameChecklist();
  if(!issues.length){
    return `<div class="pill" style="background:rgba(80,200,120,.15);color:#6fdb96;">✓ Nessun problema rilevato nel mazzo di domande</div>`;
  }
  return `
    <div class="card stack" style="background:rgba(230,160,60,.1);border-color:rgba(230,160,60,.35);">
      <div class="eyebrow">⚠ Checklist mazzo domande</div>
      <ul style="margin:0;padding-left:20px;">
        ${issues.map(issue=>`<li>${escapeHtml(issue.detail)}</li>`).join('')}
      </ul>
    </div>`;
}

/* ================== SALA PRE-PARTITA (configurazione essenziale + avanzata) ================== */
function renderSalaPrePartita(s, cfg){
  const questionsPerRound = cfg.questionsPerRound[0] || 15;
  const tieOptions = [
    ['prima_corretta','Prima risposta corretta'],
    ['oltranza','Spareggio a oltranza'],
    ['corretta_veloce','Corretta più veloce'],
    ['numerica','Più vicino al valore corretto']
  ];
  const tieSelect = (id, selected)=> `<select id="${id}">${tieOptions.map(([v,label])=>`<option value="${v}" ${v===selected?'selected':''}>${label}</option>`).join('')}</select>`;
  const lateJoinOptions = [
    ['always','Sempre consentito'],
    ['until_round1_end','Fino a fine prima manche'],
    ['blocked_after_start','Bloccato dopo lo start']
  ];
  const carryoverOptions = [['reset','Azzera i punti'],['keep','Mantiene i punti'],['convert','Converte i punti']];
  const visibilityOptions = [['secret','Segreta (solo dopo la soluzione)'],['after_reveal','Diretta protetta (consigliata)'],['live','Diretta totale']];
  const finalScoringEnabled = !!cfg.finalScoring;
  const fs = cfg.finalScoring || cfg.scoring;
  return `
    <div class="card stack">
      <h3>Sala pre-partita</h3>
      ${s.setupLocked?'<p class="muted">Le regole sono bloccate: la partita è già iniziata.</p>':'<p class="muted">Imposta le regole essenziali prima di avviare. Le squadre possono già entrare in lobby.</p>'}
      ${renderJoinCodeBlock(s.joinCode)}
      ${renderPreGameChecklist()}
      <div class="divider"></div>
      <label class="stack">Nome partita<input type="text" id="setupGameName" value="${escapeHtml(s.gameName)}" ${s.setupLocked?'disabled':''}></label>
      <div class="row">
        <label class="stack">Manche di qualificazione<input type="text" inputmode="numeric" id="setupRounds" value="${cfg.rounds}" ${s.setupLocked?'disabled':''}></label>
        <label class="stack">Domande per manche<input type="text" inputmode="numeric" id="setupQuestionsPerRound" value="${questionsPerRound}" ${s.setupLocked?'disabled':''}></label>
      </div>
      <div class="row">
        <label class="stack">Finalisti<input type="text" inputmode="numeric" id="setupFinalistCount" value="${cfg.finalistCount}" ${s.setupLocked?'disabled':''}></label>
        <label class="stack">Domande finale<input type="text" inputmode="numeric" id="setupFinalQuestionCount" value="${cfg.finalQuestionCount}" ${s.setupLocked?'disabled':''}></label>
        <label class="stack">Durata domande (secondi)<input type="text" inputmode="numeric" id="setupQuestionDuration" value="${Math.round(cfg.questionDurationMs/1000)}" ${s.setupLocked?'disabled':''}></label>
      </div>
      <div class="row">
        <label class="stack">Punti corretta<input type="text" inputmode="numeric" id="setupScoringCorrect" value="${cfg.scoring.correct}" ${s.setupLocked?'disabled':''}></label>
        <label class="stack">Punti sbagliata<input type="text" inputmode="numeric" id="setupScoringWrong" value="${cfg.scoring.wrong}" ${s.setupLocked?'disabled':''}></label>
        <label class="stack">Punti non data<input type="text" inputmode="numeric" id="setupScoringNoAnswer" value="${cfg.scoring.noAnswer}" ${s.setupLocked?'disabled':''}></label>
      </div>
      <label class="stack">Regola pareggio (qualificazione)${tieSelect('setupTiebreakQualification', cfg.tiebreakRule.qualification)}</label>
      <label class="stack">Ingresso tardivo<select id="setupLateJoinPolicy" ${s.setupLocked?'disabled':''}>${lateJoinOptions.map(([v,label])=>`<option value="${v}" ${v===cfg.lateJoin.policy?'selected':''}>${label}</option>`).join('')}</select></label>
      <label class="stack">Avvio timer<select id="setupTimerStartMode" ${s.setupLocked?'disabled':''}>
        <option value="auto" ${cfg.timerStartMode==='auto'?'selected':''}>Automatico all'apertura della domanda</option>
        <option value="manual" ${cfg.timerStartMode==='manual'?'selected':''}>Manuale (parte solo quando clicchi "Avvia timer")</option>
      </select></label>

      <button class="btn ghost small" id="btnToggleAdvancedSetup">${showAdvancedSetup?'▲ Nascondi impostazioni avanzate':'▼ Impostazioni avanzate'}</button>
      <div id="salaAdvancedSection" style="display:${showAdvancedSetup?'flex':'none'};flex-direction:column;gap:10px;">
        <div class="divider"></div>
        <label class="row" style="align-items:center;"><input type="checkbox" id="setupFinalScoringEnabled" ${finalScoringEnabled?'checked':''} ${s.setupLocked?'disabled':''}> Punteggi diversi in finale</label>
        <div class="row">
          <label class="stack">Finale: corretta<input type="text" inputmode="numeric" id="setupFinalScoringCorrect" value="${fs.correct}" ${s.setupLocked?'disabled':''}></label>
          <label class="stack">Finale: sbagliata<input type="text" inputmode="numeric" id="setupFinalScoringWrong" value="${fs.wrong}" ${s.setupLocked?'disabled':''}></label>
          <label class="stack">Finale: non data<input type="text" inputmode="numeric" id="setupFinalScoringNoAnswer" value="${fs.noAnswer}" ${s.setupLocked?'disabled':''}></label>
        </div>
        <label class="stack">Punti in ingresso finale<select id="setupScoreCarryover" ${s.setupLocked?'disabled':''}>${carryoverOptions.map(([v,label])=>`<option value="${v}" ${v===cfg.scoreCarryover?'selected':''}>${label}</option>`).join('')}</select></label>
        <label class="stack">Regola pareggio (finale)${tieSelect('setupTiebreakFinal', cfg.tiebreakRule.final)}</label>
        <label class="stack">Visibilità risposte agli eliminati<select id="setupAnswerVisibility" ${s.setupLocked?'disabled':''}>${visibilityOptions.map(([v,label])=>`<option value="${v}" ${v===cfg.answerVisibilityForEliminated?'selected':''}>${label}</option>`).join('')}</select></label>
        <label class="row" style="align-items:center;"><input type="checkbox" id="setupBlockDuplicates" ${cfg.blockDuplicateQuestions?'checked':''} ${s.setupLocked?'disabled':''}> Blocca domande duplicate</label>
        <label class="row" style="align-items:center;"><input type="checkbox" id="setupSpeedBonusEnabled" ${cfg.speedBonus.enabled?'checked':''} ${s.setupLocked?'disabled':''}> Bonus velocità (annunciato alle squadre)</label>
        <div class="row">
          <label class="stack">Bonus massimo (punti)<input type="text" inputmode="numeric" id="setupSpeedBonusMax" value="${cfg.speedBonus.maxBonus}" ${s.setupLocked?'disabled':''}></label>
          <label class="stack">Finestra bonus (secondi)<input type="text" inputmode="numeric" id="setupSpeedBonusWindow" value="${Math.round(cfg.speedBonus.windowMs/1000)}" ${s.setupLocked?'disabled':''}></label>
        </div>
      </div>

      ${s.setupLocked?'':'<button class="btn" id="btnSaveSetup">Salva impostazioni</button>'}
    </div>`;
}

/* ================== VISTA ADMIN ================== */
function syncStandingsAutoPlay(s){
  const sr = s.standingsReveal;
  const shouldRun = sr && sr.autoPlaying && sr.revealedCount < sr.order.length;
  if(shouldRun && !standingsAutoPlayTimer){
    const delay = sr.speed==='fast' ? 1200 : sr.speed==='suspense' ? 3500 : 2200;
    standingsAutoPlayTimer = setInterval(()=>{
      const cur = state.standingsReveal;
      if(!cur || !cur.autoPlaying || cur.revealedCount>=cur.order.length){
        clearInterval(standingsAutoPlayTimer); standingsAutoPlayTimer = null; return;
      }
      adminRevealNextStanding();
    }, delay);
  } else if(!shouldRun && standingsAutoPlayTimer){
    clearInterval(standingsAutoPlayTimer); standingsAutoPlayTimer = null;
  }
}

function renderAdmin(){
  const app = document.getElementById('app');
  app.className = 'admin-wide';
  const s = state;
  const teamIds = Object.keys(teams);
  syncStandingsAutoPlay(s);

  let controlPanel = '';
  let liveTable = '';

  if(s.phase==='lobby'){
    const pm = s.partyMode || 'none';
    const cfg = s.config;
    controlPanel = `
      ${renderSalaPrePartita(s, cfg)}
      ${!s.setupLocked ? `
      <div class="card stack">
        <h3>Modalità prova</h3>
        <p class="muted">Prova la regia (timer, audio, display) con squadre fittizie che rispondono da sole: aggiungile, poi avvia una partita di prova come faresti con quella vera. Quando hai finito, "Reset partita" pulisce tutto (comprese le squadre fittizie) prima della serata vera.</p>
        <button class="btn ${s.testMode?'danger':'secondary'}" id="btnToggleTestMode">${s.testMode?'Disattiva simulazione risposte':'Attiva simulazione risposte'}</button>
        <div class="row">
          <button class="btn ghost small" id="btnAddTestTeams">+ Aggiungi 4 squadre prova</button>
          <button class="btn ghost small" id="btnRemoveTestTeams">Rimuovi squadre prova</button>
        </div>
      </div>` : ''}
      <div class="card stack">
        <h3>Lobby</h3>
        <p class="muted">${teamIds.length} squadre collegate</p>
        <div class="stack">${teamIds.map(id=>{
          const online = isTeamOnline(id);
          const devices = teamDeviceCount(id);
          return `<div class="team-tag">
            <span style="color:${online?'var(--green)':'var(--pink)'};">●</span> ${teamNameHtml(id)}
            ${devices>1?` <span class="pill">${devices} dispositivi</span>`:''}
            ${teams[id].ready?' <span class="pill gold">Pronta</span>':''}
            ${teams[id].lateJoin?' <span class="pill">tardiva</span>':''}
            ${teams[id].isTest?' <span class="pill">PROVA</span>':''}
            <button class="btn ghost small" data-rename-team="${id}" style="margin-left:auto;">✎</button>
            <button class="btn ghost small" data-remove-team="${id}">✕</button>
          </div>`;
        }).join('') || '<p class="muted">Nessuna squadra ancora...</p>'}</div>
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
    const idle = s.phase==='question' && s.timer.status==='idle';
    const paused = s.phase==='question' && s.timer.status==='paused';
    const remaining = s.phase!=='question' ? 0 : (idle ? s.timer.durationMs : timeRemaining());
    const closed = s.phase==='closed' || (!idle && remaining<=0);
    // La chiusura a scadenza è gestita dal tick condiviso in startUiTick()
    // (state.js), che chiama closeAnswersTransactional('expired') da
    // qualunque scheda aperta, non solo da questa vista admin.
    const roundLabel = round==='final'?'FINALE': round==='tiebreak'?'SPAREGGIO':`MANCHE ${round}`;
    const activeTeams = activeTeamsForRound(round);
    const questionKey = qkey(round, idx);
    const answeredIdsForCount = activeTeams.filter(id=>answersByTeam[id] && answersByTeam[id][questionKey]);
    const missingIdsForCount = activeTeams.filter(id=>!answeredIdsForCount.includes(id));
    const offlineMissingCount = missingIdsForCount.filter(id=>!isTeamOnline(id)).length;

    controlPanel = `
      <div class="card stack">
        <div class="qmeta">
          <span class="pill gold">${roundLabel}</span>
          <span class="pill">Domanda ${idx+1}/${getList(round).length}</span>
          <span class="pill">${escapeHtml(q.category)}</span>
          <span class="pill">✓ ${answeredIdsForCount.length} ricevute</span>
          <span class="pill">${missingIdsForCount.length} mancanti</span>
          ${offlineMissingCount>0?`<span class="pill" style="color:var(--pink);">${offlineMissingCount} offline</span>`:''}
        </div>
        ${!closed?`<div class="timer-wrap">${circleTimer(remaining, s.timer.durationMs)}${idle?'<div class="pill">In attesa di avvio</div>':''}${paused?'<div class="pill">⏸ In pausa</div>':''}</div>`:''}
        ${!closed?`<div class="row">
          ${idle?`<button class="btn" id="btnStartTimer">▶ Avvia timer</button>`:''}
          ${!idle && s.timer.status==='running'?`<button class="btn secondary small" id="btnPauseTimer">⏸ Pausa</button>`:''}
          ${paused?`<button class="btn secondary small" id="btnResumeTimer">▶ Riprendi</button>`:''}
          ${!idle?`<button class="btn ghost small" id="btnTimerMinus5">-5s</button><button class="btn ghost small" id="btnTimerPlus5">+5s</button>`:''}
        </div>`:''}
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
          ${closed && s.timer.closeReason==='expired' ?`<button class="btn ghost small" id="btnReopenAnswers">Riapri (errore tecnico)</button>`:''}
          <button class="btn ghost small" id="btnCancelQuestion">Annulla domanda</button>
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
            <td>${teamNameHtml(id)}</td>
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
        <p class="muted">Pari merito tra: ${s.tiebreak.candidates.map(id=>teamNameHtml(id)).join(', ')}</p>
        <p class="muted">Scegli una domanda dal pool finale da usare come spareggio:</p>
        <div class="stack">
          ${(s.tiebreak.candidateQuestions||[]).map((q,i)=>`<button class="btn secondary small" data-tb-q="${i}">${i+1}. [${escapeHtml(q.category)}] ${escapeHtml(q.question.slice(0,50))}...</button>`).join('') || '<p class="muted">Nessuna domanda disponibile nel pool finale.</p>'}
        </div>
      </div>`;
  }
  else if(s.phase==='tiebreak_closed'){
    const tb = s.tiebreak; const q = tb.question;
    const autoWinnerId = computeTiebreakAutoWinner();
    const assignLabel = tb.forFinal ? 'Dichiara vincitrice' : 'Assegna posto finale';
    controlPanel = `
      <div class="card stack">
        <h3>Risultato spareggio</h3>
        <p class="qtext">${escapeHtml(q.question)}</p>
        <p class="muted">Corretta: ${letter(q.correctIndex)}) ${escapeHtml(q.options[q.correctIndex])}</p>
        ${autoWinnerId ? `<p class="muted">Il sistema suggerisce <b>${teamNameHtml(autoWinnerId)}</b> in base alla regola di spareggio scelta: conferma o scegli un'altra squadra.</p>` : ''}
        <div class="stack">
          ${tb.candidates.map(id=>{
            const ans = answersByTeam[id] && answersByTeam[id][qkey('tiebreak', tb.qIndex)];
            const correct = ans && ans.optionIndex===q.correctIndex;
            const suggested = autoWinnerId===id;
            return `<div class="row" style="align-items:center;">
              <div>${teamNameHtml(id)} — ${ans ? (correct?'✓ corretta':'✗ sbagliata') : 'nessuna risposta'} ${suggested?'<span class="pill gold">Suggerita</span>':''}</div>
              <button class="btn small ${suggested?'':'secondary'}" data-assign-winner="${id}">${assignLabel}</button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  else if(s.phase==='reveal_finalists'){
    controlPanel = `
      <div class="card stack">
        <h3>Finaliste svelate</h3>
        <p>🏆 ${s.finalists.map(id=>teamNameHtml(id)).join(' 🆚 ')}</p>
        <p class="muted">Eliminate: ${(s.eliminated||[]).map(id=>teamNameHtml(id)).join(', ') || 'nessuna'}</p>
        <button class="btn" id="btnGoFinal">Inizia la Finale</button>
      </div>`;
  }
  else if(s.phase==='final_ready'){
    const scores = (s.finalists||[]).map(id=>({id, score:roundScore(id,'final')}));
    controlPanel = `
      <div class="card stack">
        <h3>Finale conclusa</h3>
        ${scores.map(r=>`<div class="rank-row"><div class="rank-name">${teamNameHtml(r.id)}</div><div class="rank-score">${r.score} pt</div></div>`).join('')}
        <button class="btn" id="btnRevealWinner">Svela vincitore</button>
      </div>`;
  }
  else if(s.phase==='reveal_winner'){
    controlPanel = `
      <div class="winner-card">
        <div class="eyebrow pill gold">Campioni del Quizzettone</div>
        <div class="winner-name">${teamNameHtml(s.winner)}</div>
        ${(s.finalWinnerScoreSnapshot||[]).map(r=>`<p class="muted">${teamNameHtml(r.id)}: ${r.score} pt</p>`).join('')}
      </div>
      ${renderFinalStatsBlock()}
      <div class="card stack">
        <h3>Rivincita</h3>
        <p class="muted">Stesse squadre e regole di questa partita, punteggi azzerati: si riparte dalla Sala pre-partita senza dover reinserire nulla.</p>
        <button class="btn" id="btnStartRematch">🔁 Rivincita</button>
      </div>`;
  }

  const standingsRoundNums = Array.from({length: totalRoundsCount()}, (_,i)=>i+1);
  const globalStandings = `
    <div class="card">
      <h3>Classifica generale (solo admin)</h3>
      <table><thead><tr><th>Squadra</th>${standingsRoundNums.map(r=>`<th>Manche ${r}</th>`).join('')}<th>Finale</th><th>Totale</th></tr></thead><tbody>
      ${teamIds.map(id=>`<tr>
        <td>${teamNameHtml(id)}</td>
        ${standingsRoundNums.map(r=>`<td>${roundScore(id,r)}</td>`).join('')}
        <td>${state.finalists && state.finalists.includes(id) ? roundScore(id,'final') : '—'}</td>
        <td><b>${totalScore(id)}</b></td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;

  const historyLog = (s.history && s.history.log) || [];
  const historyLogCard = `
    <div class="card stack">
      <button class="btn ghost small" id="btnToggleHistoryLog">${showHistoryLog?'▲ Nascondi storico azioni':'▼ Storico azioni ('+historyLog.length+')'}</button>
      ${showHistoryLog ? `
        <div class="stack" style="max-height:220px;overflow-y:auto;">
          ${[...historyLog].reverse().map(entry=>`<div class="row" style="justify-content:space-between;font-size:13px;">
            <span>${entry.type==='undo'?'↩ ':''}${escapeHtml(entry.label)}</span>
            <span class="muted">${new Date(entry.at).toLocaleTimeString()}</span>
          </div>`).join('') || '<p class="muted">Nessuna azione registrata ancora.</p>'}
        </div>
      ` : ''}
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
        <p class="muted">Per i momenti clou: l'ordine lo calcola il sistema (dall'ultima posizione, pari merito raggruppati in un'unica fascia), tu controlli solo il ritmo della rivelazione.</p>
        <button class="btn secondary" id="btnSetupStandingsReveal" ${teamIds.length<1?'disabled':''}>Prepara rivelazione classifica</button>
      </div>`;
  } else {
    const sr = s.standingsReveal;
    const done = sr.revealedCount >= sr.order.length;
    const speed = sr.speed || 'normal';
    standingsRevealPanel = `
      <div class="card stack">
        <h3>Classifica animata in corso</h3>
        <p class="muted">Rivelate ${sr.revealedCount}/${sr.order.length} fasce</p>
        <div class="row">
          <button class="btn ghost small ${speed==='fast'?'':'secondary'}" id="btnRevealSpeedFast">Rapida</button>
          <button class="btn ghost small ${speed==='normal'?'':'secondary'}" id="btnRevealSpeedNormal">Normale</button>
          <button class="btn ghost small ${speed==='suspense'?'':'secondary'}" id="btnRevealSpeedSuspense">Suspense</button>
        </div>
        <div class="row">
          ${!done?`<button class="btn" id="btnRevealNextStanding">Rivela prossima</button>`:''}
          ${!done?`<button class="btn secondary" id="btnToggleAutoPlayReveal">${sr.autoPlaying?'⏸ Pausa':'▶ Avvia automatica'}</button>`:''}
          ${!done?`<button class="btn ghost" id="btnSkipToFullStandingsReveal">Salta a classifica completa</button>`:''}
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

  const partyDeckManagerToggle = `
    <div class="card row" style="align-items:center;">
      <div style="flex:2;">
        <div class="eyebrow">Mazzi Party</div>
        <p class="muted" style="margin:2px 0 0;">${(partyDecks.normale||[]).length} carte normale · ${(partyDecks.extreme||[]).length} carte extreme</p>
      </div>
      <button class="btn secondary" id="btnTogglePartyDeckManager" style="flex:1;">${showPartyDeckManager?'Nascondi gestione':'Gestisci mazzi Party'}</button>
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
      ${s.history && s.history.last ? `<button class="btn ghost small" id="btnUndoLast" style="width:fit-content;">↩ Annulla: ${escapeHtml(s.history.last.label)}</button>` : ''}
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
        ${historyLogCard}
      </div>
    </div>
    ${questionManagerToggle}
    ${showQuestionManager ? renderQuestionManager() : ''}
    ${partyDeckManagerToggle}
    ${showPartyDeckManager ? renderPartyDeckManager() : ''}
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

/* Gestione mazzi Party: aggiungi/elimina carte in 'normale' o 'extreme'
   (i mazzi seed hanno solo 3+2 carte, pensate come esempio da estendere). */
function renderPartyDeckManager(){
  const deckSection = (deckName, label)=>{
    const cards = partyDecks[deckName] || [];
    const rows = cards.map(c=>`
      <div class="row" style="align-items:center;">
        <div style="flex:3;">
          <span class="pill ${c.tipo==='malus'?'':(c.tipo==='bonus'?'gold':'')}">${escapeHtml(c.tipo)}</span>
          ${escapeHtml(c.testo)}
        </div>
        <button class="btn danger small" data-delete-party-card="${deckName}:${c.id}">Elimina</button>
      </div>`).join('') || '<p class="muted">Mazzo vuoto.</p>';
    return `<div class="stack"><h3>Mazzo ${label} (${cards.length})</h3>${rows}</div>`;
  };
  return `
    <div class="card stack">
      ${deckSection('normale','normale')}
      <div class="divider"></div>
      ${deckSection('extreme','extreme')}
    </div>
    <div class="card stack">
      <h3>Aggiungi una carta</h3>
      <select id="pdmDeck">
        <option value="normale">Mazzo normale</option>
        <option value="extreme">Mazzo extreme</option>
      </select>
      <select id="pdmTipo">
        <option value="bonus">Bonus</option>
        <option value="malus">Malus</option>
        <option value="generica">Generica</option>
      </select>
      <input type="text" id="pdmTesto" placeholder="Testo della carta (es. Bevi un sorso)">
      <button class="btn" id="btnAddPartyCard">Aggiungi al mazzo</button>
    </div>
  `;
}

function renderAdminStandings(round, qualification){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score: qualification? qualificationScore(id) : roundScore(id, round)})).sort((a,b)=>b.score-a.score);
  return `<h3 class="center">${qualification?'Classifica qualificazione':'Classifica Manche '+round}</h3>${rankRows(ranked)}`;
}

/* Pulsanti di regia (timer + chiusura/avanzamento domanda): durante la fase
   'question' il tick condiviso (startUiTick, ogni 250ms) richiama render(),
   che ricostruisce l'intero pannello admin via innerHTML e riassegna gli
   onclick da zero. Se un click capita mentre un re-render è in corso, il
   nodo su cui il click era stato registrato può già essere stato sostituito,
   perdendo il click o richiedendone un secondo. La delegazione qui sotto è
   legata UNA SOLA VOLTA a 'document' (mai ricreato), quindi al momento del
   click controlla sempre il DOM live, indipendentemente da quante volte
   render() ha ricostruito i bottoni nel frattempo. */
const DELEGATED_REGIA_BUTTON_IDS = ['btnCloseNow','btnReopenAnswers','btnCancelQuestion','btnStartTimer','btnPauseTimer','btnResumeTimer','btnTimerMinus5','btnTimerPlus5','btnRevealSolution','btnNext'];
let delegatedRegiaHandlersBound = false;
function onDelegatedRegiaClick(e){
  if(role!=='admin') return;
  const btn = e.target.closest(DELEGATED_REGIA_BUTTON_IDS.map(id=>'#'+id).join(','));
  if(!btn) return;
  switch(btn.id){
    case 'btnCloseNow': adminCloseAnswers(); break;
    case 'btnReopenAnswers': adminReopenAnswers(); break;
    case 'btnCancelQuestion': if(confirm('Annullare questa domanda? Non assegnerà punti a nessuno.')) adminCancelQuestion(); break;
    case 'btnStartTimer': adminStartTimerManually(); break;
    case 'btnPauseTimer': adminPauseTimer(); break;
    case 'btnResumeTimer': adminResumeTimer(); break;
    case 'btnTimerMinus5': adminAdjustTimer(-5000); break;
    case 'btnTimerPlus5': adminAdjustTimer(5000); break;
    case 'btnRevealSolution': adminRevealSolution(); break;
    case 'btnNext': adminNextQuestion(); break;
  }
}
function bindDelegatedRegiaHandlersOnce(){
  if(delegatedRegiaHandlersBound) return;
  delegatedRegiaHandlersBound = true;
  document.addEventListener('click', onDelegatedRegiaClick);
}

function attachAdminHandlers(){
  const byId = id=>document.getElementById(id);
  bindDelegatedRegiaHandlersOnce();
  if(byId('btnStart')) byId('btnStart').onclick = adminStartGame;
  if(byId('btnToggleTestMode')) byId('btnToggleTestMode').onclick = adminToggleTestMode;
  if(byId('btnAddTestTeams')) byId('btnAddTestTeams').onclick = ()=>adminAddTestTeams(4);
  if(byId('btnRemoveTestTeams')) byId('btnRemoveTestTeams').onclick = adminRemoveTestTeams;
  if(byId('btnStartRematch')) byId('btnStartRematch').onclick = adminStartRematch;
  if(byId('btnToggleAdvancedSetup')) byId('btnToggleAdvancedSetup').onclick = ()=>{
    // Cambia solo la visibilità della sezione (niente render()): un re-render
    // completo qui ricostruirebbe il form da 'state' e cancellerebbe eventuali
    // modifiche ai campi essenziali non ancora salvate dall'admin.
    showAdvancedSetup = !showAdvancedSetup;
    byId('salaAdvancedSection').style.display = showAdvancedSetup ? 'flex' : 'none';
    byId('btnToggleAdvancedSetup').textContent = showAdvancedSetup ? '▲ Nascondi impostazioni avanzate' : '▼ Impostazioni avanzate';
  };
  if(byId('btnSaveSetup')) byId('btnSaveSetup').onclick = async ()=>{
    const intVal = id => parseInt(byId(id).value, 10);
    const rounds = intVal('setupRounds') || 1;
    const perRound = intVal('setupQuestionsPerRound') || 1;
    const gameName = byId('setupGameName').value.trim() || 'Quizzettone';
    // I campi "avanzati" esistono nel DOM solo quando la sezione è aperta: se è
    // chiusa non tocchiamo quelle chiavi di config, per non azzerare a sua
    // insaputa un'impostazione avanzata salvata in precedenza.
    const patch = {
      rounds,
      questionsPerRound: Array(rounds).fill(perRound),
      finalistCount: intVal('setupFinalistCount') || 1,
      finalQuestionCount: intVal('setupFinalQuestionCount') || 0,
      questionDurationMs: (intVal('setupQuestionDuration') || 20) * 1000,
      scoring: {
        correct: intVal('setupScoringCorrect') || 0,
        wrong: intVal('setupScoringWrong') || 0,
        noAnswer: intVal('setupScoringNoAnswer') || 0
      },
      tiebreakRule: { qualification: byId('setupTiebreakQualification').value },
      lateJoin: { policy: byId('setupLateJoinPolicy').value },
      timerStartMode: byId('setupTimerStartMode').value
    };
    // I campi avanzati esistono sempre nel DOM (sono solo nascosti via CSS),
    // ma li applichiamo al patch solo se la sezione è stata aperta: altrimenti
    // conterrebbero ancora i valori dell'ultimo render pieno, non le scelte
    // dell'admin per QUESTA partita.
    if(showAdvancedSetup){
      patch.finalScoring = byId('setupFinalScoringEnabled').checked ? {
        correct: intVal('setupFinalScoringCorrect') || 0,
        wrong: intVal('setupFinalScoringWrong') || 0,
        noAnswer: intVal('setupFinalScoringNoAnswer') || 0
      } : null;
      patch.scoreCarryover = byId('setupScoreCarryover').value;
      patch.tiebreakRule.final = byId('setupTiebreakFinal').value;
      patch.answerVisibilityForEliminated = byId('setupAnswerVisibility').value;
      patch.blockDuplicateQuestions = byId('setupBlockDuplicates').checked;
      patch.speedBonus = {
        enabled: byId('setupSpeedBonusEnabled').checked,
        maxBonus: intVal('setupSpeedBonusMax') || 0,
        windowMs: (intVal('setupSpeedBonusWindow') || 0) * 1000
      };
    }
    await adminSaveSetup(gameName, patch);
  };
  if(byId('btnContinue')) byId('btnContinue').onclick = adminContinueFromCheckpoint;
  if(byId('btnModePause')) byId('btnModePause').onclick = ()=>adminSetCheckpointMode('pause');
  if(byId('btnModeClassifica')) byId('btnModeClassifica').onclick = ()=>adminSetCheckpointMode('classifica');
  if(byId('btnModeComplete')) byId('btnModeComplete').onclick = ()=>adminSetCheckpointMode('complete');
  if(byId('btnModeMessage')) byId('btnModeMessage').onclick = ()=>adminSetCheckpointMode('message');
  if(byId('btnModePartial')) byId('btnModePartial').onclick = ()=>adminSetCheckpointMode('partial');
  if(byId('btnRevealFinalists')) byId('btnRevealFinalists').onclick = adminRevealFinalists;
  if(byId('btnGoFinal')) byId('btnGoFinal').onclick = adminContinueToFinal;
  if(byId('btnRevealWinner')) byId('btnRevealWinner').onclick = adminRevealWinner;
  if(byId('btnReset')) byId('btnReset').onclick = ()=> showResetChecklistModal(adminResetGame);
  if(byId('btnUndoLast')) byId('btnUndoLast').onclick = adminUndoLast;
  document.querySelectorAll('[data-remove-team]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-remove-team');
      const name = teams[id] ? teams[id].name : 'questa squadra';
      showConfirmModal('Rimuovere '+name+' dalla partita?', 'Rimuovi squadra', ()=>adminRemoveTeam(id));
    };
  });
  document.querySelectorAll('[data-rename-team]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-rename-team');
      const name = teams[id] ? teams[id].name : '';
      showRenameTeamModal(name, newName => adminRenameTeam(id, newName));
    };
  });
  if(byId('btnToggleStandings')) byId('btnToggleStandings').onclick = adminToggleStandings;
  if(byId('btnSetupStandingsReveal')) byId('btnSetupStandingsReveal').onclick = adminSetupStandingsReveal;
  if(byId('btnRevealNextStanding')) byId('btnRevealNextStanding').onclick = adminRevealNextStanding;
  if(byId('btnSkipToFullStandingsReveal')) byId('btnSkipToFullStandingsReveal').onclick = adminSkipToFullStandingsReveal;
  if(byId('btnToggleAutoPlayReveal')) byId('btnToggleAutoPlayReveal').onclick = adminToggleAutoPlayReveal;
  if(byId('btnRevealSpeedFast')) byId('btnRevealSpeedFast').onclick = ()=>adminSetStandingsRevealSpeed('fast');
  if(byId('btnRevealSpeedNormal')) byId('btnRevealSpeedNormal').onclick = ()=>adminSetStandingsRevealSpeed('normal');
  if(byId('btnRevealSpeedSuspense')) byId('btnRevealSpeedSuspense').onclick = ()=>adminSetStandingsRevealSpeed('suspense');
  if(byId('btnCloseStandingsReveal')) byId('btnCloseStandingsReveal').onclick = adminCloseStandingsReveal;
  if(byId('btnToggleQuestionManager')) byId('btnToggleQuestionManager').onclick = ()=>{ showQuestionManager = !showQuestionManager; render(); };
  if(byId('btnTogglePartyDeckManager')) byId('btnTogglePartyDeckManager').onclick = ()=>{ showPartyDeckManager = !showPartyDeckManager; render(); };
  if(byId('btnAddPartyCard')) byId('btnAddPartyCard').onclick = async ()=>{
    const deck = byId('pdmDeck').value;
    const tipo = byId('pdmTipo').value;
    const testo = byId('pdmTesto').value.trim();
    if(!testo) return;
    await adminAddPartyCard(deck, testo, tipo);
    byId('pdmTesto').value = '';
  };
  document.querySelectorAll('[data-delete-party-card]').forEach(btn=>{
    btn.onclick = ()=>{
      const [deck, cardId] = btn.getAttribute('data-delete-party-card').split(':');
      if(confirm('Eliminare questa carta dal mazzo?')) adminDeletePartyCard(deck, cardId);
    };
  });
  if(byId('btnToggleHistoryLog')) byId('btnToggleHistoryLog').onclick = ()=>{ showHistoryLog = !showHistoryLog; render(); };
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
      if(fx) safeSet(statePath(), {...state, audioCue:{url:fx.url, kind:'effect', label:fx.name, action:'play', startAt:0, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}}, true);
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
