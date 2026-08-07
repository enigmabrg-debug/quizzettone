# Piano di implementazione consolidato — Quizzettone

> Piano operativo ancorato al codice reale (vedi `STATO_IMPLEMENTAZIONE_QUIZZETTONE.md` per l'audit
> puntuale su cui si basa). Copre solo i 🟡 Parziali e ❌ Mancanti; gli item ✅ (8, 31, 35, 37, 45, 47,
> 54, 56 — checkpoint dinamico, finalisti variabili, ingresso tardivo, pausa/ripresa timer, checklist
> pre-start, reveal classifica dal basso, modalità spettatore protetta, riepilogo+rivincita) non
> compaiono in nessun pacchetto.
>
> Priorità: prima i gate FT-01→FT-12 ancora aperti (11 su 12), poi le fasi 2-8 della roadmap del piano
> originale, nello stesso ordine. Gli arcade (fase 8) restano in fondo, uno alla volta.
>
> Ogni pacchetto (PL) indica: cosa manca, file toccati, approccio tecnico concreto sull'attuale
> struttura del codice, dipendenze, complessità (S/M/L/XL) e criterio di completamento verificabile.

---

## Gate iniziali — Fase 0-1 del piano originale (fondamenta ancora aperte)

Undici degli undici prerequisiti restanti (tutto FT-01→FT-11 tranne FT-12, già ✅) vanno chiusi prima
di costruire sopra scoring dinamico e nuove tipologie di domanda, per lo stesso motivo indicato dal
piano: oggi il "nucleo tecnico" instabile (stato piatto, XSS residuo, invii non atomici, timer non
autorevole) è esattamente il terreno su cui altrimenti si costruirebbero le nuove meccaniche.

### PL-01 — Chiudere l'XSS residuo (FT-03 / item 3)

- **Cosa manca:** `escapeHtml()` esiste ma non è applicata ovunque un nome squadra finisce in HTML.
  Il buco più grave è `rankRows()` (`js/render.js:27-34`), riusata da quasi tutte le schermate di
  classifica (Team, Display, Admin): un nome squadra con markup esegue codice ogni volta che una
  classifica si aggiorna. Altri punti non escapati: `renderTeam()` per il proprio nome
  (`js/render.js:334,420,439`), lobby Admin (`js/render.js:831`), classifica generale Admin
  (`js/render.js:1073`), `renderSpectatorFinal` (`js/render.js:475`), blocchi spareggio
  (`js/render.js:1004,1020,1027,1038,1048,1056`).
- **File toccati:** `js/render.js` (nei punti sopra elencati).
- **Approccio tecnico:** passare ogni interpolazione di `teams[id].name`/`teamName` da `escapeHtml()`.
  Per evitare che il problema si ripresenti in futuro, introdurre un piccolo helper
  `teamNameHtml(id)` che centralizza `escapeHtml(teams[id] ? teams[id].name : '—')` e sostituirlo
  nei punti sopra invece di chiamare `escapeHtml` ogni volta a mano.
- **Dipendenze:** nessuna.
- **Complessità:** S
- **Criterio di completamento:** ricerca testuale su `js/render.js` non trova più interpolazioni dirette
  di `.name` fuori da `escapeHtml`/`teamNameHtml`; un nome squadra tipo `<img src=x onerror=alert(1)>`
  compare come testo innocuo su Team, Display e Admin in ogni schermata di classifica.

### PL-02 — Loading, timeout, errore, retry all'avvio (FT-04 / item 4)

- **Cosa manca:** `render()` (`js/render.js:304-309`) fa `if(!state) return;` — se il primo snapshot
  Firebase non arriva, l'app resta bianca, senza indicazioni per l'utente. Esiste solo
  `connectionBadge()` per le disconnessioni *dopo* l'avvio.
- **File toccati:** `js/render.js` (funzione `render()` e nuova `renderBootScreen()`), `quizzettone.html`
  (script di boot).
- **Approccio tecnico:** introdurre una variabile locale `bootStatus` (`'connecting'|'ready'|'timeout'`)
  impostata in `startListening()`. Se non arriva alcun evento `value` entro N secondi (es. 8s, tramite
  `setTimeout`), mostrare una schermata con messaggio chiaro e un pulsante "Riprova" che richiama
  `stopListening()` + `startListening()`. Finché `bootStatus !== 'ready'`, `render()` mostra
  `renderBootScreen()` invece di ritornare silenziosamente.
- **Dipendenze:** nessuna (si integra con PL-03 per coerenza dei messaggi di errore).
- **Complessità:** S
- **Criterio di completamento:** aprendo l'app con la rete disattivata, entro il timeout configurato
  compare un messaggio esplicito con pulsante di retry funzionante; nessuna schermata bianca in nessun
  ruolo (Team/Admin/Display).

### PL-03 — Gestire gli esiti reali delle operazioni Firebase (FT-05 / item 5)

- **Cosa manca:** `safeGet/safeSet/safeDelete` (`js/firebase-init.js:33-46`) restituiscono già
  `true/false`/`null`, ma quasi nessun chiamante in `js/actions.js` controlla l'esito: join, invio
  risposta, cambio fase, reset procedono come se l'operazione fosse sempre riuscita.
- **File toccati:** `js/actions.js` (funzioni critiche: `teamJoin`, `teamSubmitAnswer`,
  `adminStartGame`, `adminSaveSetup`, `adminAdjustPoints`, `adminResetGame`), `js/render.js` (feedback UI).
- **Approccio tecnico:** non riscrivere tutte le ~40 funzioni in un colpo solo. Partire dai flussi
  citati esplicitamente dal piano (join, risposta, cambio fase, correzione punti, reset) e far
  controllare a ciascuna il valore di ritorno di `safeSet`; in caso di `false`, mostrare un banner di
  errore con retry invece di procedere con `refresh()`. Riusare `showConfirmModal`/un nuovo
  `showErrorBanner` già nello stile esistente di `js/render.js`.
- **Dipendenze:** nessuna diretta; va di pari passo con PL-06 (la transazione di invio risposta deve
  anch'essa comunicare l'esito).
- **Complessità:** M
- **Criterio di completamento:** simulando un fallimento di scrittura (es. disconnettendo la rete a
  metà operazione) su join/risposta/reset, l'interfaccia mostra un errore esplicito e NON avanza come
  se l'operazione fosse riuscita.

### PL-04 — Verificare e versionare le regole Firebase (FT-02 / item 2)

- **Cosa manca:** nessun file `database.rules.json`/`storage.rules`/`.firebaserc` nel repo; le regole
  realmente attive in console non sono documentate.
- **File toccati:** nuovi file nel repo: `database.rules.json`, `storage.rules`, `.firebaserc`.
- **Approccio tecnico:** esportare le regole attualmente attive per il progetto `quizzettone-49543`
  dalla console Firebase, versionarle nel repo con un breve commento su chi può leggere/scrivere
  ciascun ramo (oggi presumibilmente tutto pubblico, dato che non c'è autenticazione — da confermare).
  Nessuna modifica di comportamento in questo pacchetto: solo verifica e versionamento.
- **Dipendenze:** nessuna; è un prerequisito concettuale per PL-05 (bisogna sapere cosa replicare sul
  progetto di test).
- **Complessità:** M
- **Criterio di completamento:** le regole versionate nel repo coincidono esattamente con quelle in
  console (verificabile con `firebase deploy --only database,storage --dry-run` o confronto manuale);
  è documentato chi può scrivere ogni ramo.

### PL-05 — Reset a due passaggi con checklist di backup manuale (FT-01 / item 1, versione rivista)

> **Nota di revisione:** questo pacchetto sostituisce l'approccio originale (secondo progetto Firebase
> reale) per decisione esplicita presa durante l'esecuzione. Verificato che nel repo non esisteva alcuna
> implementazione precedente di questa alternativa (né codice né traccia in `git log`): FT-01 resta
> aperto finché questo pacchetto non viene eseguito. Un secondo progetto Firebase avrebbe isolato i dati
> di prova da quelli reali; questa versione non lo fa — riduce invece il rischio con un reset che non può
> più partire da un click distratto, chiedendo all'admin di confermare esplicitamente di aver già
> messo al sicuro ciò che conta prima di procedere. È una mitigazione più leggera, coerente con un
> progetto hobbistico mantenuto da una sola persona, non un sostituto equivalente dell'isolamento reale.
- **Cosa manca:** `adminResetGame` (`js/actions.js`) è protetto solo da una singola `showConfirmModal`
  generica ("Azzerare tutta la partita?..."), senza alcun controllo che l'admin abbia effettivamente
  pensato a salvare ciò che serve prima di cancellare squadre, risposte e punteggi.
- **File toccati:** `js/render.js` (nuovo modale a due passaggi, al posto della `showConfirmModal`
  usata oggi da `btnReset`).
- **Approccio tecnico:** nuova funzione `showResetChecklistModal(onConfirm)` in `js/render.js`:
  1. **Step 1 — checklist:** un modale con caselle da spuntare (nessuna preselezionata): "Ho salvato o
     annotato il podio/le statistiche della serata (se rilevanti)", "Nessuna squadra deve ancora vedere
     un risultato non ancora rivelato", "Sono sicuro/a: squadre, risposte e punteggi verranno cancellati
     e l'azione non è annullabile con 'Annulla ultima azione'". Il pulsante "Continua" resta disabilitato
     finché non sono tutte spuntate.
  2. **Step 2 — conferma definitiva:** dopo "Continua", il modale mostra un'ultima conferma esplicita
     ("Reset definitivo") che richiama `adminResetGame` solo al click.
  3. `btnReset` in `renderAdmin` chiama `showResetChecklistModal(adminResetGame)` al posto
     dell'attuale `showConfirmModal(...)`.
- **Dipendenze:** nessuna (PL-04 non è stato eseguito in questa sessione, per la decisione FT-02 presa
  a monte: nessuna azione sulle regole Firebase).
- **Complessità:** S
- **Criterio di completamento:** cliccando "Reset partita" compare la checklist con il pulsante di
  continuazione disabilitato; il reset vero e proprio (`adminResetGame`) non viene mai chiamato finché
  tutte le caselle non sono spuntate e la conferma finale non è stata cliccata esplicitamente.

### PL-06 — Invio atomico delle risposte (FT-06 / item 6)

- **Cosa manca:** `teamSubmitAnswer` (`js/actions.js:677-689`) e `adminSubmitTestAnswer`
  (`js/actions.js:412-420`) fanno ancora read-then-write (`safeGet` poi `safeSet`), non una
  `transaction()`.
- **File toccati:** `js/actions.js` (le due funzioni sopra), `js/render.js`
  (`attachTeamOptionHandlers`, per il blocco immediato del pulsante).
- **Approccio tecnico:** sostituire il pattern con
  `db.ref(DB_ROOT+'/answers:'+teamId).child(key).transaction(current => current ? undefined : {...})`,
  così una seconda scrittura concorrente sullo stesso `key` viene automaticamente scartata dall'SDK
  (stesso pattern già usato correttamente in `closeAnswersTransactional`, `js/actions.js:104-116`).
  Disabilitare il pulsante lato UI immediatamente al click, riabilitarlo solo se la transazione
  fallisce (coerente con FT-05/PL-03).
- **Dipendenze:** idealmente dopo PL-11 (timestamp server) per un bonus velocità coerente, ma la parte
  "niente doppio invio" può partire subito.
- **Complessità:** M
- **Criterio di completamento:** due click ravvicinati sullo stesso pulsante, o due tab della stessa
  squadra che rispondono quasi simultaneamente, producono sempre una sola risposta registrata.

### PL-07 — Join squadra atomico e univoco per nome (FT-08 / item 7)

- **Cosa manca:** `findTeamByName`/`teamJoin` (`js/actions.js:552-588`) fanno un check-then-act senza
  transazione: due join simultanei con lo stesso nome possono creare due squadre gemelle. Manca anche
  una funzione di rinomina da Admin.
- **File toccati:** `js/actions.js` (`teamJoin`, nuova `adminRenameTeam`), `js/render.js` (lobby Admin).
- **Approccio tecnico:** introdurre un nodo indice `teamNames:<nome-normalizzato>` scritto con una
  `transaction()` che fallisce (ritorna `undefined`) se la chiave esiste già; solo se la transazione
  riesce si crea la `teaminfo:` corrispondente. Aggiungere un pulsante "Rinomina" nella lobby Admin che
  aggiorna sia `teaminfo:` sia l'indice.
- **Dipendenze:** nessuna diretta; condivide il pattern `transaction()` con PL-06.
- **Complessità:** M
- **Criterio di completamento:** un test e2e che apre due tab e invia lo stesso nome squadra quasi
  simultaneamente produce una sola squadra; l'admin può rinominare una squadra dalla lobby.

### PL-08 — Validazione e limiti sui file media (item 9)

- **Cosa manca:** `uploadAudioFile` (`js/firebase-init.js:25-31`) carica qualunque file selezionato,
  senza controllo di dimensione o tipo MIME.
- **File toccati:** `js/firebase-init.js`, `js/render.js` (form upload domande/effetti).
- **Approccio tecnico:** aggiungere un controllo lato client prima dell'upload (dimensione massima
  configurabile, es. 8MB; `file.type.startsWith('audio/')`), con messaggio d'errore chiaro nello stesso
  punto dove oggi appare "Caricamento audio...".
- **Dipendenze:** nessuna.
- **Complessità:** S
- **Criterio di completamento:** un file troppo grande o di tipo non ammesso viene rifiutato prima
  dell'upload, con messaggio visibile all'admin.

---

## Fase 2 del piano — Nuovo modello di sessione e configurazione

### PL-09 — Modello dati di sessione strutturato (FT-09 / item 10)

- **Cosa manca:** tutto vive in un unico nodo piatto `DB_ROOT` con chiavi a prefisso stringa
  (`teaminfo:`, `answers:`, `overrides:`, `question:`, `effect:`); niente concetto di sessione.
- **File toccati:** `js/firebase-init.js`, `js/state.js` (`startListening`, `withDefaults`),
  `js/actions.js` (praticamente ogni funzione che scrive su Firebase), `js/render.js` (nessuna modifica
  di markup, solo dei riferimenti a `state`/`teams`/ecc. che restano invariati come variabili locali).
- **Approccio tecnico:** introdurre `sessions/{sessionId}/{config,runtime,teams,questionInstances,
  answers,scoreLedger,events}`, con `questionBank` e (in futuro) `hallOfFame` come nodi globali
  separati. Per non introdurre subito il multi-sessione (fuori scope, il gioco resta un evento dal
  vivo alla volta), usare un `sessionId` fisso (es. `'current'`) inizialmente. Scrivere una funzione di
  migrazione one-shot (sullo stile di `withDefaults`, già presente per la retrocompatibilità dei campi
  mancanti) che sposta lo stato piatto esistente nella nuova struttura al primo avvio dopo il deploy.
  Aggiornare `startListening()` per smistare sui rami invece che per prefisso stringa.
- **Dipendenze:** eseguire dopo PL-01→PL-08 (i gate di sicurezza/affidabilità), per non introdurre una
  migrazione di schema su un terreno ancora instabile. Prerequisito di PL-04 aggiornato (le regole
  vanno riscritte per il nuovo schema).
- **Complessità:** XL
- **Criterio di completamento:** ogni fase legge/scrive un ramo dedicato; `startListening()` non fa più
  smistamento per prefisso stringa; aggiungere un campo a `questionInstances` non richiede toccare
  `teams` o `answers`; una partita esistente migra senza perdita di dati al primo avvio.

### PL-10 — Snapshot di configurazione per domanda + versione (FT-10 / item 11)

- **Cosa manca:** solo `durationMs` del timer è catturato all'apertura della domanda
  (`openQuestionTimer`, `js/actions.js:4-10`); lo scoring resta letto "a caldo" da `scoringFor()`
  (`js/state.js:285-292`), quindi cambiare il punteggio di default a metà partita ricalcola anche le
  domande già giocate senza override esplicito.
- **File toccati:** `js/actions.js` (apertura domanda), schema `questionInstances` (da PL-09).
- **Approccio tecnico:** al momento dell'apertura di ogni domanda, scrivere nell'istanza lo scoring
  effettivo, la policy di risposta e — quando disponibile (PL-15) — la classifica congelata.
  Incrementare un `config.version` a ogni salvataggio di `adminSaveSetup`.
- **Dipendenze:** PL-09 (serve il nodo `questionInstances`).
- **Complessità:** L
- **Criterio di completamento:** cambiare lo scoring di default a metà partita non altera il punteggio
  già calcolato per le domande precedenti (verificabile con un test e2e dedicato).

### PL-11 — Tempo autorevole condiviso + fasi separate presentazione/sblocco/timer (FT-11 / item 36)

> **Nota di revisione:** prima di iniziare l'implementazione, l'utente ha chiesto di far confluire in
> questo pacchetto — allargandolo — una parte ridotta del documento di riferimento
> `PROPOSTA_SCHERMO_CONDIVISO_completa.md` (progetto completo di modalità "schermo condiviso", non
> implementato per intero: qui entra solo il sottoinsieme elencato sotto). Motivazione: il lavoro di
> PL-11 tocca comunque il cuore del ciclo di vita della domanda (apertura, timer, sblocco risposte), ed
> è il punto naturale per smettere di trattare "la domanda è mostrata" e "le risposte sono sbloccate" e
> "il timer è partito" come un solo istante — un presupposto che una futura modalità a schermo condiviso
> (proiettore/TV comune, risposta da telefono separata) romperebbe strutturalmente se non separato ora.
> Non è un'implementazione della modalità schermo condiviso in sé (niente vista Display dedicata, niente
> UI di scelta reale tra `team_devices`/`shared_screen` oltre al campo dati) — solo la separazione dei
> tre momenti e le fondamenta dati minime perché una futura Display possa appoggiarsi. Restano
> esplicitamente **fuori scope** (anche se presenti nel documento di riferimento completo):
> `instanceId`/`activityId`/`revision` sulle risposte, un registro `ACTIVITY_TYPES`, `displayPresence.
> capabilities`, uno switch lettere/testo per i pulsanti risposta, uno `spectatorContentMode`
> configurabile (lo spettatore resta sempre a contenuto pieno, hardcoded, come oggi).
- **Cosa manca (parte originale, tempo autorevole):** il timer usa `Date.now()` del client admin
  (`js/actions.js:4-10,135-150`), non `firebase.database.ServerValue.TIMESTAMP` né
  `.info/serverTimeOffset`.
- **Cosa manca (parte aggiunta, fasi/presentazione — 9 punti ridotti dal documento di riferimento):**
  1. Un campo di configurazione `sessionConfig.displayMode` (`team_devices` | `shared_screen` |
     `hybrid`), impostabile in Sala pre-partita, default `team_devices` (comportamento attuale).
  2. Due campi riservati sul contratto domanda futuro di PL-18: `presentation.mode` e
     `sharedScreenRequirement` (solo riserva di schema qui; PL-18 li userà davvero).
  3. Tre timestamp distinti per istanza di domanda invece di un solo "timer partito":
     `presentedAt` (la domanda è mostrata), `inputUnlockedAt` (le risposte sono sbloccabili),
     `timerStartedAt` (il countdown è partito). `timeRemaining()` calcola sempre da `timerStartedAt`.
  4. Un resolver `resolvePresentationMode()` che scrive una sola volta `state.presentation.
     resolvedMode` risolvendo `displayMode` (niente ricalcolo continuo).
  5. Due politiche di sblocco risposte: `immediate` (comportamento attuale: sblocco e timer coincidono,
     usata quando `displayMode==='team_devices'`) e `manual` (default quando `displayMode==='shared_screen'`
     o `'hybrid'`: la domanda è mostrata ma le risposte restano bloccate finché l'admin non preme un
     pulsante esplicito "Apri risposte", che sblocca l'input e fa partire il timer nello stesso istante).
  6. Vista Team: quando `displayMode!=='team_devices'` e l'input non è ancora sbloccato, mostra solo un
     messaggio "Guarda lo schermo condiviso" al posto delle opzioni di risposta.
  7. Un fallback manuale per singola domanda: pulsante admin "Mostra domanda sui telefoni"
     (`presentation.fallbackActive`), nessun fallback automatico — se lo schermo condiviso non
     funziona, l'admin lo attiva a mano per quella domanda.
  8. Contenuto spettatore resta sempre pieno, hardcoded (nessun nuovo switch di configurazione).
  9. Un heartbeat di presenza per un futuro ruolo Display (`connected` + `lastSeenAt`, aggiornato ogni
     2-3s, con `onDisconnect()`), stesso pattern già usato per la presenza squadra
     (`armPresence`/`disarmPresence`, PL-09).
- **File toccati:** `js/actions.js` (apertura/pausa/ripresa timer, apertura domanda, nuova azione
  "Apri risposte", nuovo fallback per-domanda, heartbeat), `js/state.js` (`serverNow()`, offset,
  `resolvePresentationMode()`, `defaultState()`/`withDefaults()` per i nuovi campi), `js/render.js`
  (`timeRemaining()` — la sua definizione reale è qui, non in `js/state.js` come indicato nella
  versione precedente di questa voce di piano —, Sala pre-partita per `displayMode`, vista Team per lo
  stato "guarda lo schermo condiviso", pulsanti admin "Apri risposte"/"Mostra domanda sui telefoni").
- **Approccio tecnico:** leggere una volta `db.ref('.info/serverTimeOffset').on('value', ...)` e tenere
  un offset locale in `js/state.js`, con un helper `serverNow()` che sostituisce `Date.now()` nei punti
  critici per il timer (apertura/pausa/ripresa/aggiustamento timer, timestamp `ts` delle risposte);
  `Date.now()` non timer-critico (`joinedAt`, `createdAt`, ecc.) resta invariato, nessuna riscrittura
  generale. `closeAnswersTransactional` già valuta la scadenza lato server nella transazione, quindi il
  grosso del lavoro sul tempo autorevole è sul countdown visuale e sull'apertura/ripresa. Per le fasi
  separate: `adminNextQuestion`/`adminContinueFromCheckpoint` scrivono `presentedAt` all'apertura; se
  la policy è `immediate` scrivono anche `inputUnlockedAt`+`timerStartedAt` nello stesso istante (oggi);
  se `manual`, questi due restano `null` finché l'admin non preme "Apri risposte" (nuova azione che li
  scrive insieme). L'heartbeat Display riusa il meccanismo `.info/connected`+`onDisconnect()` già
  presente per la presenza squadra, su un nuovo ramo `presencePath('display', connId)`.
- **Dipendenze:** nessuna rispetto a PL-09 (di cui riusa i rami `state`/`questionInstances`/`presence`);
  da fare prima di completare PL-06 (bonus velocità coerente) e PL-14 (bonus per ordine). Le due parti
  di questo pacchetto (tempo autorevole, fasi separate) sono correlate ma indipendenti internamente —
  possono essere implementate e testate in sequenza all'interno dello stesso commit.
- **Criterio di completamento (parte originale):** con l'orologio di un dispositivo volutamente sfasato
  di alcuni minuti, il countdown mostrato converge con gli altri dispositivi entro ~500ms (obiettivo
  dichiarato dal piano, domanda aperta §8.3).
- **Criterio di completamento (parte aggiunta):** con `displayMode:'team_devices'` (default) il
  comportamento è identico a oggi (sblocco e timer coincidono con l'apertura). Con
  `displayMode:'shared_screen'`, dopo l'apertura della domanda la squadra vede "Guarda lo schermo
  condiviso" e non può rispondere finché l'admin non preme "Apri risposte"; da quel momento in poi
  input e timer partono insieme e il flusso torna identico a oggi. Il pulsante "Mostra domanda sui
  telefoni" sblocca manualmente l'input per la domanda corrente senza toccare la configurazione
  globale. Un client con ruolo Display simulato nei test aggiorna `lastSeenAt` periodicamente e la sua
  presenza risulta `connected:false` dopo la disconnessione.

### PL-12 — Sala pre-partita: riepilogo e preset (item 12, 13, 14)

- **Cosa manca:** nessun preset selezionabile (Classica/Rapida/Tutti contro tutti/Personalizzata);
  nessun riepilogo prima dello start; nessun salvataggio/duplicazione di configurazioni.
- **File toccati:** `js/render.js` (`renderSalaPrePartita`), `js/actions.js` (`adminSaveSetup`,
  `adminStartGame`), nuovo nodo `presets/`.
- **Approccio tecnico:** aggiungere 4 pulsanti preset che precompilano i campi del form esistente con i
  valori dichiarati dal piano §4.1 (nessun nuovo motore, solo default diversi); aggiungere una
  schermata di riepilogo testuale prima dello start (le regole scelte, in chiaro); salvare preset
  personalizzati in `presets/` riusabili tra partite.
- **Dipendenze:** PL-10 (versione config, per coerenza del salvataggio preset).
- **Complessità:** M
- **Criterio di completamento:** selezionando "Partita rapida" i campi si precompilano con 1 manche da
  10, 2 finalisti, finale da 5; un preset personalizzato salvato è riselezionabile in una partita
  successiva.

---

## Fase 3 del piano — Scoring dinamico

### PL-13 — Motore di scoring a profili (item 25, 29)

- **Cosa manca:** esiste solo un profilo statico `correct/wrong/noAnswer` più un bonus velocità
  lineare a finestra temporale; nessun profilo Classico/Dinamico/Personalizzato selezionabile.
- **File toccati:** `js/state.js` (`scoringFor`, `pointsForAnswer`, `teamPointsForQuestion`),
  `js/render.js` (Sala pre-partita, pillole punteggio in `renderTeamQuestion`).
- **Approccio tecnico:** introdurre un selettore di profilo in config; il profilo "classico" mantiene
  esattamente il comportamento attuale (retrocompatibilità già garantita dal pattern `withDefaults`),
  il profilo "dinamico" attiva bonus ordine + penalità fascia + rimonta (PL-14/15).
- **Dipendenze:** PL-09/PL-10 (classifica congelata e snapshot per domanda sono prerequisiti tecnici).
- **Complessità:** L
- **Criterio di completamento:** cambiare profilo nella Sala pre-partita cambia in modo coerente e
  testabile la formula di calcolo punti (test unitari sulle funzioni pure di scoring).

### PL-14 — Bonus per ordine delle risposte corrette (item 26)

- **Cosa manca:** `computeSpeedBonusAtSubmission` (`js/state.js:304-313`) è un decadimento lineare nel
  tempo, non un bonus basato sull'ordine di arrivo tra le sole risposte corrette.
- **File toccati:** `js/state.js` (nuova funzione di calcolo bonus, eseguita alla chiusura della
  domanda, non al submit).
- **Approccio tecnico:** al momento della chiusura (`closeAnswersTransactional` o un passo successivo),
  ordinare le risposte corrette per `ts` server-autorevole (PL-11) e assegnare il bonus dalla tabella
  configurabile (default 25/20/15/10/5%), con numerazione competitiva per i pari-merito a timestamp
  identico.
- **Dipendenze:** PL-11 (timestamp server), PL-13 (profilo dinamico).
- **Complessità:** M
- **Criterio di completamento:** con 3 squadre che rispondono correttamente in ordine noto, i punti
  assegnati rispecchiano esattamente la tabella bonus configurata; due risposte a timestamp identico
  ricevono lo stesso bonus.

### PL-15 — Penalità adattiva e bonus rimonta (item 27, 28)

- **Cosa manca:** nessuna fascia/moltiplicatore di posizione: `wrong` è un valore fisso identico per
  tutte le squadre indipendentemente dalla loro posizione in classifica.
- **File toccati:** `js/state.js` (`pointsForAnswer`), snapshot `questionInstances` (PL-10).
- **Approccio tecnico:** prima di aprire la domanda, congelare la classifica corrente e calcolare la
  fascia (prime 10%, 11-25%, 26-50%, 51-75%, ultime 25%) per ogni squadra, salvandola nello snapshot
  della domanda (PL-10); applicare moltiplicatore di penalità e bonus rimonta secondo le tabelle
  configurabili dal piano §4.2.
- **Dipendenze:** PL-10 (classifica congelata), PL-13.
- **Complessità:** M
- **Criterio di completamento:** con una domanda da 1.000 punti e i default consigliati, una squadra in
  testa e una in fondo che sbagliano perdono rispettivamente ~400 e ~140 punti (verificabile con test
  unitario sulla formula).

### PL-16 — Modalità finale Azzera/Mantieni/Vantaggio realmente funzionante (item 30, meccanica 4.3)

- **Cosa manca:** `scoreCarryover` (`js/state.js:136`) è configurabile in UI ma **non è mai letto** da
  nessuna funzione di scoring: `totalScore()` (`js/state.js:335`) somma sempre
  `qualificationScore + roundScore('final')`, comportamento sempre equivalente a "Mantieni".
- **File toccati:** `js/state.js` (`totalScore`, `qualificationScore`), `js/actions.js`
  (`adminContinueToFinal`).
- **Approccio tecnico:** far leggere realmente `scoreCarryover` dalle funzioni di scoring: `'reset'`
  azzera il punteggio di partenza dei finalisti (il punteggio finale diventa solo `roundScore('final')`
  per i finalisti), `'keep'` mantiene il comportamento attuale, `'convert'` applica la tabella vantaggio
  configurabile per posizione di qualificazione (nuovo campo config, es. `finalistBonusTable`).
- **Dipendenze:** PL-13.
- **Complessità:** M
- **Criterio di completamento:** impostando "Azzera", i finalisti iniziano la finale da 0 punti
  indipendentemente dal punteggio di qualificazione; il test e2e `phase2-finals.spec.js` copre le tre
  modalità.

### PL-17 — Trasparenza delle regole + test delle formule (item 50, §2.3 del piano)

- **Cosa manca:** nessun indicatore di rischio mostrato alle squadre prima di rispondere; nessun test
  unitario sulle formule di scoring.
- **File toccati:** `js/render.js` (`renderTeamQuestion`), nuovo `tests/unit/scoring.spec.js` (o
  equivalente eseguibile con lo stesso runner Playwright/Node già in uso).
- **Approccio tecnico:** mostrare un indicatore sintetico (es. "Rischio errore ×1,75", "Bonus rimonta
  +5%") derivato dalla fascia congelata (PL-15); scrivere test ripetibili sulle funzioni pure di
  scoring (`pointsForAnswer`, bonus ordine, penalità, rimonta) coprendo i casi limite (pari merito,
  fascia limite, astensione).
- **Dipendenze:** PL-13/14/15/16.
- **Complessità:** S
- **Criterio di completamento:** i test unitari passano in CI/locale e coprono i casi limite; le
  squadre vedono l'indicatore di rischio prima di rispondere quando il profilo dinamico è attivo.

---

## Fase 4 del piano — Tutte le tipologie principali

### PL-18 — Contratto comune delle domande (item 15)

> **Nota di collegamento (da PL-11):** PL-11 ha riservato due campi che questo pacchetto deve popolare
> davvero: `presentation.mode` (come la domanda va presentata, in relazione a `sessionConfig.
> displayMode`) e `sharedScreenRequirement` (se la domanda richiede necessariamente lo schermo
> condiviso, es. contenuto multimediale grande). Finché PL-18 non li implementa, restano riservati ma
> inerti (nessuna domanda esistente li imposta, nessun ramo di codice li legge).

- **Cosa manca:** le domande hanno solo `pool/category/question/options/correctIndex/adminNote/
  audioUrl` (`js/state.js:488-518`); nessun contratto con tipo di contenuto/risposta, tolleranza,
  politica di risposta dichiarati.
- **File toccati:** `js/state.js` (schema domanda, `addQuestion`, `bulkAddQuestions`,
  `parseBulkQuestions`), `js/render.js` (question manager).
- **Approccio tecnico:** estendere l'oggetto domanda con `contentType` ('testo'|'immagine'|'audio'|
  'video'), `answerType` ('scelta'|'vero_falso'|'ordinamento'|'numero'|'testo_libero'), `tolerance`,
  `answerPolicy`, `difficulty`, mantenendo `options`/`correctIndex` per compatibilità con le domande
  esistenti già seedate (`Q1`/`Q2`/`QF` in `js/state.js:2-47`, che restano valide con
  `answerType:'scelta'` di default).
- **Dipendenze:** PL-09 (questionInstances), PL-13 (lo scoring a profili userà questi campi).
- **Complessità:** L
- **Criterio di completamento:** una domanda salvata dichiara esplicitamente tipo di contenuto e tipo
  di risposta; il question manager li mostra e li valida; le domande seed esistenti continuano a
  funzionare senza migrazione manuale.

### PL-19 — Vero/falso, domanda fotografica, consolidamento audio (item 17, 18, 19)

- **Cosa manca:** nessun preset a 2 opzioni; nessun campo immagine/upload/anteprima/fallback; audio già
  presente ma senza validazione dimensione/formato né gestione errori lato squadra.
- **File toccati:** `js/render.js` (question manager, `renderTeamQuestion`), `js/state.js`,
  `js/firebase-init.js` (upload immagine, stesso pattern di `uploadAudioFile`).
- **Approccio tecnico:** vero/falso riusa il motore scelta multipla esistente con 2 opzioni fisse e un
  preset di malus maggiorato (nessun nuovo motore); foto tramite nuovo campo `imageUrl` caricato su
  Storage con lo stesso pattern di `uploadAudioFile`, tag `<img>` in `renderTeamQuestion`/Display con
  fallback testuale se il caricamento fallisce; estendere la validazione di PL-08 anche alle immagini.
- **Dipendenze:** PL-18.
- **Complessità:** M (ciascuno)
- **Criterio di completamento:** una domanda vero/falso mostra 2 sole opzioni con malus configurato;
  una domanda fotografica mostra l'immagine su Team/Display/Admin con anteprima in fase di creazione e
  un messaggio di fallback se l'URL non carica.

### PL-20 — Stima numerica + spareggio numerico funzionante (item 23, 33, tipologia 3.9)

- **Cosa manca:** nessun motore di risposta numerica; l'opzione "Più vicino al valore corretto" è
  selezionabile in Sala pre-partita (`js/render.js:712-717`) ma `computeTiebreakAutoWinner`
  (`js/state.js:343-357`) gestisce solo `'prima_corretta'`/`'corretta_veloce'` — selezionarla oggi non
  cambia nulla.
- **File toccati:** `js/state.js` (nuovo `answerType:'numero'`, `computeTiebreakAutoWinner`),
  `js/render.js` (nuovo componente input numerico).
- **Approccio tecnico:** nuovo tipo di risposta con campo numerico, unità mostrata, calcolo punteggio
  per tolleranza/fascia di errore percentuale; per lo spareggio, implementare realmente la regola
  `'numerica'` già presente nel select (vince chi è più vicino, a parità prevale il timestamp server
  più rapido grazie a PL-11).
- **Dipendenze:** PL-18, PL-11.
- **Complessità:** M
- **Criterio di completamento:** selezionando "Più vicino al valore corretto", uno spareggio numerico
  produce un vincitore automatico coerente con la regola dichiarata (oggi non succede nulla di diverso
  da `'prima_corretta'`).

### PL-21 — Motore di ordinamento (item 22, tipologia 3.8)

- **Cosa manca:** nessun motore drag&drop o su/giù, nessuna serializzazione dell'ordine.
- **File toccati:** `js/render.js` (nuovo componente), `js/state.js` (serializzazione ordine, scoring
  tutto-o-niente).
- **Approccio tecnico:** nuovo `answerType:'ordinamento'`; interfaccia mobile-friendly con pulsanti
  su/giù come alternativa accessibile al trascinamento (come richiesto esplicitamente dal piano §3.8).
- **Dipendenze:** PL-18.
- **Complessità:** L
- **Criterio di completamento:** una domanda di ordinamento è giocabile da mobile senza drag (solo
  pulsanti su/giù), valutata corretta solo se l'ordine è interamente esatto.

### PL-22 — Domanda video (item 20, tipologia 3.6)

- **Cosa manca:** nessun supporto video in nessun file.
- **File toccati:** `js/render.js`, `js/state.js`.
- **Approccio tecnico:** campo `videoUrl` (solo URL/metadati in Firebase, mai il file binario nel nodo
  realtime, come richiesto dal piano); tag `<video>` con poster di caricamento, controllo riproduzione,
  modalità silenziosa/sonora, fallback se l'URL non carica (riuso del pattern di PL-19).
- **Dipendenze:** PL-18, PL-19 (pattern upload/fallback media).
- **Complessità:** L
- **Criterio di completamento:** una domanda video riproduce correttamente su Display senza appesantire
  il payload Firebase (verificabile ispezionando la dimensione del nodo `questionInstances`).

### PL-23 — Risposta testuale ibrida con alias e revisione Admin (item 24, tipologia 3.10)

- **Cosa manca:** nessun campo di testo libero, nessuna coda "da revisionare", nessun sistema di alias.
- **File toccati:** `js/state.js` (normalizzazione testo, coda revisione), `js/render.js` (nuovo
  componente testo libero + pannello revisione Admin), `scoreLedger` (da PL-09).
- **Approccio tecnico:** normalizzazione (maiuscole/minuscole, accenti, punteggiatura); confronto con
  risposta principale + alias preparati dall'admin; le corrispondenze non normalizzate finiscono in
  stato "da revisionare"; approvazione/rifiuto manuale con applicazione coerente a tutte le risposte
  equivalenti della stessa domanda; il fuzzy matching resta solo un suggerimento, mai
  un'assegnazione automatica di punti.
- **Dipendenze:** PL-18, PL-06 (la finestra di modifica pre-conferma richiesta dal piano si appoggia
  sull'invio atomico), PL-01 (escaping, dato che qui l'input libero dell'utente è massimo).
- **Complessità:** XL (la più alta dichiarata anche dal piano originale)
- **Criterio di completamento:** una risposta non riconosciuta finisce in coda "da revisionare";
  l'approvazione di un alias si applica retroattivamente a tutte le risposte equivalenti della stessa
  domanda.

### PL-24 — Categoria Logica trasversale + editor/controlli pre-start per tutti i tipi (item 21)

- **Cosa manca:** "Logica" non è tra le `CATEGORIES` (`js/state.js:49`); `computePreGameChecklist`
  valida solo il formato scelta multipla a 4 opzioni.
- **File toccati:** `js/state.js` (`CATEGORIES`, `computePreGameChecklist`), `js/render.js` (question
  manager).
- **Approccio tecnico:** aggiungere "Logica" alle categorie; estendere la checklist pre-start per
  validare ogni `answerType` introdotto da PL-19→23 (soluzione mancante, media assenti, alias non
  validi per il testo libero).
- **Dipendenze:** PL-18→23 (tutte le tipologie devono esistere prima di poterle validare/anteprimare).
- **Complessità:** S
- **Criterio di completamento:** la checklist pre-start segnala correttamente una domanda di ciascun
  tipo con soluzione mancante o media assente.

---

## Fase 5 del piano — Regia live, lobby e recupero

### PL-25 — Regole modificabili live con effetto prospettico (item 32, meccanica 4.9)

- **Cosa manca:** `adminSaveSetup` (`js/actions.js:81-93`) rifiuta ogni scrittura quando
  `state.setupLocked` è `true` (impostato da `adminStartGame`): nessuna regola strutturale è
  modificabile dopo lo start.
- **File toccati:** `js/actions.js` (`adminSaveSetup`), `js/render.js` (Sala pre-partita/pannello di
  regia).
- **Approccio tecnico:** distinguere modifiche "sicure" (applicabili subito, es. timer di default per
  le prossime domande) da modifiche strutturali (numero di finalisti, regola finale, numero di manche)
  che richiedono anteprima dell'effetto e conferma esplicita. Usare lo snapshot per domanda (PL-10) per
  garantire che nulla di già giocato venga ricalcolato. Rifiutare con spiegazione le operazioni
  impossibili (es. più finalisti delle squadre disponibili).
- **Dipendenze:** PL-10 (snapshot), PL-12 (Sala pre-partita).
- **Complessità:** L
- **Criterio di completamento:** cambiare il numero di finalisti mentre la manche 1 è in corso non
  altera nulla di già giocato e si applica solo alla successiva fase "Svela finaliste"; un tentativo di
  impostare più finalisti delle squadre disponibili viene rifiutato con spiegazione visibile.

### PL-26 — Timer: comandi loggati, durate preimpostate, "nessun timer" (item 36/38 completamento)

- **Cosa manca:** i comandi timer (pausa/±5/riapri/annulla) non passano da `withUndo` e non compaiono
  nello storico; nessuna durata preimpostata (10/15/20/30/45/60s), nessuna opzione "nessun timer".
- **File toccati:** `js/actions.js` (comandi timer), `js/render.js` (select durate).
- **Approccio tecnico:** far passare i comandi timer dal registro eventi esteso (PL-27) invece che da
  `safeSet` diretto; aggiungere un select con le durate preimpostate + "personalizzata" + "nessun
  timer" (durata `null` → nessun countdown, chiusura solo manuale via `adminCloseAnswers`).
- **Dipendenze:** PL-11 (tempo autorevole), PL-27 (registro eventi).
- **Complessità:** M
- **Criterio di completamento:** ogni comando timer compare nello storico eventi; selezionando "nessun
  timer" la domanda resta aperta finché l'admin non la chiude manualmente.

### PL-27 — Registro eventi esteso + "ultimo contatto" (item 43, 40)

- **Cosa manca:** solo alcune azioni passano da `withUndo`/`history.log` (`js/actions.js:25-48`);
  apertura/chiusura domanda, comandi timer, cambio regole, reveal soluzione, cambio Modalità Party non
  vengono loggati. Nessun timestamp "ultimo contatto" per le squadre offline.
- **File toccati:** `js/actions.js` (generalizzare il logging), `js/state.js`
  (`armPresence`/`disarmPresence`).
- **Approccio tecnico:** generalizzare il pattern di logging già esistente a tutte le azioni ad alto
  impatto elencate dal piano §4.10. Salvare un campo `lastSeenAt` per squadra aggiornato lato client a
  ogni `armPresence`/`disarmPresence` (senza introdurre Cloud Functions, fuori scope per un progetto
  hobbistico).
- **Dipendenze:** PL-09 (nodo `events` dedicato, per non appesantire ulteriormente il singolo oggetto
  `state`).
- **Complessità:** L
- **Criterio di completamento:** il pannello "Storico azioni" mostra ogni comando ad alto impatto della
  sessione corrente; l'admin vede l'orario dell'ultimo contatto per ogni squadra offline.

### PL-28 — Lobby completa + pannello di regia riorganizzato (item 41, 42)

- **Cosa manca:** nessuna rinomina (coperta in parte da PL-07), nessuna aggiunta manuale di una
  squadra reale, nessuna chiusura/riapertura esplicita delle iscrizioni; il pannello di regia non ha
  sezioni richiudibili durante la domanda.
- **File toccati:** `js/render.js` (`renderAdmin`, lobby), `js/actions.js` (nuove `adminAddManualTeam`,
  `adminSetRegistrationsOpen`).
- **Approccio tecnico:** aggiungere le funzioni mancanti nella lobby; riorganizzare `renderAdmin`
  secondo l'ordine consigliato dal piano §4.13 (domanda corrente → timer → risposte → azione
  successiva → scoring/rischio → audio/display → classifica/checkpoint → correzioni/undo), con
  sezioni collassabili anche durante la domanda (oggi il collasso esiste solo in Sala pre-partita via
  `showAdvancedSetup`).
- **Dipendenze:** PL-08 (validazione), PL-25 (regole live), PL-27 (registro eventi da mostrare).
- **Complessità:** L
- **Criterio di completamento:** l'admin può aggiungere manualmente una squadra reale e chiudere le
  iscrizioni senza avviare la partita; il pannello di regia rispetta l'ordine visivo indicato dal
  piano ed è navigabile senza scorrere un muro di card sempre aperte.

### PL-29 — Modalità prova completa (item 44 completamento)

- **Cosa manca:** le squadre di prova non arrivano mai in finale/spareggio per scelta di design attuale
  (`js/actions.js:412-420`, commento esplicito); la modalità gira sul database di produzione.
- **File toccati:** `js/actions.js`, `js/render.js`.
- **Approccio tecnico:** una volta completato PL-05, estendere la Modalità prova per coprire
  esplicitamente finale e spareggi.
- **Dipendenze:** PL-05.
- **Complessità:** M
- **Criterio di completamento:** una partita di prova completa (fino a finale e spareggio) è eseguibile
  sul progetto di test senza toccare la produzione.

---

## Fase 6 del piano — Classifica, finale e pubblico

### PL-30 — Separare i listener per ruolo (item 46)

- **Cosa manca:** `startListening()` (`js/state.js:185-223`) è un unico listener su tutto `DB_ROOT`,
  identico per Admin/Team/Display: tutti scaricano l'intero stato del gioco, banca domande inclusa.
- **File toccati:** `js/state.js` (`startListening`), `js/firebase-init.js`.
- **Approccio tecnico:** sostituire l'unico listener con ascolti mirati per ruolo, resi possibili dai
  rami separati introdotti in PL-09: Team ascolta stato pubblico + propria risposta, Display ascolta
  solo lo stato pubblico, Admin ascolta anche banca domande ed eventi di regia.
- **Dipendenze:** PL-09 (senza rami separati non è possibile ascoltare solo una parte).
- **Complessità:** L
- **Criterio di completamento:** ispezionando il traffico di rete della vista Team da devtools, non
  compaiono più la banca domande completa né i dati di regia riservati all'Admin.

### PL-31 — Feedback post-domanda, animazioni podio, tabelle responsive, preload media (item 48, 49, 51, 52)

- **Cosa manca:** classifiche provvisorie solo ai checkpoint (non dopo ogni domanda); nessuna
  animazione dedicata a zona qualificazione/podio; tabelle Admin non scorrevoli
  (`quizzettone.html:157-159`, nessun `overflow-x`); nessun preload del media della domanda successiva.
- **File toccati:** `js/render.js`, `quizzettone.html` (CSS).
- **Approccio tecnico:** dopo ogni domanda (non solo ai checkpoint), mostrare soluzione, % corrette e
  movimento di posizione; aggiungere animazioni CSS dedicate per zona qualificazione/podio/vincitore
  (estendendo `.reveal-row`/`.winner-card` già presenti); wrappare le tabelle Admin in contenitori con
  `overflow-x:auto` e colonne prioritarie su schermi stretti; precaricare in background (`Image()`/
  `Audio()` con `src` impostato ma non riprodotto) il media della prossima domanda, già visibile in
  anteprima Admin (`js/render.js:933-941`).
- **Dipendenze:** PL-19/PL-22 (media da precaricare), PL-15 (dati di rischio/movimento da mostrare).
- **Complessità:** M per ciascun sotto-item (L nel complesso)
- **Criterio di completamento:** dopo ogni domanda le squadre vedono un feedback sintetico; le tabelle
  Admin sono scorrevoli orizzontalmente su schermo da 360px senza rompere il layout; il media della
  domanda successiva è già in cache del browser quando diventa quella corrente.

### PL-32 — Estrarre i blocchi Team/Display ancora duplicati + Albo d'oro (item 53, 57)

- **Cosa manca:** i blocchi checkpoint/spareggio/reveal-finalisti sono duplicati quasi identici tra
  `renderTeam` (`js/render.js:359-391`) e `renderDisplay` (`js/render.js:627-660`); i dati salvati in
  `statsHistory/<gameId>` (`js/actions.js:265-271`) non vengono mai riletti/mostrati da nessuna vista.
- **File toccati:** `js/render.js` (estrazione funzioni condivise, nuova `renderHallOfFame`).
- **Approccio tecnico:** estrarre in funzioni condivise (sullo stesso modello già usato per
  `renderTeamQuestion`, riusata da Team/Display/Admin) i blocchi checkpoint/spareggio/reveal-finalisti
  oggi duplicati; aggiungere una schermata Admin che elenca le partite salvate in `statsHistory`
  (podio, data, accuratezza), primo passo verso l'`hallOfFame` concettuale del piano §2.2.
- **Dipendenze:** nessuna bloccante; coerente con la Fase 6 del piano.
- **Complessità:** M
- **Criterio di completamento:** i blocchi checkpoint/spareggio sono scritti una sola volta e richiamati
  da entrambe le viste; l'admin può aprire una lista delle serate passate con podio e data.

---

## Fase 7 del piano — Ottimizzazione mirata

La Fase 7 coincide in gran parte con PL-30/PL-31 (già pianificati sopra, in linea con l'indicazione del
piano che i due argomenti — separazione listener, tabelle responsive — sono gli stessi). L'unico
elemento residuo specifico di questa fase è la valutazione dell'autenticazione:

### PL-33 — Valutazione autenticazione reale (item 58, condizionata)

- **Cosa manca:** nessuna autenticazione reale; PIN statico `'2468'` hardcoded
  (`js/actions.js:601`) come da decisione esplicita del piano §2.4.
- **File toccati:** da definire solo in caso di trigger.
- **Approccio tecnico:** **non implementare** a meno che PL-04 (verifica regole Firebase) riveli un
  accesso globalmente pubblico con link condiviso fuori dal gruppo fidato — il trigger esplicito
  indicato dal piano (§2.4 e domanda aperta §8.12). In caso contrario, questo pacchetto resta
  un'attività di sola valutazione/decisione, da ripetere quando cambia il contesto d'uso (più admin,
  partite pubbliche, dati storici da proteggere).
- **Dipendenze:** PL-04.
- **Complessità:** — (decisione, non sviluppo, salvo trigger)
- **Criterio di completamento:** una decisione esplicita e documentata (procedere o rimandare) basata
  sui risultati di PL-04.

---

## Fase 8 del piano — Arcade, uno alla volta

### PL-34 — Primo arcade

- **Cosa manca:** tutti e 16 gli arcade del backlog (item 59-74) e i poteri strategici opzionali
  (item 75) sono assenti. La "Modalità Party" già presente nel codice (`js/state.js:547-586`,
  `js/actions.js:464-543`) è una funzionalità diversa (carte bonus/malus/sorpresa da leggere ad alta
  voce) e non sostituisce nessuno degli arcade previsti dal REGOLAMENTO.
- **File toccati:** da definire in base al gioco scelto.
- **Approccio tecnico:** **non costruire un framework arcade generico.** Scegliere un solo gioco P5-A
  tra Photopuzzle, Indovina chi, Sbaglia&Vinci, Music Box/Crazy Radio (come indicato dalla domanda
  aperta §8.10 del piano), costruire una versione minima sopra il nuovo modello dati (PL-09) e il
  contratto domande (PL-18), provarlo durante una serata reale e misurare comprensibilità, durata
  reale, peso sul punteggio totale, coinvolgimento di chi è indietro, lavoro necessario per i
  contenuti, affidabilità su telefoni diversi (criteri esplicitamente elencati dal piano §7 Fase 8).
  Solo dopo questo collaudo si valuta se consolidare componenti condivisi per il secondo arcade.
- **Dipendenze:** tutte le fasi precedenti (il piano richiede esplicitamente un nucleo di gioco stabile
  e collaudato dal vivo prima di questa fase).
- **Complessità:** L (variabile secondo il gioco scelto)
- **Criterio di completamento:** il primo arcade è stato giocato in una serata reale e valutato secondo
  i criteri del piano §7 Fase 8 prima di iniziare qualunque lavoro sul secondo arcade.

Gli arcade restanti (item 59-75, esclusi quelli valutati per il primo esperimento) restano backlog non
pianificato in dettaglio finché il primo non è stato collaudato dal vivo, come richiesto esplicitamente
dal piano originale.

---

## Riepilogo pacchetti per fase

| Fase (piano §7) | Pacchetti | Item/FT coperti |
|---|---|---|
| Gate iniziali (Fase 0-1) | PL-01 → PL-08 | FT-01, FT-02, FT-03, FT-04, FT-05, FT-06, FT-08, item 1-9 |
| Fase 2 | PL-09 → PL-12 | FT-09, FT-10, FT-11, item 10-14, 36 |
| Fase 3 | PL-13 → PL-17 | item 25-30, 50 |
| Fase 4 | PL-18 → PL-24 | item 15, 17-24, tipologie 3.3-3.10 |
| Fase 5 | PL-25 → PL-29 | item 32, 38 (completamento), 40, 41, 42, 43, 44 |
| Fase 6 | PL-30 → PL-32 | item 46, 48, 49, 51, 52, 53, 57 |
| Fase 7 | (PL-30/31) + PL-33 | item 51 (già coperto), item 58 (condizionato) |
| Fase 8 | PL-34 | item 59-75 |
