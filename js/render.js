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
/* PL-19 (domanda fotografica): unico punto da cui si stampa l'immagine di
   una domanda, su Team/Admin/Display. onerror nasconde l'<img> rotta e
   mostra un messaggio di fallback esplicito invece di lasciare un'icona
   di immagine rotta silenziosa — sia l'admin sia le squadre devono capire
   subito che il file non è disponibile (link scaduto, file rimosso),
   coerente col resto del gioco ("mai una correzione nascosta"). */
function questionImageHtml(q, maxHeight){
  if(!q || !q.imageUrl) return '';
  return `<div class="question-image-wrap">
    <img src="${escapeHtml(q.imageUrl)}" style="max-width:100%;max-height:${maxHeight||'320px'};border-radius:8px;display:block;margin:0 auto;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
    <p class="note" style="display:none;color:var(--pink);">⚠ Immagine non disponibile (link scaduto o file rimosso).</p>
  </div>`;
}
function timeRemaining(){
  if(!state || !state.timer) return 0;
  const t = state.timer;
  if(t.status==='paused') return t.pausedRemainingMs || 0;
  if(t.status!=='running' || !t.startedAt) return 0;
  return Math.max(0, t.durationMs - (serverNow() - t.startedAt)); // PL-11: tempo autorevole condiviso
}
/* Contenuto del timer: cerchio, sola barra (timer "solo barra" sui telefoni, §14) o niente. */
function timerSlotContent(kind, remainingMs, total){
  if(kind==='none') return '';
  if(kind==='bar'){
    const pct = Math.max(0, Math.min(1, remainingMs/total));
    return `<div class="timer-bar ${remainingMs<6000?'urgent':''}"><div style="width:${(pct*100).toFixed(1)}%"></div></div>`;
  }
  return circleTimer(remainingMs, total);
}
function circleTimer(remainingMs, total){
  const pct = Math.max(0, Math.min(1, remainingMs/total));
  const r = 52, c = 2*Math.PI*r;
  const urgent = remainingMs < 6000;
  return `<div class="timer ${urgent?'urgent':''}">
    <svg width="118" height="118" viewBox="0 0 118 118">
      <circle cx="59" cy="59" r="${r}" fill="none" stroke="rgba(245,241,255,.12)" stroke-width="8"/>
      <circle cx="59" cy="59" r="${r}" fill="none" style="stroke:${urgent?'var(--pink)':'var(--gold)'}" stroke-width="8"
        stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" stroke-linecap="round"/>
    </svg>
    <div class="timer-num">${Math.ceil(remainingMs/1000)}</div>
  </div>`;
}
function rankRows(idsWithScores){
  const positions = rankPositions(idsWithScores);
  return idsWithScores.map((r,i)=>{
    const pos = positions[i];
    return `
    <div class="rank-row ${pos===1?'top1':pos===2?'top2':pos===3?'top3':''}">
      <div class="rank-num">${pos}</div>
      <div class="rank-name">${teamNameHtml(r.id)}</div>
      <div class="rank-score">${r.score} pt</div>
    </div>`;
  }).join('');
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
      // Con Top Dieci il link porta anche il gioco, così il telefono è nei colori giusti da subito.
      const joinUrl = location.origin + location.pathname + '?role=team' + (state && state.config && state.config.gameType==='topdieci' ? '&gioco=topdieci' : '');
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
  // PL-19 (consolidamento audio): un vero errore di caricamento (file
  // rimosso, URL scaduto, CORS) è diverso dal blocco autoplay del browser
  // già gestito sotto — qui l'admin (solo lui, per non far scrivere sia
  // admin sia Display in corsa) lo segnala su Firebase, così anche le
  // squadre (che non riproducono l'audio in prima persona, ma ne vedono lo
  // stato) sanno che quella domanda non ha audio disponibile invece di
  // restare in attesa di qualcosa che non arriverà mai.
  el.onerror = ()=>{
    console.warn('audio non disponibile', cue.url);
    if(role==='admin') reportAudioLoadFailure(cue.nonce);
  };
  // §8.4: a fine audio il Display lo segnala (e la regia, se ha la politica "a fine audio", apre le risposte).
  el.onended = ()=>{
    const rev = (state.presentation && state.presentation.revision) || 0;
    if(role==='display') reportDisplayStatus({mediaEndedRevision: rev});
    if(role==='admin') checkAfterMediaUnlock(true);
  };
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
  return `<div class="card center stack" id="audioUnlockCard" style="position:fixed;inset:0;z-index:999;justify-content:center;background:rgba(var(--stage-rgb),.96);border-radius:0;">
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
  const ranked = standingsRanking();
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
    const names = group.map(teamNameHtml).join(' 🤝 ');
    const score = group.length ? standingsScore(group[0]) : 0;
    return `<div class="reveal-row">
      <div class="reveal-pos">${pos}°</div>
      <div class="reveal-name">${names}</div>
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
      ${brandLogoHtml()}
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
      ${brandLogoHtml()}
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
      ${brandLogoHtml()}
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
        ${brandLogoHtml()}
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
      ${brandLogoHtml()}
    </div>
    <div class="card center stack" style="margin-top:20px;">
      <p class="muted">Connessione in corso...</p>
    </div>
  `;
}

/* ================== RENDER PRINCIPALE ================== */
/* Top Dieci ha una palette sua (verde smeraldo): la classe su <html> ridefinisce
   le variabili di colore. Vale anche prima che arrivi lo stato, dal link dell'hub. */
function applyTheme(){
  document.documentElement.classList.toggle('theme-topdieci', brandName()==='Top Dieci');
}
function render(){
  applyTheme();
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
      </div>
      ${renderRulesCard()}`;
  }
  else if((s.phase==='question' || s.phase==='closed') && isTop10(getQuestion(s.round, s.qIndex))){
    body = renderTop10Play(s.round, s.qIndex, 'team');
  }
  else if(s.phase==='question' && !inTiebreak){
    body = (s.round==='final' && isEliminated) ? renderSpectatorFinal(s) : renderTeamQuestion(s.round, s.qIndex, true);
  }
  else if((s.phase==='question' || s.phase==='closed') && inTiebreak && !isTiebreakCandidate){
    body = renderTiebreakWaitCard(s);
  }
  else if(s.phase==='question' && inTiebreak){
    body = renderTeamQuestion('tiebreak', s.qIndex, true, true);
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
      const ranking = standingsRanking();
      const myPos = rankPositions(ranking)[ranking.findIndex(r=>r.id===teamId)] || 2;
      body = `<div class="card center stack">
        <div class="eyebrow">Finale</div>
        <h2>${myPos===2 ? 'Secondo posto, ma che partita! 🥈' : myPos===3 ? 'Terzo posto, sul podio! 🥉' : myPos+'° posto in finale, ma che partita!'}</h2>
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
      <div class="eyebrow">${brandName()} · ${escapeHtml(teamName)} · <a href="#" id="lnkExit" style="color:var(--ink-dim);">non sei tu?</a></div>
      ${connectionBadge()}
    </div>
    ${body}
    ${renderPartyRevealCards()}
  `;
  attachTeamOptionHandlers();
  attachTop10Handlers();
  const readyBtn = document.getElementById('btnTeamReady');
  if(readyBtn) readyBtn.onclick = ()=> teamSetReady(!(teams[teamId] && teams[teamId].ready));
  const exitLink = document.getElementById('lnkExit');
  if(exitLink) exitLink.onclick = (e)=>{ e.preventDefault(); if(confirm('Uscire dalla squadra '+teamName+'?')){ disarmPresence(teamId); clearUrlSession(); clearTeamSession(); stopListening(); role=null; joined=false; teamId=null; teamName=null; renderRoleSelect(); } };
}

/* Logo del gioco nelle schermate d'ingresso (img/logo-*.webp). Se il file
   non c'è, resta il nome in testo di sempre. */
function brandLogoHtml(){
  const name = brandName();
  const src = name==='Top Dieci' ? 'img/logo-top10.webp' : 'img/logo-quizzettone.webp';
  return `<img class="brand-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><h1 class="brand" hidden>${escapeHtml(name.toUpperCase())}</h1>`;
}
/* Nome del gioco nelle intestazioni: "Top Dieci" se la partita è di quel tipo,
   o se la pagina è stata aperta dal link dell'hub (?gioco=topdieci). */
const URL_GAME = new URLSearchParams(location.search).get('gioco');
let top10UrlPresetApplied = false;
let salaPresetNoteText = '';
function brandName(){
  const t = state && state.config && state.config.gameType;
  if(t==='topdieci') return 'Top Dieci';
  if(t && t!=='quiz') return 'Quizzettone';
  return (URL_GAME==='topdieci' && !(state && state.setupLocked)) ? 'Top Dieci' : 'Quizzettone';
}
/* Regole della serata, generate dalla configurazione: in lobby sul Display e
   sui telefoni, così nessuno scopre a partita in corso come si fanno i punti. */
function renderRulesCard(){
  const cfg = state && state.config;
  if(!cfg) return '';
  const sc = cfg.scoring || DEFAULT_SCORING;
  const perRound = (cfg.questionsPerRound||[])[0] || 0;
  const carry = {reset:'si riparte da zero', keep:'si tengono i punti delle manche', convert:'i punti delle manche diventano un bonus'}[cfg.scoreCarryover] || '';
  const finalLine = cfg.finalistCount < 100
    ? `In finale le prime ${cfg.finalistCount}${carry ? ' ('+carry+')' : ''}; le altre squadre guardano la finale.`
    : `Nessuna eliminazione: tutte le squadre giocano la finale.`;
  let lines, title = '📜 Regole della serata', extraClass = '';
  if(cfg.gameType==='topdieci'){
    const t10 = {...DEFAULT_TOP10_CONFIG, ...(cfg.top10||{})};
    const m = sc.correct || 1;
    title = '🔟 Come si gioca a Top Dieci'; extraClass = 'top10-rules';
    lines = [
      `Ogni classifica ha 10 voci nascoste. Si gioca a turno: quando tocca a voi avete ${t10.turnSeconds} secondi per scrivere una voce.`,
      `Voce giusta: tanti punti quanto è in basso, ${m===1 ? '10° posto = 10 punti, 1° posto = 1 punto' : 'posizione × '+m+' (10° = '+(10*m)+' punti)'}. La voce compare sul tabellone di tutti, con il suo dato.`,
      `Voce sbagliata o tempo scaduto: il turno passa${sc.wrong ? ' ('+sc.wrong+' punti)' : ''}. Se la voce è già sul tabellone potete riprovare.`,
      `Piccoli errori di battitura, maiuscole e accenti non contano.`,
      t10.maxLaps ? `Si gioca finché la classifica è completa o per ${t10.maxLaps} giri; poi si svelano le voci mancanti.` : `Si gioca finché la classifica è completa.`,
      `A ogni classifica parte la squadra successiva.`,
      `${cfg.rounds} manche da ${perRound} ${perRound===1 ? 'classifica' : 'classifiche'}. ${finalLine}`
    ];
  } else {
    lines = [
      `${cfg.rounds} manche da ${perRound} domande, ${Math.round((cfg.questionDurationMs||0)/1000)} secondi per rispondere.`,
      `Risposta giusta +${sc.correct}, sbagliata ${sc.wrong}, non data ${sc.noAnswer}.`,
      cfg.speedBonus && cfg.speedBonus.enabled ? `Bonus velocità: fino a +${cfg.speedBonus.maxBonus} a chi risponde giusto nei primi ${Math.round(cfg.speedBonus.windowMs/1000)} secondi.` : '',
      finalLine,
      `Una risposta inviata non si cambia più.`
    ].filter(Boolean);
  }
  return `<div class="card stack rules-card ${extraClass}">
    <div class="eyebrow">${title}</div>
    <ul style="margin:0;padding-left:18px;text-align:left;">${lines.map(l=>`<li>${escapeHtml(l)}</li>`).join('')}</ul>
  </div>`;
}

function renderTiebreakWaitCard(s){
  const tb = s.tiebreak || {};
  return `<div class="card center stack">
    <div class="eyebrow pill gold">Spareggio in corso</div>
    <h3>${(tb.candidates||[]).map(teamNameHtml).join(' 🆚 ')}</h3>
    <p class="muted">${tb.forFinal ? 'In palio la vittoria finale.' : "In palio l'accesso in finale."} Restate collegati, tra poco si continua.</p>
  </div>`;
}
/* Testo di una risposta data e della risposta corretta, per tutte le tipologie. */
function answerText(q, ans){
  if(!q || !ans) return '—';
  return letter(ans.optionIndex)+') '+(q.options ? q.options[ans.optionIndex] : '');
}
function correctAnswerText(q){
  if(!q) return '';
  return letter(q.correctIndex)+') '+q.options[q.correctIndex];
}

/* ================== TOP DIECI (vista) ==================
   Tabellone condiviso da squadre e Display: le voci compaiono, con il dato e
   la squadra che le ha trovate, man mano che arrivano le risposte giuste; a
   classifica chiusa il presentatore svela quelle rimaste. */
function isTop10(q){ return !!(q && q.answerType==='top10' && q.top10); }
function top10Title(q){ return (q.top10 && q.top10.title) || q.question; }
function top10RoundLabel(round, idx){
  const n = getList(round).length;
  if(round==='final') return 'FINALE' + (n>1 ? ' · classifica '+(idx+1)+'/'+n : '');
  if(round==='tiebreak') return 'SPAREGGIO';
  return 'MANCHE '+round + (n>1 ? ' · classifica '+(idx+1)+'/'+n : '');
}
function top10StatusLine(b){
  if(!b) return '';
  if(state.phase==='closed' && b.status!=='done') return `<div class="status-banner">Classifica annullata dal presentatore</div>`;
  const lap = top10Lap(b), laps = b.order.length ? Math.ceil((b.maxTurns||0)/b.order.length) : 0;
  const lapText = laps ? `Giro ${Math.min(lap, laps)}/${laps}` : `Giro ${lap}`;
  if(b.status==='ready') return `<div class="status-banner">In attesa del via. Ordine dei turni: ${b.order.map(teamNameHtml).join(' → ')}</div>`;
  if(b.status==='done') return `<div class="status-banner">Classifica chiusa · ${top10FoundCount(b)}/10 trovate</div>`;
  const cur = top10CurrentTeam(b);
  return `<div class="top10-turn">
    <div id="timerSlot">${circleTimer(top10TurnRemaining(b), b.turnMs)}</div>
    <div class="stack" style="gap:4px;">
      <div class="eyebrow">${lapText}${b.status==='paused' ? ' · ⏸ in pausa' : ''}</div>
      <div class="top10-turn-name">${role==='team' && cur===teamId ? 'Tocca a voi!' : 'Tocca a '+teamNameHtml(cur)}</div>
    </div>
  </div>`;
}
function top10LogText(q, e){
  const items = top10Items(q);
  const who = teamNameHtml(e.t);
  const said = e.a ? ' «'+escapeHtml(e.a)+'»' : '';
  if(e.r==='ok') return `${who}:${said} ✓ ${escapeHtml(items[e.i] ? items[e.i].name : '')} (${e.i+1}°)`;
  if(e.r==='dup') return `${who}:${said} è già in classifica`;
  if(e.r==='timeout') return `${who}: tempo scaduto`;
  if(e.r==='skip') return `${who}: turno passato`;
  return `${who}:${said} ✗ non è in classifica`;
}
function renderTop10Board(q, b, full){
  const items = top10Items(q);
  // Solo l'ultima voce scoperta si anima: le altre restano ferme ai re-render.
  const last = b && b.log.length ? b.log[b.log.length-1] : null;
  const latest = last && last.r==='ok' ? last.i : null;
  return `<div class="top10-board" data-top10-board>${items.map((it,i)=>{
    const f = b ? top10FoundAt(b.found, i) : null;
    const revealed = full || !!f || !!(b && b.revealed['i'+i]);
    const cls = (f ? 'found' : revealed ? 'revealed' : '') + (i===latest ? ' latest' : '');
    return `<div class="top10-row ${cls}">
      <span class="top10-pos">${i+1}</span>
      <span class="top10-item">${revealed ? escapeHtml(it.name) : '? ? ?'}${revealed && it.value ? `<span class="top10-value">${escapeHtml(it.value)}</span>` : ''}</span>
      ${f ? `<span class="top10-by">${teamNameHtml(f.t)}</span>` : (revealed && b && b.status==='done' && !full ? '<span class="top10-by missed">non trovata</span>' : '')}
    </div>`;
  }).join('')}</div>`;
}
function renderTop10Scores(round, idx, b){
  if(!b || !b.order.length) return '';
  const cur = b.status==='playing' || b.status==='paused' ? top10CurrentTeam(b) : null;
  return `<div class="top10-scores">${b.order.map(id=>`<span class="pill ${id===cur?'gold':''}">${teamNameHtml(id)} · ${teamPointsForQuestion(id, round, idx)} pt</span>`).join('')}</div>`;
}
// Testo che la squadra di turno sta scrivendo: sopravvive ai re-render.
let top10Typed = {key:null, text:''};
let top10Pending = false;
let top10MyFeedback = null; // {key, turn, text, ok}
function renderTop10Play(round, idx, viewer){
  const q = getQuestion(round, idx);
  const b = top10Board(round, idx);
  const key = qkey(round, idx);
  if(!q || !b) return '<div class="card center">Un attimo...</div>';
  const myTurn = viewer==='team' && state.phase==='question' && b.status==='playing' && top10CurrentTeam(b)===teamId;
  if(top10Typed.key!==key) top10Typed = {key, text:''};
  const last = b.log.length ? b.log[b.log.length-1] : null;
  let input = '';
  if(myTurn){
    const fb = top10MyFeedback && top10MyFeedback.key===key && top10MyFeedback.turn===b.turn ? top10MyFeedback : null;
    input = `<form class="top10-answer" id="top10Form" autocomplete="off">
      <input type="text" id="top10Answer" maxlength="80" placeholder="Scrivete una voce della classifica" value="${escapeHtml(top10Typed.text)}" ${top10Pending?'disabled':''} autocapitalize="sentences" spellcheck="false">
      <button class="btn" id="btnTop10Send" type="submit" ${top10Pending?'disabled':''}>Invia</button>
    </form>
    ${fb ? `<div class="status-banner">${escapeHtml(fb.text)}</div>` : ''}`;
  } else if(viewer==='team' && b.status!=='done' && !b.order.includes(teamId)){
    input = `<div class="status-banner">${round==='final' ? 'Seguite la finale: giocano le finaliste.' : round==='tiebreak' ? 'Seguite lo spareggio.' : 'Entrerete in gioco dalla prossima classifica.'}</div>`;
  }
  return `<div class="card stack top10-card">
    <div class="qmeta">
      <span class="pill gold">${escapeHtml(top10RoundLabel(round, idx))}</span>
      <span class="pill">${escapeHtml(q.category)}</span>
    </div>
    <div class="eyebrow">🔟 Top Dieci</div>
    <div class="top10-title">${escapeHtml(top10Title(q))}</div>
    ${top10StatusLine(b)}
    ${input}
    ${last ? `<div class="top10-last ${last.r}">${top10LogText(q, last)}</div>` : ''}
    ${renderTop10Board(q, b, false)}
    ${renderTop10Scores(round, idx, b)}
  </div>`;
}
/* Regia Top Dieci: classifica completa (solo admin), comandi del turno,
   cronologia delle risposte con le correzioni manuali. */
function renderTop10Admin(round, idx){
  const q = getQuestion(round, idx);
  const b = top10Board(round, idx);
  if(!b) return `<div class="card stack"><h3>Tabellone non trovato</h3><p class="muted">Usa "Annulla domanda" o "Reset partita".</p></div>`;
  const items = top10Items(q);
  const missing = items.map((it,i)=>({it,i})).filter(x=>!top10FoundAt(b.found, x.i));
  const hidden = missing.filter(x=>!b.revealed['i'+x.i]).sort((x,y)=>y.i-x.i); // si svelano dal basso
  let controls = '';
  if(state.phase==='closed' && b.status!=='done') controls = `<span class="pill">Classifica annullata</span><button class="btn" id="btnNext">Avanti</button>`;
  else if(b.status==='ready') controls = `<button class="btn" id="btnTop10Start">▶ Inizia (parte ${teamNameHtml(b.order[0])})</button>`;
  else if(b.status==='playing' || b.status==='paused') controls = `
    ${b.status==='playing' ? '<button class="btn secondary small" id="btnTop10Pause">⏸ Pausa</button>' : '<button class="btn small" id="btnTop10Resume">▶ Riprendi</button>'}
    <button class="btn ghost small" id="btnTop10Skip">⏭ Passa il turno</button>
    <button class="btn ghost small" id="btnTop10End">■ Chiudi classifica</button>`;
  else controls = `
    ${hidden.length ? `<button class="btn secondary" id="btnTop10RevealNext">Svela il ${hidden[0].i+1}° posto</button><button class="btn ghost small" id="btnTop10RevealAll">Svela tutte (${hidden.length})</button>` : ''}
    <button class="btn" id="btnNext">${round==='tiebreak' ? 'Verifica risultato spareggio' : 'Avanti'}</button>`;
  const log = b.log.map((e,i)=>({e,i})).reverse();
  const unfoundOptions = missing.map(x=>`<option value="${x.i}">${x.i+1}° ${escapeHtml(x.it.name)}</option>`).join('');
  const logHtml = log.map(({e,i})=>{
    let fix = '';
    if(e.r==='wrong' && missing.length) fix = `<select id="top10AcceptSel_${i}">${unfoundOptions}</select><button class="btn ghost small" data-top10-accept="${i}">✓ Era giusta</button>`;
    if(e.r==='ok') fix = `<button class="btn ghost small" data-top10-reject="${i}">✗ Annulla</button>`;
    return `<div class="top10-log-row ${e.r}"><span class="muted">G${b.order.length ? Math.floor(e.turn/b.order.length)+1 : 1}</span><span style="flex:1;">${top10LogText(q, e)}${e.manual ? ' <span class="pill">corretta a mano</span>' : ''}</span>${fix}</div>`;
  }).join('');
  const sc = scoringFor(round, idx);
  const nextQ = (round==='tiebreak') ? null : getQuestion(round, idx+1);
  return `
    <div class="card stack">
      <div class="qmeta">
        <span class="pill gold">${escapeHtml(top10RoundLabel(round, idx))}</span>
        <span class="pill">${escapeHtml(q.category)}</span>
        <span class="pill">${top10FoundCount(b)}/10 trovate</span>
      </div>
      <div class="top10-title">${escapeHtml(top10Title(q))}</div>
      ${q.adminNote ? `<p class="note">${escapeHtml(q.adminNote)}</p>` : ''}
      ${top10StatusLine(b)}
      <div class="row">${controls}</div>
      ${b.status!=='done' && state.phase==='question' ? '<button class="btn ghost small" id="btnCancelQuestion">Annulla classifica (nessun punto)</button>' : ''}
      <div class="eyebrow">Classifica completa · solo tu la vedi</div>
      <div class="top10-board admin">${items.map((it,i)=>{
        const f = top10FoundAt(b.found, i);
        return `<div class="top10-row ${f ? 'found' : b.revealed['i'+i] ? 'revealed' : 'pending'}">
          <span class="top10-pos">${i+1}</span>
          <span class="top10-item">${escapeHtml(it.name)}${it.value ? `<span class="top10-value">${escapeHtml(it.value)}</span>` : ''}${it.alts.length ? `<span class="top10-alts">anche: ${it.alts.map(escapeHtml).join(', ')}</span>` : ''}</span>
          ${f ? `<span class="top10-by">${teamNameHtml(f.t)}</span>` : b.revealed['i'+i] ? '<span class="top10-by missed">svelata</span>' : ''}
        </div>`;
      }).join('')}</div>
      <div class="divider"></div>
      <div class="eyebrow">Punteggio di questa classifica</div>
      <div class="row">
        <label class="stack">Punti × posizione<input type="text" inputmode="numeric" id="qsCorrect" value="${sc.correct}"></label>
        <label class="stack">Errore / tempo scaduto<input type="text" inputmode="numeric" id="qsWrong" value="${sc.wrong}"></label>
        <input type="hidden" id="qsNoAnswer" value="${sc.noAnswer}">
      </div>
      <button class="btn ghost small" id="btnApplyQuestionScoring">Applica solo a questa classifica</button>
    </div>
    <div class="card stack">
      <h3>Risposte</h3>
      ${logHtml || '<p class="muted">Ancora nessuna risposta.</p>'}
    </div>
    ${nextQ ? `<div class="card stack" style="opacity:.8;"><div class="eyebrow">Prossima classifica · solo tu la vedi</div><div style="font-weight:600;">🔟 ${escapeHtml(top10Title(nextQ))}</div></div>` : ''}`;
}
function renderTop10AdminTable(round, idx){
  const b = top10Board(round, idx);
  if(!b) return '';
  const cur = (b.status==='playing' || b.status==='paused') ? top10CurrentTeam(b) : null;
  return `
    <div class="card">
      <h3>Squadre in gioco</h3>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Squadra</th><th>Trovate</th><th>Punti</th></tr></thead><tbody>
      ${b.order.map((id,n)=>{
        const found = Object.keys(b.found).filter(k=>b.found[k] && b.found[k].t===id).length;
        return `<tr ${id===cur ? 'class="top10-current"' : ''}>
          <td>${n+1}${id===cur ? ' ▶' : ''}</td>
          <td><span style="color:${isTeamOnline(id)?'var(--green)':'var(--pink)'};">●</span> ${teamNameHtml(id)}</td>
          <td>${found}</td>
          <td>${teamPointsForQuestion(id, round, idx)} <button class="btn ghost small" data-adjust="-1" data-team="${id}">−</button><button class="btn ghost small" data-adjust="1" data-team="${id}">+</button></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
    </div>`;
}
let top10FocusTurn = '';
function attachTop10Handlers(){
  const form = document.getElementById('top10Form');
  const input = document.getElementById('top10Answer');
  if(!form || !input) return;
  input.oninput = ()=>{ top10Typed.text = input.value; };
  // Appena tocca a noi il cursore va nella casella; dopo, si mantiene il focus tra un aggiornamento e l'altro.
  const b = top10Board(state.round, state.qIndex);
  const turnKey = qkey(state.round, state.qIndex)+'#'+(b ? b.turn : '');
  if(top10FocusTurn!==turnKey || document.activeElement===document.body){
    top10FocusTurn = turnKey;
    input.focus();
    try{ input.setSelectionRange(input.value.length, input.value.length); }catch(e){}
  }
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const text = input.value.trim();
    if(!text || top10Pending) return;
    const round = state.round, idx = state.qIndex, key = qkey(round, idx);
    const turn = top10Board(round, idx).turn;
    top10Pending = true; render();
    const res = await teamTop10Submit(round, idx, text);
    top10Pending = false;
    if(res && res.kind==='dup'){
      top10MyFeedback = {key, turn, text:'«'+text+'» è già in classifica: provate con un\'altra voce.'};
    } else {
      top10MyFeedback = null;
    }
    if(res) top10Typed = {key, text:''};
    render();
  };
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
      const color = s.solutionRevealed ? (isAnswerCorrect(q, ans) ? 'var(--green)' : 'var(--pink)') : 'var(--ink)';
      answerHtml = `<div style="font-size:14px;margin-top:4px;color:${color};">${escapeHtml(answerText(q, ans))}</div>`;
    }
    return `<div class="card stack" style="padding:12px;">
      <div class="row" style="align-items:center;justify-content:space-between;">
        <b>${teamNameHtml(id)}</b>
        <span class="pill ${ans?'gold':''}">${statusLabel}</span>
      </div>
      ${answerHtml}
    </div>`;
  }).join('');
  // §20: con "Mostra sempre contenuto completo" (default) lo spettatore vede
  // la domanda anche quando la partita la tiene sul Display; mai i pulsanti.
  const p = s.presentation || {};
  const fullContent = q && p.displayStatus!=='preparing' && (sharedScreenConfig().spectatorContentMode==='always_full' || !sharedScreenActive());
  const contentHtml = fullContent ? `<div class="stack" style="text-align:left;">
      <div class="qtext">${escapeHtml(q.question)}</div>
      ${questionImageHtml(q)}
      <div class="options">${q.options.map((opt,i)=>`<div class="opt-static ${s.solutionRevealed && i===q.correctIndex ? 'correct' : ''}"><span class="letter">${letter(i)}</span><span>${escapeHtml(opt)}</span></div>`).join('')}</div>
    </div>` : '';
  return `<div class="card center stack">
    <div class="eyebrow pill gold">Modalità spettatore</div>
    <h2>Siete eliminati, seguite la finale 🍿</h2>
    ${contentHtml}
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
  const lateForThis = role==='team' && !teamEligibleForQuestion(teamId, round, idx);
  // Schermo condiviso (§13): sul telefono il contenuto comune non c'è, solo
  // lo stato e, a risposte aperte, i controlli. Display e regia vedono tutto.
  const p = state.presentation || {};
  const shared = role==='team' && active && sharedScreenActive();
  const ss = sharedScreenConfig();
  const roundLabelShort = round==='final' ? 'FINALE' : round==='tiebreak' ? 'SPAREGGIO' : `MANCHE ${round}`;
  const statusCard = (title, sub)=> `
      <div class="card stack">
        <div class="qmeta">
          <span class="pill gold">${roundLabelShort}</span>
          <span class="pill">Domanda ${idx+1}/${getList(round).length}</span>
        </div>
        <div class="status-banner">${title}</div>
        ${sub ? `<p class="muted center">${sub}</p>` : ''}
      </div>`;
  if(role==='team' && active && p.displayStatus==='preparing' && !p.fallbackActive) return statusCard('Prossima domanda in arrivo…', '');
  if(shared && timerIdle){
    const sub = p.autoUnlockAt ? `Le risposte si aprono tra <b id="autoUnlockCountdown">${Math.max(0, Math.ceil((p.autoUnlockAt - serverNow())/1000))}</b> secondi.`
      : p.unlockPolicy==='after_media' ? "Le risposte si aprono alla fine dell'audio." : 'Le risposte non sono ancora aperte.';
    return statusCard('📺 Guarda lo schermo condiviso', sub);
  }
  // Cosa mostra il telefono: deciso dalla domanda o dal tipo di attività (contentDistribution).
  let visibility = 'full';
  if(shared){
    const qv = q.presentation && q.presentation.teamContentVisibility;
    visibility = (qv && qv!=='auto') ? qv : (activityContract(q).contentDistribution.team || 'answers_only');
    if(visibility==='controller_only') visibility = 'answers_only'; // per le domande a scelta il controller sono i pulsanti
  }
  if(visibility==='hidden' && !myAnswer) return statusCard('📺 Seguite lo schermo condiviso', 'Questa attività si gioca sullo schermo.');
  const lettersOnly = shared && ss.teamOptionLabels==='letters';
  const timerKind = !shared ? 'circle' : ss.teamTimer==='hidden' ? 'none' : ss.teamTimer==='progress_only' ? 'bar' : 'circle';
  const instanceAttr = (getList(round)[idx] && getList(round)[idx].instanceId) || '';

  const optsDisabled = readOnly || !active || !!myAnswer || timerIdle || remaining<=0 || submitPending || lateForThis;
  let optionsHtml = q.options.map((opt,i)=>{
    let cls = 'opt' + (lettersOnly ? ' letter-only' : '');
    if(myAnswer && myAnswer.optionIndex===i) cls += ' selected';
    if(showCorrectness){
      if(i===q.correctIndex) cls += ' correct';
      else if(myAnswer && myAnswer.optionIndex===i && i!==q.correctIndex) cls += ' wrong';
    }
    return `<button class="${cls}" data-idx="${i}" data-instance="${escapeHtml(instanceAttr)}" ${optsDisabled?'disabled':''}>
      <span class="letter">${letter(i)}</span>${lettersOnly ? '' : `<span>${escapeHtml(opt)}</span>`}
    </button>`;
  }).join('');

  let banner = '';
  if(lateForThis) banner = `<div class="status-banner">Siete entrati a domanda già aperta: partecipate dalla prossima.</div>`;
  else if(submitPending) banner = `<div class="status-banner">Invio in corso...</div>`;
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

  // PL-17: trasparenza sulla fascia congelata (PL-15) PRIMA di rispondere,
  // mai scoperta solo a cose fatte — stesso principio di scoringPill sopra.
  // Solo per il profilo dinamico/personalizzato, e solo quando la fascia è
  // già stata calcolata (openQuestionWithSnapshot/adminStartGame ecc.).
  let riskPill = '', comebackPill = '';
  if(active && round!=='tiebreak'){
    const profile = state.config && state.config.scoringProfile;
    const band = (profile && profile!=='classico' && q.leaderboardBands) ? q.leaderboardBands[teamId] : null;
    if(band){
      riskPill = `<span class="pill" style="color:var(--pink);">⚠ Rischio errore ×${band.errorMultiplier.toFixed(2)}</span>`;
      if(band.comebackBonusPercent>0){
        comebackPill = `<span class="pill" style="color:var(--green);">📈 Bonus rimonta +${band.comebackBonusPercent}%</span>`;
      }
    }
  }

  // PL-19 (consolidamento audio, "gestione errori lato squadra"): l'audio
  // vero e proprio parte solo su admin/Display, ma la squadra vede comunque
  // lo stato — incluso un fallback esplicito se il file non è disponibile,
  // invece di restare in attesa di un audio che non arriverà mai.
  let audioStatusPill = '';
  if(active && q.audioUrl && role==='team'){
    const cueFailed = state.audioCue && state.audioCue.loadFailed;
    audioStatusPill = cueFailed
      ? `<span class="pill" style="color:var(--pink);">⚠ Audio non disponibile</span>`
      : `<span class="pill">🎵 Audio in riproduzione sullo schermo condiviso</span>`;
  }

  return `
    <div class="card stack">
      <div class="qmeta">
        <span class="pill gold">${roundLabel}</span>
        <span class="pill">Domanda ${idx+1}/${getList(round).length}</span>
        <span class="pill">${escapeHtml(q.category)}</span>
        ${active ? `<span class="pill">✓ ${answeredCount}/${activeIds.length} risposto</span>` : ''}
        ${scoringPill}
        ${speedBonusPill}
        ${riskPill}
        ${comebackPill}
        ${audioStatusPill}
      </div>
      ${active && timerKind!=='none' ? `<div class="timer-wrap"><div id="timerSlot" data-kind="${timerKind}">${timerSlotContent(timerKind, remaining, state.timer.durationMs)}</div></div>` : ''}
      ${visibility==='answers_only' ? `<div class="eyebrow">${active && !timerIdle ? 'Scegliete la risposta' : 'La domanda è sullo schermo condiviso'}</div>` : `<div class="qtext">${escapeHtml(q.question)}</div>
      ${questionImageHtml(q)}`}
      <div class="options ${lettersOnly ? 'letters-grid' : ''}">${optionsHtml}</div>
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
      await teamSubmitAnswer(round, qIdx, idx, btn.getAttribute('data-instance') || null);
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
      </div>
      ${renderRulesCard()}`;
  }
  else if((s.phase==='question' || s.phase==='closed') && isTop10(getQuestion(s.round, s.qIndex))){
    body = renderTop10Play(s.round, s.qIndex, 'display');
  }
  else if(s.phase==='question' && !inTiebreak && (s.presentation||{}).displayStatus==='preparing'){
    // §9 fase 1: la domanda è ancora privata della regia.
    const lbl = s.round==='final' ? 'Finale' : 'Manche '+s.round;
    body = `<div class="card center stack">
      <div class="eyebrow pill gold">${escapeHtml(lbl)} · domanda ${s.qIndex+1}/${getList(s.round).length}</div>
      <h2>Prossima domanda in arrivo…</h2>
    </div>`;
  }
  else if(s.phase==='question' && !inTiebreak){
    body = renderTeamQuestion(s.round, s.qIndex, true, false, true);
  }
  else if((s.phase==='question' || s.phase==='closed') && inTiebreak){
    body = renderTiebreakWaitCard(s);
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
      <div class="eyebrow">${brandName()} · Display</div>
      ${connectionBadge()}
    </div>
    ${body}
    ${renderPartyRevealCards()}
    ${audioUnlockOverlayHtml()}
  `;
  wireAudioUnlockOverlay();
  playPendingAudioCueIfAny();
  reportDisplaySync();
}
/* §19: il Display conferma la revisione che ha sullo schermo e se i media
   (immagini, audio della domanda) sono caricati. */
function reportDisplaySync(){
  if(role!=='display' || !state) return;
  const p = state.presentation || {};
  const q = (state.phase==='question' || state.phase==='closed') ? getQuestion(state.round, state.qIndex) : null;
  const imgs = Array.from(document.querySelectorAll('#app img'));
  imgs.forEach(img=>{ if(!img.complete) img.addEventListener('load', reportDisplaySync, {once:true}); });
  const imagesReady = imgs.every(img=>img.complete);
  const el = document.getElementById('gameAudioEl');
  const audioNeeded = !!(q && q.audioUrl && p.displayStatus==='visible');
  const audioFailed = !!(state.audioCue && state.audioCue.loadFailed);
  const audioReady = !audioNeeded || audioFailed || (el && el.readyState>=3);
  if(audioNeeded && !audioReady && el) el.addEventListener('canplay', reportDisplaySync, {once:true});
  reportDisplayStatus({revision: p.revision || 0, mediaReady: imagesReady && audioReady});
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
/* PL-12 (item 13): 4 preset dichiarati dal piano (§4.1) — "Personalizzata" non
   ha un bottone dedicato: è già lo stato di default del form (tutti i campi
   liberamente modificabili), coerente con "nessun nuovo motore, solo default
   diversi". "Tutti contro tutti" ("nessuna squadra eliminata nell'ultima
   manche") riusa il ramo già esistente in adminRevealFinalists
   (ranked.length<=finalistCount ⇒ nessuno escluso) impostando un
   finalistCount molto alto, invece di introdurre un nuovo motore di gioco. */
const BUILTIN_CONFIG_PRESETS = [
  {id:'classica', label:'Serata classica', values:{rounds:2, questionsPerRound:15, finalistCount:2, finalQuestionCount:10, scoreCarryover:'reset'}},
  {id:'rapida', label:'Partita rapida', values:{rounds:1, questionsPerRound:10, finalistCount:2, finalQuestionCount:5, scoreCarryover:'reset'}},
  {id:'tutti_contro_tutti', label:'Tutti contro tutti', values:{rounds:2, questionsPerRound:15, finalistCount:999, finalQuestionCount:10, scoreCarryover:'keep'}},
  // Una classifica per manche (a ogni manche parte la squadra successiva), finale a due sull'ultima classifica.
  {id:'topdieci', label:'🔟 Top Dieci', values:{gameType:'topdieci', gameName:'Top Dieci', rounds:4, questionsPerRound:1, finalistCount:2, finalQuestionCount:1, scoreCarryover:'keep', top10:{maxLaps:3, turnSeconds:30}}}
];
const GAME_TYPE_LABELS = {quiz:'Quiz classico', topdieci:'Top Dieci (classifiche a turno)'};
/* Scrive i valori di un preset (built-in o salvato) direttamente sui campi
   del form, senza un render() completo: stesso principio già usato per
   btnToggleAdvancedSetup, per non perdere altre modifiche non ancora
   salvate. Accetta sia i valori parziali dei preset built-in sia un intero
   "patch" salvato da adminSaveConfigPreset (stessa forma, superset di campi). */
function applyPresetValuesToForm(values){
  const byId = id=>document.getElementById(id);
  const hasAdvanced = values.scoreCarryover || (values.tiebreakRule && values.tiebreakRule.final) ||
    values.answerVisibilityForEliminated || values.blockDuplicateQuestions!=null || values.speedBonus ||
    ('finalScoring' in values) || values.scoringProfile;
  if(hasAdvanced && !showAdvancedSetup){
    showAdvancedSetup = true;
    byId('salaAdvancedSection').style.display = 'flex';
    byId('btnToggleAdvancedSetup').textContent = '▲ Nascondi impostazioni avanzate';
  }
  if(values.rounds!=null) byId('setupRounds').value = values.rounds;
  // I preset built-in dichiarano un numero semplice (una sola manche di
  // riferimento); i preset salvati da adminSaveConfigPreset portano invece
  // l'array già espanso per manche (stessa forma del patch di
  // adminSaveSetup, es. [7,7,7]) — il form ha un solo campo "domande per
  // manche", quindi si legge sempre il primo valore.
  if(values.questionsPerRound!=null){
    const qpr = Array.isArray(values.questionsPerRound) ? values.questionsPerRound[0] : values.questionsPerRound;
    byId('setupQuestionsPerRound').value = qpr;
  }
  if(values.finalistCount!=null) byId('setupFinalistCount').value = values.finalistCount;
  if(values.finalQuestionCount!=null) byId('setupFinalQuestionCount').value = values.finalQuestionCount;
  if(values.questionDurationMs!=null) byId('setupQuestionDuration').value = Math.round(values.questionDurationMs/1000);
  if(values.scoring){
    byId('setupScoringCorrect').value = values.scoring.correct;
    byId('setupScoringWrong').value = values.scoring.wrong;
    byId('setupScoringNoAnswer').value = values.scoring.noAnswer;
  }
  if(values.timerStartMode) byId('setupTimerStartMode').value = values.timerStartMode;
  if(values.displayMode) byId('setupDisplayMode').value = values.displayMode;
  if(values.sharedScreen){
    const ss = values.sharedScreen;
    if(ss.answerUnlockPolicy) byId('setupUnlockPolicy').value = ss.answerUnlockPolicy;
    if(ss.readingDelayMs) byId('setupReadingDelay').value = Math.round(ss.readingDelayMs/1000);
    if(ss.teamTimer) byId('setupTeamTimer').value = ss.teamTimer;
    if(ss.teamOptionLabels) byId('setupTeamOptionLabels').value = ss.teamOptionLabels;
    if(ss.emergency) byId('setupEmergency').value = ss.emergency;
    if(ss.spectatorContentMode) byId('setupSpectatorContent').value = ss.spectatorContentMode;
    if(ss.prepareStep!=null) byId('setupPrepareStep').checked = ss.prepareStep!==false;
  }
  if(values.scoringProfile) byId('setupScoringProfile').value = values.scoringProfile;
  if(values.tiebreakRule){
    if(values.tiebreakRule.qualification) byId('setupTiebreakQualification').value = values.tiebreakRule.qualification;
    if(values.tiebreakRule.final) byId('setupTiebreakFinal').value = values.tiebreakRule.final;
  }
  if(values.lateJoin && values.lateJoin.policy) byId('setupLateJoinPolicy').value = values.lateJoin.policy;
  if(values.scoreCarryover) byId('setupScoreCarryover').value = values.scoreCarryover;
  if(values.answerVisibilityForEliminated) byId('setupAnswerVisibility').value = values.answerVisibilityForEliminated;
  if(values.blockDuplicateQuestions!=null) byId('setupBlockDuplicates').checked = values.blockDuplicateQuestions;
  if(values.speedBonus){
    byId('setupSpeedBonusEnabled').checked = values.speedBonus.enabled;
    byId('setupSpeedBonusMax').value = values.speedBonus.maxBonus;
    byId('setupSpeedBonusWindow').value = Math.round((values.speedBonus.windowMs||0)/1000);
  }
  if('finalScoring' in values){
    byId('setupFinalScoringEnabled').checked = !!values.finalScoring;
    if(values.finalScoring){
      byId('setupFinalScoringCorrect').value = values.finalScoring.correct;
      byId('setupFinalScoringWrong').value = values.finalScoring.wrong;
      byId('setupFinalScoringNoAnswer').value = values.finalScoring.noAnswer;
    }
  }
  if(values.top10){
    byId('setupTop10MaxLaps').value = values.top10.maxLaps;
    byId('setupTop10TurnSeconds').value = values.top10.turnSeconds;
  }
  if(values.gameType) byId('setupGameType').value = values.gameType;
  if(values.gameName) byId('setupGameName').value = values.gameName;
  // Valori impostati da codice: vanno trattati come modifiche non salvate,
  // altrimenti il prossimo aggiornamento Firebase li riporterebbe indietro.
  markFieldsDirty('setup');
}
/* Raccoglie il patch dallo stato ATTUALE del form (stessa forma passata ad
   adminSaveSetup). Fattorizzata da dentro l'handler di btnSaveSetup così può
   essere riusata anche per "Salva come preset". includeAdvancedAlways=true
   (usato solo dal salvataggio preset) legge sempre i campi avanzati, anche a
   sezione chiusa: un preset è un'istantanea a sé stante, non ha uno stato
   "già salvato" da preservare come invece succede nel salvataggio normale
   (dove il comportamento originale — non toccare i campi avanzati se la
   sezione non è mai stata aperta in questa sessione — resta invariato). */
function collectSetupPatchFromForm(includeAdvancedAlways){
  const byId = id=>document.getElementById(id);
  const intVal = id => parseInt(byId(id).value, 10);
  const rounds = intVal('setupRounds') || 1;
  const perRound = intVal('setupQuestionsPerRound') || 1;
  const patch = {
    gameType: byId('setupGameType').value,
    top10: {
      maxLaps: Math.max(0, intVal('setupTop10MaxLaps') || 0),
      turnSeconds: Math.max(5, intVal('setupTop10TurnSeconds') || 30)
    },
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
    timerStartMode: byId('setupTimerStartMode').value,
    displayMode: byId('setupDisplayMode').value,
    sharedScreen: {
      ...DEFAULT_SHARED_SCREEN,
      answerUnlockPolicy: byId('setupUnlockPolicy').value,
      readingDelayMs: (intVal('setupReadingDelay') || 5) * 1000,
      teamTimer: byId('setupTeamTimer').value,
      teamOptionLabels: byId('setupTeamOptionLabels').value,
      emergency: byId('setupEmergency').value,
      spectatorContentMode: byId('setupSpectatorContent').value,
      prepareStep: byId('setupPrepareStep').checked
    }
  };
  if(includeAdvancedAlways || showAdvancedSetup){
    patch.scoringProfile = byId('setupScoringProfile').value;
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
  return patch;
}
/* Modale generico per nominare un preset da salvare (PL-12), stesso stile di
   showRenameTeamModal: niente window.prompt nativo. */
function showSavePresetModal(onSave){
  const existing = document.getElementById('savePresetOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'savePresetOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;';
  overlay.innerHTML = `
    <div class="card stack" style="max-width:360px;margin:20px;">
      <h3>Salva preset</h3>
      <input type="text" id="savePresetInput" maxlength="40" placeholder="Nome del preset">
      <div class="row">
        <button class="btn" id="savePresetConfirm">Salva</button>
        <button class="btn ghost" id="savePresetCancel">Annulla</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById('savePresetInput');
  input.focus();
  const confirmSave = ()=>{
    const val = input.value.trim();
    overlay.remove();
    if(val) onSave(val);
  };
  document.getElementById('savePresetConfirm').onclick = confirmSave;
  document.getElementById('savePresetCancel').onclick = ()=> overlay.remove();
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') confirmSave(); });
}
/* Riepilogo testuale prima dello start (PL-12, item 12): l'ultimo momento
   utile per accorgersi di una regola sbagliata prima che la config si blocchi
   (setupLocked). Solo lettura, nessun campo modificabile qui: per correggere
   si annulla e si torna al form. */
function showStartSummaryModal(cfg, onConfirm){
  const existing = document.getElementById('startSummaryOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'startSummaryOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;';
  const displayModeLabels = {team_devices:'sui telefoni', shared_screen:'schermo condiviso', hybrid:'mista'};
  const unlockLabels = {manual:'manuale', immediate:'immediata', delayed:'dopo il tempo di lettura', after_media:"a fine audio"};
  const ss = {...DEFAULT_SHARED_SCREEN, ...(cfg.sharedScreen||{})};
  const mancheNeeded = (cfg.questionsPerRound||[]).reduce((a,b)=>a+b, 0);
  const mancheFresh = freshQuestionCount('manche'), finaleFresh = freshQuestionCount('finale');
  const carryoverLabels = {reset:'azzerati', keep:'mantenuti', convert:'convertiti'};
  const profileLabels = {classico:'Classico', dinamico:'Dinamico (bonus per ordine, penalità a fasce, bonus rimonta)', personalizzato:'Personalizzato'};
  const lines = [
    `Gioco: ${GAME_TYPE_LABELS[cfg.gameType||'quiz']||cfg.gameType}` + (cfg.gameType==='topdieci' ? ` (${cfg.top10.maxLaps ? cfg.top10.maxLaps+' giri' : 'giri illimitati'}, ${cfg.top10.turnSeconds}s per turno)` : ''),
    `${cfg.rounds} manche di qualificazione da ${cfg.questionsPerRound[0]||0} domande`,
    `Finale: ${cfg.finalistCount} finalisti, ${cfg.finalQuestionCount} domande`,
    `Punteggio: corretta +${cfg.scoring.correct}, sbagliata ${cfg.scoring.wrong}, non data ${cfg.scoring.noAnswer} (profilo: ${profileLabels[cfg.scoringProfile]||cfg.scoringProfile||'Classico'})`,
    `Timer: ${Math.round(cfg.questionDurationMs/1000)}s, avvio ${cfg.timerStartMode==='manual'?'manuale':'automatico'}`,
    `Presentazione: ${displayModeLabels[cfg.displayMode]||cfg.displayMode}` + (cfg.displayMode && cfg.displayMode!=='team_devices'
      ? `, apertura risposte ${unlockLabels[ss.answerUnlockPolicy]||ss.answerUnlockPolicy} · Display ${displayReady() ? 'connesso' : 'NON connesso: finché non lo apri le domande vanno sui telefoni'}` : ''),
    mancheFresh>=mancheNeeded && finaleFresh>=cfg.finalQuestionCount
      ? `Mazzo: tutte domande mai giocate`
      : `⚠ Mazzo: ${mancheFresh}/${mancheNeeded} domande nuove per le manche, ${finaleFresh}/${cfg.finalQuestionCount} per la finale: le mancanti saranno riprese tra quelle già giocate`,
    `Punti in ingresso finale: ${carryoverLabels[cfg.scoreCarryover]||cfg.scoreCarryover}`
  ];
  overlay.innerHTML = `
    <div class="card stack" style="max-width:420px;margin:20px;">
      <h3>Riepilogo partita</h3>
      <ul style="margin:0;padding-left:18px;">
        ${lines.map(l=>`<li>${escapeHtml(l)}</li>`).join('')}
      </ul>
      <div class="row">
        <button class="btn" id="startSummaryConfirm">Avvia Manche 1</button>
        <button class="btn ghost" id="startSummaryCancel">Annulla</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('startSummaryConfirm').onclick = ()=>{ overlay.remove(); onConfirm(); };
  document.getElementById('startSummaryCancel').onclick = ()=> overlay.remove();
}
/* §26: opzioni dello schermo condiviso. Valgono quando una domanda è
   risolta sul Display; senza Display tutto resta come sempre. */
function renderSharedScreenSetup(s, cfg){
  const ss = {...DEFAULT_SHARED_SCREEN, ...(cfg.sharedScreen||{})};
  const dis = s.setupLocked ? 'disabled' : '';
  const sel = (id, value, options)=> `<select id="${id}" ${dis}>${options.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${label}</option>`).join('')}</select>`;
  return `<div class="stack shared-setup">
    <div class="eyebrow">Con lo schermo condiviso</div>
    <div class="row">
      <label class="stack">Apertura risposte${sel('setupUnlockPolicy', ss.answerUnlockPolicy, [['manual','Manualmente (premi "Apri risposte")'],['immediate','Immediatamente'],['delayed','Dopo il tempo di lettura'],['after_media','A fine audio (o manualmente)']])}</label>
      <label class="stack">Tempo di lettura${sel('setupReadingDelay', Math.round(ss.readingDelayMs/1000), [[3,'3 secondi'],[5,'5 secondi'],[8,'8 secondi'],[10,'10 secondi']])}</label>
    </div>
    <div class="row">
      <label class="stack">Timer sui telefoni${sel('setupTeamTimer', ss.teamTimer, [['visible','Visibile'],['progress_only','Solo barra'],['hidden','Nascosto']])}</label>
      <label class="stack">Pulsanti sui telefoni${sel('setupTeamOptionLabels', ss.teamOptionLabels, [['letters_text','Lettere + testo'],['letters','Solo lettere']])}</label>
    </div>
    <div class="row">
      <label class="stack">Emergenza Display${sel('setupEmergency', ss.emergency, [['confirm','Chiedi sempre conferma'],['allow','Consenti il passaggio automatico ai telefoni'],['block_incompatible','Blocca le attività solo-schermo']])}</label>
      <label class="stack">Spettatori${sel('setupSpectatorContent', ss.spectatorContentMode, [['always_full','Mostra sempre il contenuto completo'],['follow_session','Segui la modalità della partita']])}</label>
    </div>
    <label class="row" style="align-items:center;"><input type="checkbox" id="setupPrepareStep" ${ss.prepareStep!==false?'checked':''} ${dis}> Prepara ogni domanda in privato e mostrala con "Mostra domanda"</label>
  </div>`;
}
function renderSalaPrePartita(s, cfg){
  const questionsPerRound = cfg.questionsPerRound[0] || 15;
  const tieOptions = [
    ['prima_corretta','Prima risposta corretta'],
    ['oltranza','Spareggio a oltranza'],
    ['corretta_veloce','Corretta più veloce']
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
      ${!s.setupLocked ? `
      <div class="eyebrow">Preset di partita</div>
      <div class="row">
        ${BUILTIN_CONFIG_PRESETS.map(p=>`<button class="btn ghost small" data-builtin-preset="${p.id}">${escapeHtml(p.label)}</button>`).join('')}
      </div>
      ${Object.keys(presets).length ? `<div class="stack">
        ${Object.keys(presets).map(id=>{
          const p = presets[id];
          return `<div class="row" style="align-items:center;">
            <span style="flex:1;">${escapeHtml(p.name)}</span>
            <button class="btn ghost small" data-load-preset="${id}">Carica</button>
            <button class="btn ghost small" data-delete-preset="${id}">Elimina</button>
          </div>`;
        }).join('')}
      </div>` : ''}
      <p class="note" id="salaPresetNote">${escapeHtml(salaPresetNoteText)}</p>
      <button class="btn ghost small" id="btnSaveAsPreset">💾 Salva impostazioni attuali come preset</button>
      <div class="divider"></div>
      ` : ''}
      <label class="stack">Nome partita<input type="text" id="setupGameName" value="${escapeHtml(s.gameName)}" ${s.setupLocked?'disabled':''}></label>
      <label class="stack">Tipo di gioco<select id="setupGameType" ${s.setupLocked?'disabled':''}>${Object.keys(GAME_TYPE_LABELS).map(v=>`<option value="${v}" ${v===(cfg.gameType||'quiz')?'selected':''}>${GAME_TYPE_LABELS[v]}</option>`).join('')}</select></label>
      <div class="row">
        <label class="stack">Top Dieci: giri per classifica (0 = finché non è completa)<input type="text" inputmode="numeric" id="setupTop10MaxLaps" value="${cfg.top10.maxLaps}" ${s.setupLocked?'disabled':''}></label>
        <label class="stack">Top Dieci: secondi per turno<input type="text" inputmode="numeric" id="setupTop10TurnSeconds" value="${cfg.top10.turnSeconds}" ${s.setupLocked?'disabled':''}></label>
      </div>
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
      <label class="stack">Dove verranno mostrate le domande?<select id="setupDisplayMode" ${s.setupLocked?'disabled':''}>
        <option value="team_devices" ${(cfg.displayMode||'team_devices')==='team_devices'?'selected':''}>Sui telefoni (senza schermo condiviso)</option>
        <option value="shared_screen" ${cfg.displayMode==='shared_screen'?'selected':''}>Sullo schermo condiviso (i telefoni fanno da pulsantiera)</option>
        <option value="hybrid" ${cfg.displayMode==='hybrid'?'selected':''}>Modalità mista (decide ogni domanda)</option>
      </select></label>
      ${renderSharedScreenSetup(s, cfg)}

      <button class="btn ghost small" id="btnToggleAdvancedSetup">${showAdvancedSetup?'▲ Nascondi impostazioni avanzate':'▼ Impostazioni avanzate'}</button>
      <div id="salaAdvancedSection" style="display:${showAdvancedSetup?'flex':'none'};flex-direction:column;gap:10px;">
        <div class="divider"></div>
        <label class="stack">Profilo di scoring<select id="setupScoringProfile" ${s.setupLocked?'disabled':''}>
          <option value="classico" ${(cfg.scoringProfile||'classico')==='classico'?'selected':''}>Classico (punteggio fisso, come oggi)</option>
          <option value="dinamico" ${cfg.scoringProfile==='dinamico'?'selected':''}>Dinamico (bonus per ordine + penalità a fasce + bonus rimonta)</option>
          <option value="personalizzato" ${cfg.scoringProfile==='personalizzato'?'selected':''}>Personalizzato (come Dinamico, con le tabelle della partita)</option>
        </select></label>
        <p class="muted" style="font-size:12px;">"Dinamico": chi risponde giusto prima prende un bonus, chi è in testa rischia un malus più alto e chi è indietro prende un bonus rimonta. Le squadre vedono il loro rischio prima di rispondere.</p>
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
/* render() ricostruisce il pannello admin a ogni aggiornamento Firebase (una
   squadra che entra, una risposta…): senza questo, quello che l'admin sta
   scrivendo e non ha ancora salvato sparirebbe. I valori modificati vengono
   rimessi nei campi ridisegnati, con focus e cursore. Ogni gruppo di campi ha
   un suo contesto: i campi del punteggio di una domanda non "migrano" alla
   domanda successiva. I file scelti non si possono reimpostare in un <input
   type=file>, quindi restano in memoria (pendingFiles). */
const dirtyFields = {};
const pendingFiles = {};
let dirtyTrackingBound = false;
function formFieldContext(id){
  if(!state) return '';
  if(id.startsWith('qs')) return ['q', state.phase==='closed'?'question':state.phase, state.round, state.qIndex].join('|');
  if(id.startsWith('setup')) return 'setup|' + (state.setupLocked ? 'locked' : 'open');
  return 'global';
}
function bindDirtyTrackingOnce(){
  if(dirtyTrackingBound) return;
  dirtyTrackingBound = true;
  const track = e=>{
    const el = e.target;
    const app = document.getElementById('app');
    if(role!=='admin' || !el || !el.id || !app || !app.contains(el)) return;
    if(!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if(el.type==='file'){ pendingFiles[el.id] = el.files && el.files[0] ? el.files[0] : null; return; }
    dirtyFields[el.id] = {value: el.type==='checkbox' ? el.checked : el.value, ctx: formFieldContext(el.id)};
  };
  document.addEventListener('input', track, true);
  document.addEventListener('change', track, true);
}
function markFieldsDirty(prefix){
  document.querySelectorAll('#app [id^="'+prefix+'"]').forEach(el=>{
    if(!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.type==='file') return;
    dirtyFields[el.id] = {value: el.type==='checkbox' ? el.checked : el.value, ctx: formFieldContext(el.id)};
  });
}
function forgetDirty(prefixOrIds){
  const list = Array.isArray(prefixOrIds) ? prefixOrIds : null;
  Object.keys(dirtyFields).forEach(id=>{ if(list ? list.includes(id) : id.startsWith(prefixOrIds)) delete dirtyFields[id]; });
  Object.keys(pendingFiles).forEach(id=>{ if(list ? list.includes(id) : id.startsWith(prefixOrIds)) delete pendingFiles[id]; });
}
function pickedFile(id){
  const el = document.getElementById(id);
  return (el && el.files && el.files[0]) || pendingFiles[id] || null;
}
function captureAdminFocus(){
  const a = document.activeElement;
  const app = document.getElementById('app');
  if(!a || !a.id || !app || !app.contains(a) || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return null;
  let start = null, end = null;
  try{ start = a.selectionStart; end = a.selectionEnd; }catch(e){}
  return {id:a.id, start, end};
}
function restoreAdminFormState(focus){
  Object.keys(dirtyFields).forEach(id=>{
    const d = dirtyFields[id];
    if(d.ctx !== formFieldContext(id)){ delete dirtyFields[id]; return; }
    const el = document.getElementById(id);
    if(!el) return;
    if(el.type==='checkbox') el.checked = d.value; else el.value = d.value;
  });
  Object.keys(pendingFiles).forEach(id=>{
    const el = document.getElementById(id);
    const f = pendingFiles[id];
    if(el && f && !(el.files && el.files[0])){
      el.insertAdjacentHTML('afterend', `<p class="note" data-pending-file="${escapeHtml(id)}">File scelto: ${escapeHtml(f.name)}</p>`);
    }
  });
  // I campi che mostrano/nascondono altre parti del form vanno risincronizzati.
  ['qmAnswerType','qmContentType'].forEach(id=>{ const el = document.getElementById(id); if(el && dirtyFields[id] && el.onchange) el.onchange(); });
  if(focus){
    const el = document.getElementById(focus.id);
    if(el){
      el.focus();
      try{ if(focus.start!=null) el.setSelectionRange(focus.start, focus.end); }catch(e){}
    }
  }
}
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

/* ================== REGIA · SCHERMO CONDIVISO (§11, §27) ================== */
const PRESENTATION_MODE_LABELS = {team_devices:'Sui telefoni', shared_screen:'Schermo condiviso', blocked:'Ferma: serve lo schermo condiviso'};
const PRESENTATION_SOURCE_LABELS = {partita:'impostazione della partita', domanda:'scelta della domanda', requisito:"richiesto dall'attività", display_assente:'Display non pronto all\'apertura'};
const FALLBACK_REASON_LABELS = {manual:"scelta dell'admin", display_disconnect:'Display disconnesso', display_required_missing:'variante sui telefoni'};
function renderDisplayStatusLine(){
  const d = displaySyncStatus();
  if(!d.connected) return '<span style="color:var(--pink);">○ Non connesso</span>';
  const p = (state && state.presentation) || {};
  const sync = p.displayStatus==='preparing' ? 'pronto, in attesa della domanda' : d.synced ? (d.mediaReady ? 'Sincronizzato ✓' : 'Sta caricando i media…') : 'Sincronizzazione in corso…';
  return `<span style="color:var(--green);">● Connesso</span> · ${d.audioUnlocked ? 'Audio attivo' : 'Audio non attivato'} · ${sync}`;
}
function renderPresentationPanel(s, q, t){
  const p = s.presentation || {};
  const shared = p.resolvedMode==='shared_screen' && !p.fallbackActive;
  const d = displaySyncStatus();
  const blocked = p.resolvedMode==='blocked';
  const preparing = p.displayStatus==='preparing';
  const modeText = p.fallbackActive
    ? `Sui telefoni · fallback (${FALLBACK_REASON_LABELS[p.fallbackReason] || p.fallbackReason || 'manuale'})`
    : `${PRESENTATION_MODE_LABELS[p.resolvedMode] || 'Sui telefoni'}${p.source ? ' · '+(PRESENTATION_SOURCE_LABELS[p.source] || p.source) : ''}`;
  const questionText = blocked ? 'In attesa: non è stata mostrata' : preparing ? 'In preparazione: la vedi solo tu' : shared ? 'Visibile sul Display' : 'Visibile sui telefoni';
  const answersText = t.closed ? 'Chiuse' : t.idle
    ? (p.autoUnlockAt ? `Si aprono da sole tra <b id="autoUnlockCountdown">${Math.max(0, Math.ceil((p.autoUnlockAt - serverNow())/1000))}</b> s` : p.unlockPolicy==='after_media' ? "Si aprono alla fine dell'audio" : 'Bloccate')
    : t.paused ? 'Aperte · timer in pausa' : 'Aperte';
  const statusRows = [
    ['Modalità', modeText],
    ['Display', `<span id="displayStatusSlot">${renderDisplayStatusLine()}</span>`],
    ['Domanda', questionText],
    ['Risposte', answersText]
  ].map(([k,v])=>`<div class="pres-row"><span class="muted">${k}</span><span>${v}</span></div>`).join('');

  let warning = '';
  if(!t.closed){
    if(blocked){
      warning = `<div class="status-banner expired">Questa attività richiede uno schermo condiviso.${d.connected ? ' Il Display è di nuovo pronto.' : ''}</div>
        <div class="row">
          <button class="btn ${d.connected?'':'secondary'}" id="btnRetryDisplay" ${d.connected?'':'disabled'}>${d.connected ? '📺 Usa il Display' : 'Attendi riconnessione…'}</button>
          <button class="btn ghost small" id="btnSkipActivity">Salta attività</button>
          ${teamVariantAllowed(q) ? '<button class="btn ghost small" id="btnUseTeamVariant">Usa variante sui telefoni</button>' : ''}
        </div>`;
    } else if(p.source==='display_assente' && !p.fallbackActive){
      warning = `<div class="status-banner">⚠ Il Display non era pronto all'apertura: questa domanda è sui telefoni.</div>`;
    } else if(shared && !d.connected){
      const auto = sharedScreenConfig().emergency==='allow' && p.requirement!=='required';
      warning = `<div class="status-banner expired">Display disconnesso. ${t.idle ? 'Le risposte sono ancora chiuse.' : 'Il timer continua.'}${auto ? ' Se non torna, la domanda passa da sola sui telefoni.' : ''}</div>
        <div class="row">
          ${p.requirement!=='required' ? '<button class="btn small" id="btnActivateTeamFallback">Mostra domanda sui telefoni</button>' : '<span class="muted">Attività solo su schermo: metti in pausa o annullala.</span>'}
          ${t.idle ? '<button class="btn ghost small" id="btnSkipActivity">Salta</button>' : '<span class="muted">Puoi anche mettere in pausa qui sotto.</span>'}
        </div>`;
    }
  }

  let controls = '';
  if(!t.closed && !blocked){
    const mediaBlock = shared && p.requirement==='required' && !d.mediaReady;
    controls = `<div class="row">
      ${preparing ? '<button class="btn" id="btnShowQuestion">📺 Mostra domanda</button><button class="btn ghost small" id="btnActivateTeamFallback">Mostra direttamente sui telefoni</button>' : ''}
      ${!preparing && t.idle ? `<button class="btn" id="btnStartTimer" ${mediaBlock?'disabled':''}>${shared || p.resolvedMode==='shared_screen' ? '🔓 Apri risposte e avvia timer' : '▶ Avvia timer'}</button>` : ''}
      ${!preparing && t.idle && mediaBlock ? '<button class="btn ghost small" id="btnStartTimerAnyway">Apri comunque</button>' : ''}
      ${!preparing && t.idle && p.autoUnlockAt ? '<button class="btn ghost small" id="btnDelayUnlock">+5 s di lettura</button><button class="btn ghost small" id="btnCancelAutoUnlock">Apri a mano</button>' : ''}
      ${!preparing && t.idle && shared && !(warning) ? '<button class="btn ghost small" id="btnActivateTeamFallback">Mostra anche sui telefoni</button>' : ''}
      ${p.fallbackActive && p.resolvedMode==='shared_screen' && d.connected ? '<button class="btn ghost small" id="btnRestoreSharedScreen">Ripristina modalità schermo</button>' : ''}
      ${!t.idle && s.timer.status==='running' ? '<button class="btn secondary small" id="btnPauseTimer">⏸ Pausa</button>' : ''}
      ${t.paused ? '<button class="btn secondary small" id="btnResumeTimer">▶ Riprendi</button>' : ''}
      ${!t.idle ? '<button class="btn ghost small" id="btnTimerMinus5">-5s</button><button class="btn ghost small" id="btnTimerPlus5">+5s</button>' : ''}
    </div>`;
  }
  const showStatus = (s.config && s.config.displayMode && s.config.displayMode!=='team_devices') || p.resolvedMode!=='team_devices' || d.connected;
  return `
    ${showStatus ? `<div class="pres-status">${statusRows}</div>` : ''}
    ${warning}
    ${!t.closed ? `<div class="timer-wrap"><div id="timerSlot">${circleTimer(t.remaining, s.timer.durationMs)}</div>${t.idle && !shared && !preparing && !blocked ? '<div class="pill">In attesa di avvio</div>' : ''}${t.paused ? '<div class="pill">⏸ In pausa</div>' : ''}</div>` : ''}
    ${controls}`;
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
  else if((s.phase==='question' || s.phase==='closed') && isTop10(getQuestion(s.round, s.qIndex))){
    controlPanel = renderTop10Admin(s.round, s.qIndex);
    liveTable = renderTop10AdminTable(s.round, s.qIndex);
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
    // Stato e comandi di presentazione/sblocco/timer: renderPresentationPanel().

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
        ${renderPresentationPanel(s, q, {closed, idle, paused, remaining})}
        <div class="qtext">${escapeHtml(q.question)}</div>
        ${questionImageHtml(q)}
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
          <div class="qmeta"><span class="pill">${escapeHtml(nextQ.category)}</span>${nextQ.imageUrl?'<span class="pill">📷 immagine</span>':''}</div>
          <div class="qtext" style="font-size:16px;">${escapeHtml(nextQ.question)}</div>
        </div>`;
    }

    liveTable = `
      <div class="card">
        <h3>Stato squadre</h3>
        <div class="table-wrap"><table><thead><tr><th>Squadra</th><th>Stato</th><th>Risposta</th><th>Punti</th></tr></thead><tbody>
        ${activeTeams.map(id=>{
          const key = qkey(round, idx);
          const ans = answersByTeam[id] && answersByTeam[id][key];
          const lateForThis = !teamEligibleForQuestion(id, round, idx);
          const status = ans ? `<span class="status-dot dot-ok"></span>Risposto` : lateForThis ? `<span class="status-dot dot-wait"></span>Entrata dopo` : (closed ? `<span class="status-dot dot-late"></span>Nessuna risposta` : `<span class="status-dot dot-wait"></span>In attesa`);
          const answerTxt = ans ? escapeHtml(answerText(q, ans)) : '—';
          const pts = closed ? teamPointsForQuestion(id, round, idx) : '—';
          return `<tr>
            <td>${teamNameHtml(id)}</td>
            <td>${status}</td>
            <td>${answerTxt}</td>
            <td>${pts} ${closed?`<button class="btn ghost small" data-adjust="-1" data-team="${id}">−</button><button class="btn ghost small" data-adjust="1" data-team="${id}">+</button>`:''}</td>
          </tr>`;
        }).join('')}
        </tbody></table></div>
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
          ${(s.tiebreak.candidateQuestions||[]).map((q,i)=>`<button class="btn secondary small" data-tb-q="${i}">${i+1}. [${escapeHtml(q.category)}] ${isTop10(q) ? '🔟 '+escapeHtml(top10Title(q)) : escapeHtml(q.question.slice(0,50))+'...'}</button>`).join('') || '<p class="muted">Nessuna domanda disponibile nel pool finale.</p>'}
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
        ${q.answerType==='top10' ? '' : `<p class="muted">Corretta: ${escapeHtml(correctAnswerText(withQuestionDefaults(q)))}</p>`}
        ${!tb.forFinal ? `<p class="muted">Posti in finale ancora da assegnare: ${Math.max(0, ((s.config && s.config.finalistCount)||2) - (tb.qualifiedSoFar||[]).length)}${(tb.qualifiedSoFar||[]).length ? ' · già in finale: '+(tb.qualifiedSoFar||[]).map(teamNameHtml).join(', ') : ''}</p>` : ''}
        ${autoWinnerId ? `<p class="muted">Il sistema suggerisce <b>${teamNameHtml(autoWinnerId)}</b> in base alla regola di spareggio scelta: conferma o scegli un'altra squadra.</p>` : ''}
        <div class="stack">
          ${tb.candidates.map(id=>{
            const ans = answersByTeam[id] && answersByTeam[id][qkey('tiebreak', 0)];
            const correct = ans && isAnswerCorrect(withQuestionDefaults(q), ans);
            const suggested = autoWinnerId===id;
            const outcome = q.answerType==='top10'
              ? teamPointsForQuestion(id, 'tiebreak', 0)+' punti sul tabellone'
              : (ans ? (correct?'✓ corretta':'✗ sbagliata') : 'nessuna risposta');
            return `<div class="row" style="align-items:center;">
              <div>${teamNameHtml(id)} — ${outcome} ${suggested?'<span class="pill gold">Suggerita</span>':''}</div>
              <button class="btn small ${suggested?'':'secondary'}" data-assign-winner="${id}">${assignLabel}</button>
            </div>`;
          }).join('')}
        </div>
        <button class="btn ghost small" id="btnNewTiebreakQuestion">Altra domanda di spareggio tra queste squadre</button>
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
      <div class="table-wrap"><table><thead><tr><th>Squadra</th>${standingsRoundNums.map(r=>`<th>Manche ${r}</th>`).join('')}<th>Finale</th><th>Totale</th></tr></thead><tbody>
      ${teamIds.map(id=>`<tr>
        <td>${teamNameHtml(id)}</td>
        ${standingsRoundNums.map(r=>`<td>${roundScore(id,r)}</td>`).join('')}
        <td>${state.finalists && state.finalists.includes(id) ? roundScore(id,'final') : '—'}</td>
        <td><b>${totalScore(id)}</b></td>
      </tr>`).join('')}
      </tbody></table></div>
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

  bindDirtyTrackingOnce();
  const focus = captureAdminFocus();
  const app2 = document.getElementById('app');
  app2.innerHTML = `
    <div class="header">
      <div class="eyebrow">${brandName()} · Pannello Admin</div>
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
  restoreAdminFormState(focus);
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
  return `<div class="card center stack" style="position:fixed;inset:0;z-index:999;justify-content:center;background:rgba(var(--stage-rgb),.97);border-radius:0;overflow:auto;padding:24px 18px;">
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

let qmResetNote = '';
let qmInventoryNote = '';
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
    const usedN = all.filter(q=>q.pool===pool && isQuestionUsed(q)).length;
    return `<div class="stack"><h3>${pool==='manche'?'Manche':'Finale'} (${total} totali · ${total-usedN} nuove · ${usedN} già giocate)</h3>${rows}</div>`;
  }).join('<div class="divider"></div>');

  const listHtml = pools.map(pool=>{
    const cats = byPoolCategory[pool] || {};
    const catNames = Object.keys(cats).sort();
    const details = catNames.map(c=>{
      const items = cats[c].map(q=>{
        if(q.answerType==='top10'){
          const t = q.top10 || {};
          return `
        <div class="row" style="align-items:center;">
          <div style="flex:3;">
            <div style="font-weight:600;">🔟 ${escapeHtml(t.title||q.question)}</div>
            <div class="muted" style="font-size:12px;">${top10Items(q).map((it,i)=>(i+1)+'. '+escapeHtml(it.name)+(it.value ? ' ('+escapeHtml(it.value)+')' : '')).join(' · ')}</div>
            <div style="margin-top:4px;">
              <span class="pill" style="font-size:11px;">Top Dieci</span>
              ${isValidTop10(q) ? '' : '<span class="pill" style="font-size:11px;color:var(--pink);">⚠ incompleta</span>'}
              ${isQuestionUsed(q) ? '<span class="pill" style="font-size:11px;color:var(--ink-dim);">già giocata</span>' : ''}
            </div>
          </div>
          <button class="btn danger small" data-delete-question="${q.id}">Elimina</button>
        </div>`;
        }
        const difficultyLabel = {facile:'Facile', media:'Media', difficile:'Difficile'}[q.difficulty] || q.difficulty;
        const answerTypeLabel = {scelta:'Scelta multipla', vero_falso:'Vero/Falso', ordinamento:'Ordinamento', numero:'Numero', testo_libero:'Testo libero'}[q.answerType] || q.answerType;
        return `
        <div class="row" style="align-items:center;">
          <div style="flex:3;">
            <div style="font-weight:600;">${escapeHtml(q.question)}</div>
            <div class="muted" style="font-size:12px;">${q.options.map((o,i)=>(i===q.correctIndex?'✓ ':'')+escapeHtml(o)).join(' · ')}</div>
            <div style="margin-top:4px;">
              <span class="pill" style="font-size:11px;">${escapeHtml(answerTypeLabel)}</span>
              <span class="pill" style="font-size:11px;">${escapeHtml(difficultyLabel)}</span>
              ${q.answerPolicy==='modificabile' ? `<span class="pill" style="font-size:11px;">Modificabile</span>` : ''}
              ${q.imageUrl ? `<span class="pill" style="font-size:11px;">📷</span>` : ''}
              ${q.audioUrl ? `<span class="pill" style="font-size:11px;">🎵</span>` : ''}
              ${effectiveRequirement(q)==='required' ? `<span class="pill" style="font-size:11px;">📺 solo schermo</span>` : ''}
              ${isQuestionUsed(q) ? `<span class="pill" style="font-size:11px;color:var(--ink-dim);">già giocata</span>` : ''}
            </div>
          </div>
          <button class="btn danger small" data-delete-question="${q.id}">Elimina</button>
        </div>`;
      }).join('');
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
      <h3>Domande già giocate</h3>
      <p class="note">Una domanda (o classifica Top Dieci) mostrata in una partita viene scartata dalle partite successive, così chi rigioca non la ritrova. Le prove con sole squadre fittizie non la consumano. Se le nuove non bastano, il gioco riprende quelle giocate da più tempo e te lo segnala prima dell'avvio.</p>
      <div class="row">
        <button class="btn ghost small" id="btnResetUsedQuiz">↺ Rimetti in gioco le domande quiz</button>
        <button class="btn ghost small" id="btnResetUsedTop10">↺ Rimetti in gioco le classifiche Top Dieci</button>
      </div>
      <div id="qmResetMsg" class="note" style="color:var(--green);">${escapeHtml(qmResetNote)}</div>
    </div>
    <div class="card stack">
      <h3>📦 Inventario pronto</h3>
      <p class="note">1000 domande quiz (facili e medie per le manche, difficili per la finale) divise tra tutte le categorie e 100 classifiche Top Dieci con i dati e la fonte. Puoi importarlo più volte: aggiunge solo quello che non hai già, senza toccare le tue domande.</p>
      <div class="row">
        <button class="btn small" id="btnImportInventory">📦 Importa inventario</button>
      </div>
      <div id="qmInventoryMsg" class="note" style="color:var(${qmInventoryNote.startsWith('Import non riuscito') ? '--pink' : '--green'});">${escapeHtml(qmInventoryNote)}</div>
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
      <div class="row">
        <label class="stack">Tipo di contenuto<select id="qmContentType">
          <option value="testo">Testo</option>
          <option value="immagine">Immagine</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select></label>
        <label class="stack">Tipo di risposta<select id="qmAnswerType">
          <option value="scelta">Scelta multipla</option>
          <option value="vero_falso">Vero/Falso</option>
          <option value="ordinamento">Ordinamento</option>
          <option value="numero">Numero</option>
          <option value="testo_libero">Testo libero</option>
        </select></label>
      </div>
      <p class="note">"Scelta multipla" e "Vero/Falso" sono giocabili oggi (Vero/Falso riusa lo stesso motore, solo con 2 opzioni fisse); "Ordinamento"/"Numero"/"Testo libero" si possono già dichiarare e salvare, ma il motore di gioco arriverà in un aggiornamento successivo.</p>
      <input type="text" id="qmQuestion" placeholder="Testo della domanda">
      <input type="text" id="qmOpt0" placeholder="Opzione A">
      <input type="text" id="qmOpt1" placeholder="Opzione B">
      <div id="qmOpt23Wrap" class="stack">
        <input type="text" id="qmOpt2" placeholder="Opzione C">
        <input type="text" id="qmOpt3" placeholder="Opzione D">
      </div>
      <select id="qmCorrect">
        <option value="0">Corretta: A</option>
        <option value="1">Corretta: B</option>
        <option value="2" id="qmCorrectOptC">Corretta: C</option>
        <option value="3" id="qmCorrectOptD">Corretta: D</option>
      </select>
      <p id="qmVeroFalsoHint" class="note" style="display:none;color:var(--pink);">⚠ Vero/Falso: la probabilità casuale è del 50%. Valuta un malus più alto per questa domanda (usa "Punteggio per questa domanda" quando la apri in regia).</p>
      <input type="text" id="qmNote" placeholder="Nota per l'admin (facoltativa, es. autore canzone)">
      <label class="stack" id="qmImageWrap" style="display:none;">Immagine<input type="file" id="qmImageFile" accept="image/*"></label>
      <img id="qmImagePreview" style="display:none;max-width:100%;max-height:180px;border-radius:8px;">
      <input type="file" id="qmAudioFile" accept="audio/*">
      <p class="note">Audio facoltativo (es. la canzone da indovinare): parte da solo quando la domanda diventa quella corrente.</p>
      <div class="divider"></div>
      <div class="eyebrow">Contratto della domanda</div>
      <div class="row">
        <label class="stack">Difficoltà<select id="qmDifficulty">
          <option value="facile">Facile</option>
          <option value="media" selected>Media</option>
          <option value="difficile">Difficile</option>
        </select></label>
        <label class="stack">Politica di risposta<select id="qmAnswerPolicy">
          <option value="definitiva">Definitiva</option>
          <option value="modificabile">Modificabile fino alla chiusura</option>
        </select></label>
      </div>
      <label class="stack">Tolleranza (solo per "Numero", facoltativa)<input type="text" inputmode="decimal" id="qmTolerance" placeholder="es. 5"></label>
      <div class="divider"></div>
      <div class="eyebrow">Presentazione (schermo condiviso)</div>
      <div class="row">
        <label class="stack">Dove si mostra<select id="qmPresMode">
          <option value="inherit">Come la partita</option>
          <option value="shared_screen">Preferisci lo schermo condiviso</option>
          <option value="team_devices">Sempre sui telefoni</option>
        </select></label>
        <label class="stack">Schermo condiviso<select id="qmRequirement">
          <option value="optional">Facoltativo</option>
          <option value="required">Obbligatorio (si ferma senza Display)</option>
        </select></label>
      </div>
      <div class="row">
        <label class="stack">Sul telefono, con lo schermo<select id="qmTeamVisibility">
          <option value="auto">Automatico (solo le risposte)</option>
          <option value="answers_only">Solo le risposte</option>
          <option value="full">Domanda completa</option>
        </select></label>
        <label class="stack">Apertura risposte<select id="qmUnlockPolicy">
          <option value="inherit">Come la partita</option>
          <option value="manual">Manuale</option>
          <option value="immediate">Immediata</option>
          <option value="delayed">Dopo il tempo di lettura</option>
          <option value="after_media">A fine audio</option>
        </select></label>
      </div>
      <button class="btn" id="btnAddQuestion">Aggiungi al mazzo</button>
      <div id="qmAddMsg" class="note"></div>
    </div>
    <div class="card stack">
      <h3>🔟 Aggiungi una classifica Top Dieci</h3>
      <p class="note">Dieci voci, una per riga, dalla 1ª alla 10ª. Su ogni riga: il nome, poi (facoltative) le alternative accettate separate da "/", e dopo "=" il dato da mostrare quando la voce viene scoperta.<br>Esempio: <code>Everest / Monte Everest / Chomolungma = 8.849 m</code></p>
      <div class="row">
        <select id="t10Pool">
          <option value="manche">Manche</option>
          <option value="finale">Finale</option>
        </select>
        <select id="t10Category">${CATEGORIES.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <input type="text" id="t10Title" placeholder="Titolo della classifica (es. Le 10 città più visitate d'Europa)">
      <textarea id="t10Items" rows="10" placeholder="1ª voce / alternativa = dato&#10;2ª voce = dato&#10;...&#10;10ª voce"></textarea>
      <input type="text" id="t10Source" placeholder="Fonte o criterio (facoltativo, es. ISTAT 2023)">
      <button class="btn" id="btnAddTop10">Aggiungi classifica</button>
      <div id="t10AddMsg" class="note"></div>
    </div>
    <div class="card stack">
      <h3>Incolla in blocco</h3>
      <p class="note">Un rigo per domanda, campi separati da "|":<br>
      <code>manche|Musica|Che canzone è?|Sere nere|Ti scatterò una foto|Non me lo so spiegare|Imbranato|2|Tiziano Ferro</code><br>
      L'ottavo campo è la risposta corretta (1=A, 2=B, 3=C, 4=D). Il nono campo (nota) e il decimo campo (URL audio) sono facoltativi.<br>
      Classifiche Top Dieci: <code>top10|manche|Geografia|Titolo|Everest / Chomolungma = 8.849 m;K2 = 8.611 m;...|fonte</code> (10 voci separate da ";", fonte facoltativa).</p>
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
const DELEGATED_REGIA_BUTTON_IDS = ['btnCloseNow','btnReopenAnswers','btnCancelQuestion','btnStartTimer','btnStartTimerAnyway','btnActivateTeamFallback','btnPauseTimer','btnResumeTimer','btnTimerMinus5','btnTimerPlus5','btnRevealSolution','btnNext',
  'btnShowQuestion','btnSkipActivity','btnDelayUnlock','btnCancelAutoUnlock','btnRestoreSharedScreen','btnRetryDisplay','btnUseTeamVariant'];
let delegatedRegiaHandlersBound = false;
function onDelegatedRegiaClick(e){
  if(role!=='admin') return;
  const btn = e.target.closest(DELEGATED_REGIA_BUTTON_IDS.map(id=>'#'+id).join(','));
  if(!btn) return;
  switch(btn.id){
    case 'btnCloseNow': adminCloseAnswers(); break;
    case 'btnReopenAnswers': adminReopenAnswers(); break;
    case 'btnCancelQuestion': if(confirm('Annullare questa domanda? Non assegnerà punti a nessuno.')) adminCancelQuestion(); break;
    case 'btnStartTimer': case 'btnStartTimerAnyway': adminStartTimerManually(); break;
    case 'btnShowQuestion': adminShowQuestion(); break;
    case 'btnSkipActivity': if(confirm('Saltare questa attività? Non assegnerà punti a nessuno.')) adminCancelQuestion(); break;
    case 'btnDelayUnlock': adminDelayUnlock(5000); break;
    case 'btnCancelAutoUnlock': adminCancelAutoUnlock(); break;
    case 'btnRestoreSharedScreen': adminRestoreSharedScreen(); break;
    case 'btnRetryDisplay': adminRetryDisplay(); break;
    case 'btnUseTeamVariant': adminUseTeamVariant(); break;
    case 'btnActivateTeamFallback': adminActivateTeamFallback(); break;
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
  if(byId('btnStart')) byId('btnStart').onclick = ()=> showStartSummaryModal(state.config, adminStartGame);
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
    const gameName = byId('setupGameName').value.trim() || 'Quizzettone';
    const patch = collectSetupPatchFromForm(false);
    await adminSaveSetup(gameName, patch);
    forgetDirty('setup');
    salaPresetNoteText = '';
  };
  // Aperta dal link "Top Dieci" dell'hub: il preset si carica nel form una
  // volta sola (resta da confermare con "Salva impostazioni").
  if(URL_GAME==='topdieci' && !top10UrlPresetApplied && byId('setupGameType') && !state.setupLocked){
    top10UrlPresetApplied = true;
    if((state.config.gameType||'quiz')!=='topdieci'){
      applyPresetValuesToForm(BUILTIN_CONFIG_PRESETS.find(p=>p.id==='topdieci').values);
      salaPresetNoteText = 'Preset Top Dieci caricato: controlla e premi "Salva impostazioni".';
      const note = byId('salaPresetNote');
      if(note) note.textContent = salaPresetNoteText;
    }
  }
  document.querySelectorAll('[data-builtin-preset]').forEach(btn=>{
    btn.onclick = ()=>{
      const preset = BUILTIN_CONFIG_PRESETS.find(p=>p.id===btn.getAttribute('data-builtin-preset'));
      if(preset) applyPresetValuesToForm(preset.values);
      if(preset) salaPresetNoteText = 'Preset "'+preset.label+'" caricato: premi "Salva impostazioni" per confermarlo.';
      const note = byId('salaPresetNote');
      if(note) note.textContent = salaPresetNoteText;
    };
  });
  document.querySelectorAll('[data-load-preset]').forEach(btn=>{
    btn.onclick = ()=>{
      const p = presets[btn.getAttribute('data-load-preset')];
      if(p && p.config) applyPresetValuesToForm(p.config);
    };
  });
  document.querySelectorAll('[data-delete-preset]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-delete-preset');
      const name = presets[id] ? presets[id].name : 'questo preset';
      showConfirmModal('Eliminare il preset "'+name+'"?', 'Elimina preset', ()=>adminDeleteConfigPreset(id));
    };
  });
  if(byId('btnSaveAsPreset')) byId('btnSaveAsPreset').onclick = ()=>{
    showSavePresetModal(name => adminSaveConfigPreset(name, collectSetupPatchFromForm(true)));
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
    const fresh = byId('pdmTesto'); if(fresh) fresh.value = '';
    forgetDirty(['pdmTesto']);
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
    forgetDirty('scDef');
  };
  if(byId('btnTop10Start')) byId('btnTop10Start').onclick = adminTop10Start;
  if(byId('btnTop10Pause')) byId('btnTop10Pause').onclick = adminTop10Pause;
  if(byId('btnTop10Resume')) byId('btnTop10Resume').onclick = adminTop10Resume;
  if(byId('btnTop10Skip')) byId('btnTop10Skip').onclick = adminTop10Skip;
  if(byId('btnTop10End')) byId('btnTop10End').onclick = ()=> showConfirmModal('Chiudere la classifica adesso? Le voci non trovate si potranno svelare.', 'Chiudi classifica', adminTop10End);
  if(byId('btnTop10RevealNext')) byId('btnTop10RevealNext').onclick = ()=>adminTop10Reveal(false);
  if(byId('btnTop10RevealAll')) byId('btnTop10RevealAll').onclick = ()=>adminTop10Reveal(true);
  document.querySelectorAll('[data-top10-accept]').forEach(btn=>{
    btn.onclick = ()=>{
      const logIdx = parseInt(btn.getAttribute('data-top10-accept'), 10);
      const sel = byId('top10AcceptSel_'+logIdx);
      if(sel && sel.value!=='') adminTop10Accept(logIdx, parseInt(sel.value, 10));
    };
  });
  document.querySelectorAll('[data-top10-reject]').forEach(btn=>{
    btn.onclick = ()=> adminTop10Reject(parseInt(btn.getAttribute('data-top10-reject'), 10));
  });
  if(byId('btnApplyQuestionScoring')) byId('btnApplyQuestionScoring').onclick = ()=>{
    const correct = parseInt(byId('qsCorrect').value, 10) || 0;
    const wrong = parseInt(byId('qsWrong').value, 10) || 0;
    const noAnswer = parseInt(byId('qsNoAnswer').value, 10) || 0;
    adminSetQuestionScoring(state.round, state.qIndex, {correct, wrong, noAnswer});
    forgetDirty('qs');
  };
  // PL-19: Vero/Falso riusa il motore a scelta multipla esistente con
  // esattamente 2 opzioni — nessun nuovo motore, solo un preset del form.
  // Cambiare il tipo di risposta mostra/nasconde i campi C/D, precompila
  // "Vero"/"Falso" (solo se ancora vuoti, per non cancellare testo scritto
  // a mano se l'admin torna indietro), e avvisa del malus da valutare.
  if(byId('qmAnswerType')) byId('qmAnswerType').onchange = ()=>{
    const isVeroFalso = byId('qmAnswerType').value === 'vero_falso';
    byId('qmOpt23Wrap').style.display = isVeroFalso ? 'none' : 'flex';
    byId('qmCorrectOptC').disabled = isVeroFalso;
    byId('qmCorrectOptD').disabled = isVeroFalso;
    byId('qmVeroFalsoHint').style.display = isVeroFalso ? 'block' : 'none';
    if(isVeroFalso){
      if(!byId('qmOpt0').value.trim()) byId('qmOpt0').value = 'Vero';
      if(!byId('qmOpt1').value.trim()) byId('qmOpt1').value = 'Falso';
    }
  };
  // PL-19: anteprima immagine locale (prima ancora dell'upload) quando il
  // tipo di contenuto è "Immagine" — la validazione vera e propria (tipo
  // MIME, dimensione) resta lato uploadImageFile, qui è solo UI.
  if(byId('qmContentType')) byId('qmContentType').onchange = ()=>{
    byId('qmImageWrap').style.display = byId('qmContentType').value === 'immagine' ? 'flex' : 'none';
  };
  if(byId('qmImageFile')) byId('qmImageFile').onchange = ()=>{
    const file = byId('qmImageFile').files[0];
    const preview = byId('qmImagePreview');
    if(file){ preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
    else { preview.style.display = 'none'; }
  };
  if(byId('btnAddQuestion')) byId('btnAddQuestion').onclick = async ()=>{
    const pool = byId('qmPool').value;
    const category = byId('qmCategory').value;
    const question = byId('qmQuestion').value.trim();
    const answerType = byId('qmAnswerType').value;
    const isVeroFalso = answerType === 'vero_falso';
    const opts = isVeroFalso
      ? [byId('qmOpt0').value.trim(), byId('qmOpt1').value.trim()]
      : [byId('qmOpt0').value.trim(), byId('qmOpt1').value.trim(), byId('qmOpt2').value.trim(), byId('qmOpt3').value.trim()];
    const correctIndex = parseInt(byId('qmCorrect').value, 10);
    const note = byId('qmNote').value.trim();
    const audioFile = pickedFile('qmAudioFile');
    const imageFile = pickedFile('qmImageFile');
    const msg = byId('qmAddMsg');
    if(!question || opts.some(o=>!o)){
      msg.textContent = isVeroFalso ? 'Compila la domanda e le due opzioni (Vero/Falso).' : 'Compila la domanda e tutte e 4 le opzioni.';
      msg.style.color = 'var(--pink)';
      return;
    }
    if(isVeroFalso && correctIndex>1){
      msg.textContent = 'Una domanda Vero/Falso ha solo 2 opzioni: scegli A o B come corretta.';
      msg.style.color = 'var(--pink)';
      return;
    }
    let audioUrl = null;
    if(audioFile){
      msg.textContent = 'Caricamento audio...'; msg.style.color = '';
      try{ audioUrl = await uploadAudioFile(audioFile, 'question-audio'); }
      catch(e){ msg.textContent = 'Upload audio fallito: ' + e.message; msg.style.color = 'var(--pink)'; return; }
    }
    let imageUrl = null;
    if(imageFile){
      msg.textContent = 'Caricamento immagine...'; msg.style.color = '';
      try{ imageUrl = await uploadImageFile(imageFile, 'question-images'); }
      catch(e){ msg.textContent = 'Upload immagine fallito: ' + e.message; msg.style.color = 'var(--pink)'; return; }
    }
    const contentType = byId('qmContentType').value;
    const difficulty = byId('qmDifficulty').value;
    const answerPolicy = byId('qmAnswerPolicy').value;
    const toleranceRaw = byId('qmTolerance').value.trim();
    const tolerance = toleranceRaw ? parseFloat(toleranceRaw) : null;
    const presentation = {mode: byId('qmPresMode').value, teamContentVisibility: byId('qmTeamVisibility').value, inputUnlockPolicy: byId('qmUnlockPolicy').value, readingDelayMs:null};
    await addQuestion({pool, category, question, options:opts, correctIndex, adminNote: note||null, audioUrl, imageUrl, contentType, answerType, difficulty, answerPolicy, tolerance,
      presentation, sharedScreenRequirement: byId('qmRequirement').value});
    // Rileggere il DOM invece di riusare 'msg': scrivere su Firebase fa
    // arrivare l'eco del proprio stesso ascoltatore mentre siamo ancora
    // dentro l'await, e render() (chiamato da quell'eco) ricostruisce
    // #app da zero — il nodo catturato prima dell'await può già essere
    // stato staccato dal documento, rendendo .textContent un no-op silenzioso.
    const freshMsg = byId('qmAddMsg');
    if(freshMsg){ freshMsg.textContent = 'Domanda aggiunta!'; freshMsg.style.color = 'var(--green)'; }
    ['qmQuestion','qmOpt0','qmOpt1','qmOpt2','qmOpt3','qmNote','qmTolerance'].forEach(id=>{ const el = byId(id); if(el) el.value=''; });
    const freshImagePreview = byId('qmImagePreview');
    if(freshImagePreview) freshImagePreview.style.display = 'none';
    const freshImageFile = byId('qmImageFile');
    if(freshImageFile) freshImageFile.value = '';
    const freshAudioFile = byId('qmAudioFile');
    if(freshAudioFile) freshAudioFile.value = '';
    forgetDirty(['qmQuestion','qmOpt0','qmOpt1','qmOpt2','qmOpt3','qmNote','qmTolerance','qmAudioFile','qmImageFile']);
    document.querySelectorAll('[data-pending-file^="qm"]').forEach(el=>el.remove());
  };
  const resetUsed = (which, label)=> async ()=>{
    const n = await resetUsedQuestions(which);
    qmResetNote = n ? `${n} ${label} di nuovo in gioco.` : `Niente da rimettere in gioco.`;
    render();
  };
  if(byId('btnResetUsedQuiz')) byId('btnResetUsedQuiz').onclick = ()=> showConfirmModal('Rimettere in gioco tutte le domande quiz già giocate?', 'Rimetti in gioco', resetUsed('quiz', 'domande'));
  if(byId('btnResetUsedTop10')) byId('btnResetUsedTop10').onclick = ()=> showConfirmModal('Rimettere in gioco tutte le classifiche Top Dieci già giocate?', 'Rimetti in gioco', resetUsed('top10', 'classifiche'));
  if(byId('btnImportInventory')) byId('btnImportInventory').onclick = async ()=>{
    const btn = byId('btnImportInventory');
    btn.disabled = true; btn.textContent = 'Importazione…';
    try {
      const plan = await importInventory();
      qmInventoryNote = plan.entries.length
        ? `Aggiunte ${plan.quiz} domande e ${plan.top10} classifiche Top Dieci${plan.skipped ? ` (${plan.skipped} già presenti, saltate)` : ''}.`
        : `Hai già tutto l'inventario nel mazzo.`;
    } catch(e){
      qmInventoryNote = 'Import non riuscito: ' + (e && e.message || e);
    }
    render();
  };
  if(byId('btnAddTop10')) byId('btnAddTop10').onclick = async ()=>{
    const title = byId('t10Title').value.trim();
    const items = byId('t10Items').value.split('\n').map(parseTop10ItemLine).filter(Boolean);
    const msg = byId('t10AddMsg');
    const fail = text=>{ msg.textContent = text; msg.style.color = 'var(--pink)'; };
    if(!title) return fail('Scrivi il titolo della classifica.');
    if(items.length!==10) return fail('Servono esattamente 10 voci, una per riga (ora sono '+items.length+').');
    if(new Set(items.map(it=>normalizeTop10Text(it.name))).size!==10) return fail('Ci sono voci ripetute.');
    await addTop10Question({pool: byId('t10Pool').value, category: byId('t10Category').value, title, items, source: byId('t10Source').value.trim() || null});
    const freshMsg = byId('t10AddMsg');
    if(freshMsg){ freshMsg.textContent = 'Classifica aggiunta!'; freshMsg.style.color = 'var(--green)'; }
    ['t10Title','t10Items','t10Source'].forEach(id=>{ const el = byId(id); if(el) el.value=''; });
    forgetDirty(['t10Title','t10Items','t10Source']);
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
    if(parsed.length>0){ byId('qmBulkText').value = ''; forgetDirty(['qmBulkText']); }
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
  if(byId('btnNewTiebreakQuestion')) byId('btnNewTiebreakQuestion').onclick = adminNewTiebreakQuestion;
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
      if(fx) patchState({audioCue:{url:fx.url, kind:'effect', label:fx.name, action:'play', startAt:0, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)}});
    };
  });
  document.querySelectorAll('[data-delete-effect]').forEach(btn=>{
    btn.onclick = ()=>{ if(confirm('Eliminare questo effetto?')) deleteEffect(btn.getAttribute('data-delete-effect')); };
  });
  if(byId('btnUploadEffect')) byId('btnUploadEffect').onclick = async ()=>{
    const name = byId('fxName').value.trim();
    const file = pickedFile('fxFile');
    const msg = byId('fxUploadMsg');
    if(!name || !file){ msg.textContent = 'Inserisci nome e file.'; msg.style.color = 'var(--pink)'; return; }
    msg.textContent = 'Caricamento...'; msg.style.color = '';
    try{
      const url = await uploadAudioFile(file, 'effects');
      await addEffect(name, url);
      forgetDirty(['fxName','fxFile']);
      const freshMsg = byId('fxUploadMsg');
      if(freshMsg){ freshMsg.textContent = 'Effetto caricato!'; freshMsg.style.color = 'var(--green)'; }
      if(byId('fxName')) byId('fxName').value='';
      if(byId('fxFile')) byId('fxFile').value='';
      document.querySelectorAll('[data-pending-file="fxFile"]').forEach(el=>el.remove());
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
