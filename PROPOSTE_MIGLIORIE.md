# Proposte di miglioria — Quizzettone (da AUDIT_QUIZZETTONE.md)

> Nessuna modifica è stata applicata a `index.html`. Tutte le patch sotto sono proposte da approvare.
> I numeri di riga si riferiscono a `index.html` al commit `50e2419`.
> **[NUOVO]** = problema non presente nell'audit originale, trovato rileggendo il codice.

## 1. Stato del progetto in breve

Un solo file (`index.html`, 1920 righe) che contiene tre viste (Admin / Squadra / Display), con Firebase Realtime Database come unico stato condiviso e senza autenticazione. La logica di punteggio è centralizzata e ordinata. I rischi principali sono la sicurezza (XSS sui nomi squadra, database probabilmente aperto a tutti) e la robustezza durante una serata dal vivo (nessuna presenza, nessun fallback se Firebase non risponde). Rileggendo il codice sono emersi altri **bug confermati nel flusso di gioco**: in particolare lo spareggio non si può giocare dai telefoni delle squadre (A2) e un pareggio al primo posto porta in finale una sola squadra (A3).

### Correzioni all'audit originale
- §2.4 diceva che il re-render completo ogni 250 ms era "accettabile". **Non lo è**: durante una domanda svuota ogni 250 ms i campi che l'admin sta compilando (vedi A7).
- §3.3, riga "Pareggio per il 1° posto": l'audit lo dava come "confermato nel codice". Il codice ci prova, ma il risultato è sbagliato (vedi A3).

---

## 2. Fix sicuri da applicare subito

Basso rischio, ben definiti, nessuna decisione di design. In ordine di priorità.

### A1 — XSS sui nomi squadra (finding #1, Critico)
Aggiungo un helper vicino a `escapeHtml` (`index.html:822-824`):
```js
function teamLabel(id){ return escapeHtml(teams[id] ? teams[id].name : '—'); }
```
Poi sostituisco ogni `teams[X]?teams[X].name:'—'` / `teams[X] ? teams[X].name : '—'` / `teams[X].name` non escapato con `teamLabel(X)`, e ogni `${teamName}` con `${escapeHtml(teamName)}`.

| Riga | Prima | Dopo |
|---|---|---|
| 847 | `${teams[r.id] ? teams[r.id].name : '—'}` | `${teamLabel(r.id)}` |
| 1044, 1128, 1147 | `${teamName}` | `${escapeHtml(teamName)}` |
| 1105, 1499 | `s.finalists.map(id=>teams[id]?teams[id].name:'—')` | `s.finalists.map(teamLabel)` |
| 1111 | `.map(id=>teams[id]?teams[id].name:'—')` | `.map(teamLabel)` |
| 1135, 1139 | `${teams[s.winner]?teams[s.winner].name:'—'}` | `${teamLabel(s.winner)}` |
| 1223, 1509, 1518 | `${teams[r.id]?teams[r.id].name:'—'}` | `${teamLabel(r.id)}` |
| 1345, 1528 | `${teams[id].name}` | `${teamLabel(id)}` |
| 1420, 1488, 1519, 1562 | `${teams[id]?teams[id].name:'—'}` | `${teamLabel(id)}` |
| 1469, 1500 | `.map(id=>teams[id]?teams[id].name:'—')` | `.map(teamLabel)` |
| 1517 | `(teams[s.winner]?teams[s.winner].name:'—')` | `teamLabel(s.winner)` |
| 920, 1298, 1313 | già escapati | `teamLabel(...)` per uniformità |

Irrobustimento (stessa patch): finché il DB è scrivibile da chiunque, un attaccante può anche scrivere un `id` malevolo, che finisce negli attributi `data-team="${id}"` (`index.html:1423`) ecc. Nel listener (`index.html:360`) accetto quindi solo id ben formati:
```js
if(k.startsWith('teaminfo:')){ const t = all[k]; if(t && /^team_[a-z0-9]+$/.test(t.id)) newTeams[t.id] = t; }
```

### A2 — [NUOVO] Lo spareggio non si può giocare dai telefoni (Critico)
`index.html:1053` chiama `renderTeamQuestion('tiebreak', s.qIndex, false, true)`. Il terzo parametro è `active`: con `false` i pulsanti sono disabilitati (`index.html:1173`), il timer non viene mostrato e compare subito "⏱ Tempo scaduto" (`index.html:1181`). Il pannello admin invece si aspetta le risposte (`index.html:1484-1490`: "✓ corretta / ✗ sbagliata / nessuna risposta"). Risultato: allo spareggio nessuna squadra riesce a rispondere.
```diff
- body = renderTeamQuestion('tiebreak', s.qIndex, false, true);
+ body = renderTeamQuestion('tiebreak', s.qIndex, true, true);
```
Nella stessa patch tolgo il testo fisso "Due squadre si giocano l'accesso in finale" (`index.html:1057`, `1255`), che è sbagliato quando le squadre in parità sono 3 o più:
```js
<h3>Spareggio: ${(s.tiebreak && s.tiebreak.candidates || []).map(teamLabel).join(' 🆚 ')}</h3>
```

### A3 — [NUOVO] Pareggio al 1° posto: va in finale una sola squadra (Alto)
In `adminRevealFinalists` (`index.html:618-623`), se le prime due sono a pari punti, il gioco apre comunque uno spareggio, anche quando entrambe sono chiaramente davanti alla terza. Poi `adminAssignTiebreakWinner` (`index.html:636-642`) aggiunge **un solo** vincitore a una lista vuota: `[...[], winnerId].slice(0,2)` produce un solo finalista, e anche la squadra che aveva pareggiato al primo posto viene eliminata. La variabile `need` (`index.html:637`) viene calcolata ma non è mai usata. Il commento a riga 619 ("si prendono i primi 2") conferma l'intento.

Correzione: lo spareggio parte solo se le squadre a pari merito sono più dei posti rimasti.
```js
async function adminRevealFinalists(){
  const ids = Object.keys(teams);
  const ranked = ids.map(id=>({id, score:qualificationScore(id)})).sort((a,b)=>b.score-a.score);
  if(ranked.length<=2){
    await safeSet('state', {...state, phase:'reveal_finalists', finalists:ranked.map(r=>r.id), eliminated:[]}, true);
    await refresh(); return;
  }
  const cutScore = ranked[1].score;
  const above = ranked.filter(r=>r.score>cutScore).map(r=>r.id);   // 0 o 1 squadre già qualificate
  const tied  = ranked.filter(r=>r.score===cutScore).map(r=>r.id);
  if(above.length + tied.length <= 2){
    const finalists = [...above, ...tied];
    await safeSet('state', {...state, phase:'reveal_finalists', finalists, eliminated: ids.filter(id=>!finalists.includes(id))}, true);
  } else {
    const candidateQuestions = drawQuestionsForGame('finale', 5);
    await safeSet('state', {...state, phase:'tiebreak_setup', tiebreak:{qualifiedSoFar:above, candidates:tied, candidateQuestions, question:null, qIndex:null}}, true);
  }
  await refresh();
}
```
Resta da decidere cosa fare quando **3 o più squadre** pareggiano al primo posto e servono 2 posti → vedi **B4**.

### A4 — Schermata vuota se Firebase non risponde (finding #4, Alto)
```js
function renderLoading(failed){
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `<div class="card center stack" style="margin-top:40px;">
    <h3>${failed ? 'Impossibile collegarsi al gioco' : 'Connessione al gioco…'}</h3>
    ${failed ? '<p class="muted">Controlla la connessione e ricarica la pagina.</p><button class="btn" onclick="location.reload()">Ricarica</button>' : ''}
  </div>`;
}
```
In `startListening` (`index.html:353-381`): subito dopo `listening = true;` aggiungo `renderLoading(false); setTimeout(()=>{ if(!state) renderLoading(true); }, 10000);`. Nella callback d'errore del listener (`index.html:375`) aggiungo `renderLoading(true);`.

### A5 — Invio risposta atomico (finding #5, Medio)
Oggi `teamSubmitAnswer` (`index.html:811-818`) legge **tutto** l'oggetto risposte della squadra e poi lo riscrive per intero. Due tocchi ravvicinati possono sovrascrivere la prima risposta. Con una transazione sulla singola chiave il problema sparisce, e in più blocco gli invii fuori fase:
```js
async function teamSubmitAnswer(round, idx, optionIndex){
  if(!state || state.phase!=='question' || timeRemaining()<=0) return;
  const key = qkey(round, idx);
  try{
    await db.ref(DB_ROOT + '/answers:' + teamId + '/' + key)
      .transaction(cur => cur ? undefined : {optionIndex, ts: serverNow()});  // serverNow: vedi A6
  }catch(e){ console.error('invio risposta fallito', e); alert('Risposta non inviata, riprova.'); }
}
```
La struttura dati resta identica (`answers:<id>/<qkey>`), quindi è compatibile con le partite già salvate.

### A6 — [NUOVO] Timer sfasato tra dispositivi (Medio)
`questionStartedAt` viene scritto con l'orologio del dispositivo dell'admin (`index.html:528, 578, 584, 598, 601, 633, 646`), mentre ogni telefono calcola il tempo rimasto con il **proprio** orologio (`index.html:827`). Se un telefono è indietro di 5 secondi, vede 5 secondi in più (o in meno). Firebase fornisce lo scarto rispetto al server:
```js
let serverTimeOffset = 0;
db.ref('.info/serverTimeOffset').on('value', snap=>{ serverTimeOffset = snap.val() || 0; });
function serverNow(){ return Date.now() + serverTimeOffset; }
```
(da mettere dopo `index.html:284`). Poi sostituisco `Date.now()` con `serverNow()` alle righe 520, 528, 551, 557, 578, 584, 598, 601, 633, 646, 815, 827, 870, 1892. Le righe 288, 462, 511 e 728 restano come sono: lì serve solo un timestamp approssimativo.

### A7 — [NUOVO] I campi dell'admin si svuotano ogni 250 ms durante una domanda (Medio)
`startUiTick` (`index.html:388-391`) chiama `render()` ogni 250 ms quando `phase==='question'`, e `renderAdmin` ricostruisce tutta la pagina con `innerHTML` (`index.html:1659`). Così i campi "Punteggio per questa domanda" (`index.html:1387-1389`), che compaiono proprio durante la domanda, vengono svuotati mentre l'admin scrive. Lo stesso succede al form "Aggiungi domanda". Patch: a ogni tick aggiorno solo il timer, e ridisegno tutta la pagina solo quando il tempo scade.
```js
function startUiTick(){
  if(uiTickTimer) return;
  uiTickTimer = setInterval(()=>{
    if(!state || state.phase!=='question') return;
    const remaining = timeRemaining();
    const slot = document.getElementById('timerSlot');
    if(remaining > 0 && slot){ slot.innerHTML = circleTimer(remaining, state.timerDuration); return; }
    render();
  }, 250);
}
```
In più aggiungo `id="timerSlot"` ai due `<div class="timer-wrap">` (`index.html:1195`, `1375`). Il problema resta per gli aggiornamenti in arrivo da Firebase (ad esempio una squadra che risponde): vedi **C3**.

### A8 — Ingresso squadra: controllare che la scrittura sia andata a buon fine (parte del finding #12)
`index.html:728`:
```js
const ok = await safeSet('teaminfo:'+teamId, {id:teamId, name:teamName, joinedAt:Date.now()}, true);
if(!ok){ alert('Non riesco a registrare la squadra: controlla la connessione e riprova.'); teamId = null; teamName = null; return; }
```

### A9 — Testo del checkpoint fisso a "8" (finding #8, Basso)
`index.html:1075` e `1271`:
```diff
- <p class="muted">${cp.round===1?8:8} domande giocate, ${total-8} da giocare</p>
+ <p class="muted">${s.qIndex+1} domande giocate, ${total-(s.qIndex+1)} da giocare</p>
```
(Al checkpoint di metà manche `qIndex` è l'indice dell'ultima domanda giocata, cioè `midPoint-1`: vedi `index.html:573-574`.)

### A10 — Tabelle admin troppo larghe su smartphone (finding #11, Basso)
CSS (dopo `index.html:148`): `.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}`. Poi avvolgo in `<div class="table-wrap">…</div>` le `<table>` di `index.html:1412` e `index.html:1526`.

### A11 — [NUOVO] Mescolamento delle domande non uniforme (Basso)
`index.html:495` e `506` mescolano con `.sort(()=>Math.random()-0.5)`, un metodo noto per dare ordini statisticamente sbilanciati. Lo sostituisco con Fisher-Yates:
```js
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
// 495: const categories = shuffle(Object.keys(byCategory));
// 506: return shuffle(picked);
```

### A12 — Limite di dimensione per l'upload audio (finding #10, Basso)
In `uploadAudioFile` (`index.html:286`):
```js
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
if(file.size > MAX_AUDIO_BYTES) throw new Error('file troppo grande (max 10 MB)');
if(file.type && !file.type.startsWith('audio/')) throw new Error('il file non è un audio');
```
I chiamanti gestiscono già l'errore e lo mostrano a schermo (`index.html:1840-1841`, `1904-1909`). Il limite di 10 MB è una mia proposta: dimmi se ne vuoi un altro.

---

## 3. Miglioramenti da discutere prima

Per questi serve una tua scelta: non decido io.

### B1 — Regole Firebase e autenticazione (finding #2, Critico)
**Prima di tutto:** controlla in console Firebase le regole di *Realtime Database* **e** di *Storage* e dimmi cosa c'è scritto. Oggi, con la chiave pubblica nel sorgente, chiunque potrebbe fare `db.ref('quizzettone').remove()` e cancellare squadre, domande ed effetti.

| Opzione | Cosa fa | Pro | Contro |
|---|---|---|---|
| A. Nessuna auth, solo regole di validazione | Regole che controllano la forma dei dati e vietano di cancellare il nodo radice | Zero cambi all'app | Non distingue admin e squadre: chiunque può ancora modificare `state` |
| B. Auth anonima + `auth != null` | Ogni dispositivo fa login anonimo, e ogni squadra può scrivere solo le proprie risposte (salvando l'`uid` in `teaminfo`) | Chiude le scritture tra una squadra e l'altra | Chiunque abbia la chiave può ancora autenticarsi anonimamente e toccare `state` |
| C. B + vero login per l'admin (Google o email) | `state`, domande, effetti, override e punteggi scrivibili solo dall'uid dell'admin | Sicurezza reale; sostituisce anche il PIN `2468` | Più lavoro; con le chiavi "a prefisso" le regole sono scomode, quindi conviene prima C2 |

La mia raccomandazione è C, fatta dopo C2. Se la serata è vicina, B come passo intermedio.

### B2 — Presenza / disconnessione (finding #3, Alto)
Proposta: un nodo `presence:<teamId>` con `{online, at}`, impostato con `onDisconnect().set({online:false, ...})` quando `.info/connected` torna `true`, e un pallino verde/grigio nella lobby e nella tabella "Stato squadre" dell'admin. **Cosa devi decidere:**
- una squadra può avere più telefoni (si rientra con lo stesso nome): la consideriamo online se almeno un dispositivo è collegato?
- deve restare solo un'informazione per l'admin, o deve anche cambiare il gioco (ad esempio escludere dalla finale chi è offline)? Io consiglio solo informazione.

### B3 — [NUOVO] Rientro con il nome = chiunque può prendere il posto di un'altra squadra (Medio, include il finding #6)
`teamJoin` (`index.html:720-725`) fa entrare nella squadra **chiunque digiti lo stesso nome** (maiuscole/minuscole non contano), e da lì si può rispondere al posto suo. È quello che rende comodo il rientro, ma è anche un modo per barare. Inoltre due ingressi simultanei con lo stesso nome possono creare due squadre gemelle (finding #6).

| Opzione | Pro | Contro |
|---|---|---|
| A. Lasciare così, aggiungendo solo un indice `teamname:<nome>` con transazione per evitare i doppioni | Il rientro resta semplicissimo | Si può ancora prendere il posto di un'altra squadra |
| B. Rientro solo dal dispositivo già usato (localStorage/URL, già presenti in `index.html:769-810`); con lo stesso nome da un altro telefono → "nome già in uso" | Niente furti di squadra | Chi cambia telefono deve chiedere all'admin |
| C. B + un pulsante admin "riassegna squadra a questo dispositivo" / codice di rientro a 4 cifre mostrato alla squadra | Sicuro e flessibile | Più lavoro |

### B4 — [NUOVO] 3 o più squadre pari al primo posto (collegato ad A3)
Con A3 applicato, questo caso apre uno spareggio con **2 posti da assegnare**, ma oggi il pannello ne assegna uno solo. Opzioni:
- A. L'admin assegna i due posti uno alla volta dallo stesso spareggio. Dopo il primo "Assegna", la schermata resta aperta con le squadre rimaste. Patch semplice.
- B. Dopo il primo posto assegnato si gioca una seconda domanda di spareggio tra le squadre rimaste. Più corretto dal punto di vista sportivo, ma più lungo.
- C. Spareggio automatico: passa chi risponde giusto, e a parità chi risponde prima (serve A6).

### B5 — Pareggio nella finale (finding #7, Medio)
Oggi `winner:'TIE'` porta alla scelta manuale dell'admin (`index.html:654, 658-663`). Opzioni:
- A. Lasciare così: l'admin decide, ad esempio con una domanda a voce. Zero lavoro.
- B. Riutilizzare lo spareggio con una domanda dal pool finale, come per l'accesso in finale. Coerente.
- C. Vince chi ha più punti nella qualificazione. Automatico e premia la costanza.
- D. Vince chi ha risposto correttamente in meno tempo in totale (serve A6).

Nota di design da confermare: oggi il vincitore si decide **solo** sui punti della finale (`index.html:651`). Quelli delle manche servono solo a qualificarsi. È voluto?

### B6 — [NUOVO] Le squadre eliminate possono rispondere in finale e prendere punti (Medio)
Per `phase==='question'` la vista squadra non controlla se la squadra è stata eliminata (`index.html:1048-1049`): le eliminate vedono le domande della finale e possono rispondere. Le loro risposte entrano in `totalScore` (`index.html:421`), che è usato dalla classifica live (`index.html:906`), dalla classifica animata (`index.html:670`) e dal totale admin (`index.html:1532`). Così un'eliminata può superare in "classifica generale" una squadra che ha fatto la finale. Opzioni:
- A. Le eliminate guardano soltanto: al posto della domanda vedono "Finale in corso: X 🆚 Y".
- B. Le eliminate giocano per divertimento, ma i loro punti della finale non contano (`totalScore` somma la finale solo per le finaliste).
- C. A per i punti + domanda visibile senza poter rispondere (per giocare "a mente").

### B7 — Bonus velocità (finding #13)
- A. Nessun bonus (come oggi): semplice, non penalizza chi legge piano o ha un telefono lento.
- B. Bonus lineare: corretta = `correct + round(bonusMax × tempo rimasto / durata)`.
- C. Bonus per chi arriva primo: +1 alla prima squadra che risponde giusto.
- D. Solo come criterio di spareggio (vedi B4-C, B5-D).

Per B, C e D serve prima A6, altrimenti l'orologio di ogni telefono falsa il confronto.

### B8 — Errori di scrittura su tutte le azioni (resto del finding #12)
Con A5 e A8 sono coperte le due azioni delle squadre. Per le azioni dell'admin (circa 30 punti in cui il codice scrive): preferisci un unico avviso generico ("⚠ salvataggio non riuscito, riprova") dentro `safeSet`/`safeDelete`, oppure niente, visto che c'è già il banner di connessione?

### B9 — [NUOVO] Pareggi in classifica mostrati come posizioni diverse (Basso)
`rankRows` (`index.html:843-850`) numera `i+1`, quindi due squadre a pari punti risultano 1ª e 2ª (lo stesso vale per la classifica animata, `index.html:917`). Lo vuoi mostrare come "1° ex aequo / 1° ex aequo / 3°"?

### B10 — Schermata delle regole (finding #14)
- A. Una scheda "ℹ️ Come si gioca" apribile nella schermata di ingresso squadra.
- B. Le regole sul **Display** durante la lobby. Secondo me è la soluzione migliore dal vivo, perché tutti guardano lo schermo mentre aspettano.
- C. Nessuna: le spiega l'host a voce.

Bozza di testo, ricavata da quello che il codice fa davvero (da confermare dopo B4–B7):
> 2 manche da 15 domande, con una pausa a metà · 20 secondi per domanda · una sola risposta, che non si può cambiare · corretta +1, sbagliata 0 (l'admin può cambiarlo) · le 2 squadre con più punti nelle manche vanno in finale (10 domande) · in caso di pareggio c'è uno spareggio · vince chi fa più punti **nella finale**.

---

## 4. Refactor più ampi (prima di nuove modalità come "Top Dieci")

- **C1 — Eliminare i blocchi duplicati tra Squadra e Display** (finding #9): estrarre `renderCheckpointBody(s)` e `renderTiebreakWaitBody(s)` da `index.html:1068-1098` / `1264-1293`. Sono funzioni che dipendono solo da `state` e `teams`, quindi il rischio è basso.
- **C2 — Dati in nodi annidati e listener mirati** (audit §2.2): passare da `quizzettone/answers:<id>` a `quizzettone/answers/<id>`, e così via. Le squadre si iscrivono solo a `state`, `teams` e `answers` invece che a tutto l'albero, compresi domande ed effetti (`index.html:356`). Serve una migrazione una tantum ed è il prerequisito per regole serie (B1-C).
- **C3 — Non perdere i form dell'admin con gli aggiornamenti realtime**: dopo A7 i campi si svuotano ancora quando arriva un aggiornamento da Firebase (una squadra che risponde) e il file audio scelto va perso. Soluzioni: tenere il pannello domande/effetti fuori dal re-render, oppure salvare e ripristinare i valori prima e dopo `innerHTML`, tenendo il `File` in una variabile JS.
- **C4 — Ambiente di test** (audit §2.5): un secondo progetto Firebase scelto da `?env=test`, così si possono provare le modifiche senza toccare le domande vere.
- **C5 — State machine esplicita** (audit, roadmap punto 3): una tabella delle transizioni (`phase` → azioni possibili → fase successiva) e un unico `renderPhaseBody(role, s)`. È il punto in cui "Top Dieci" si aggancerebbe come nuova famiglia di fasi, senza moltiplicare gli `if/else` di `renderTeam`, `renderDisplay` e `renderAdmin`.

---

## 5. Checklist da approvare

Rispondi con i numeri che approvi (ad esempio "1-8 sì, 9 no"). Per le voci B indica anche l'opzione scelta.

**Fix sicuri**
1. [ ] A1 — Escape dei nomi squadra + controllo sugli id
2. [ ] A2 — Spareggio giocabile dai telefoni
3. [ ] A3 — Pareggio al 1° posto: in finale entrambe le squadre, senza spareggio inutile
4. [ ] A4 — Schermata di caricamento/errore
5. [ ] A5 — Invio risposta atomico
6. [ ] A6 — Timer sincronizzato con l'ora del server
7. [ ] A7 — Il tick aggiorna solo il timer (i campi admin non si svuotano più)
8. [ ] A8 — Controllo esito dell'ingresso squadra
9. [ ] A9 — Testo del checkpoint calcolato
10. [ ] A10 — Tabelle scrollabili su mobile
11. [ ] A11 — Mescolamento Fisher-Yates
12. [ ] A12 — Limite upload audio (10 MB?)

**Decisioni**
13. [ ] B1 — Regole Firebase: mandami le regole attuali + opzione A/B/C
14. [ ] B2 — Presenza: sì/no, e come trattare più dispositivi per squadra
15. [ ] B3 — Rientro squadra: A/B/C
16. [ ] B4 — Tre o più squadre pari al 1° posto: A/B/C
17. [ ] B5 — Pareggio in finale: A/B/C/D + vincitore solo sui punti della finale?
18. [ ] B6 — Eliminate in finale: A/B/C
19. [ ] B7 — Bonus velocità: A/B/C/D
20. [ ] B8 — Avviso generico sugli errori admin: sì/no
21. [ ] B9 — Ex aequo in classifica: sì/no
22. [ ] B10 — Regole: A/B/C

**Refactor** (dopo i punti sopra)
23. [ ] C1 · 24. [ ] C2 · 25. [ ] C3 · 26. [ ] C4 · 27. [ ] C5
