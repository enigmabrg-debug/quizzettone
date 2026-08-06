# Log di avanzamento — esecuzione PL-01 → PL-33

> Una riga per pacchetto. Stato: fatto / in corso / bloccato / saltato.
> Riferimento tecnico: `PIANO_IMPLEMENTAZIONE_CONSOLIDATO.md` (aggiornato in corso d'opera per la
> fusione UX fase 5/6, vedi nota sotto).
> Audit di partenza: `STATO_IMPLEMENTAZIONE_QUIZZETTONE.md`.

## Nota di ripresa

Un turno precedente aveva già iniziato PL-01, ma le modifiche non erano state committate prima che il
container si resettasse: il lavoro è andato perso. Questa esecuzione riparte da zero da PL-01 (questo
file non esisteva più sul filesystem all'avvio di questo turno).

## Verifica preliminare (Passo 0)

- **FT-01** (ambiente di prova separato): nel codice/git log non esiste alcun dialog di reset a due
  passaggi né una checklist di backup collegata ad `adminResetGame` (verificato con
  `git log --oneline --all` e grep su "backup", "checklist", "due passaggi", "two-step" — nessun
  risultato in entrambi i turni in cui è stato verificato). Punto di decisione **aperto**: verrà
  richiesta conferma esplicita immediatamente prima del pacchetto PL-05.
- **FT-02**: nessuna azione in questa sessione. Copre **PL-04**, saltato.
- **FT-09** (PL-09): richiede conferma esplicita prima di iniziarlo, in Fase 2.

## Nota fusione UX fase 5/6

Da `AGGIORNAMENTO_PIANO_UX_fase5.md` (allegato dall'utente): a fine PL-24, PL-25/PL-27/PL-28/PL-30/
PL-32 del piano originale vengono sostituiti da **PL-25-UX**, **PL-27-UX**, **PL-30-UX**.
`PIANO_IMPLEMENTAZIONE_CONSOLIDATO.md` verrà aggiornato di conseguenza prima di eseguirli.

## Aggiornamento Passo 0 — FT-01 confermato

L'utente ha confermato esplicitamente la proposta di default: dialog di reset a due passaggi +
checklist di backup manuale, non il secondo progetto Firebase del piano originale.
`PIANO_IMPLEMENTAZIONE_CONSOLIDATO.md` è stato aggiornato di conseguenza (sezione PL-05 riscritta,
commit `2b55d31`) prima di eseguire il pacchetto.

## Gate iniziale completato

Tutti gli 8 pacchetti del gate iniziale (Fase 0-1) sono conclusi: PL-04 (saltato), PL-01, PL-02, PL-03,
PL-08, PL-05, PL-06, PL-07.

## Aggiornamento Passo 0 — FT-09/PL-09 confermato

L'utente ha confermato esplicitamente di procedere con PL-09 come descritto nel piano originale
(rami separati sotto `sessions/current/...`, `sessionId` fisso, niente multi-sessione vera).

## Log pacchetti

| ID | Titolo | Stato | Commit | Note/deviazioni |
|---|---|---|---|---|
| PL-04 | Verificare/versionare regole Firebase | saltato | — | Copre FT-02: "nessuna azione in questa sessione" per decisione esplicita dell'utente (Passo 0). |
| PL-01 | Chiudere l'XSS residuo | fatto | 185581f | Aggiunto helper `teamNameHtml()` in js/render.js e sostituite tutte le interpolazioni dirette di nome squadra non escapate (rankRows, renderTeam, lobby Admin, tabelle Admin, blocchi spareggio/finale). Test mirati (phase1-lobby, smoke) + nuovo tests/e2e/phase1-xss.spec.js tutti verdi. |
| PL-02 | Loading, timeout, errore, retry all'avvio | fatto | a97a80b | Aggiunti `bootStatus`/`retryBoot()` in js/state.js (timeout 8s su `startListening`) e `renderBootScreen()` in js/render.js, richiamata da `render()` quando `!state` invece di lasciare la pagina bianca. Nuovo test tests/e2e/phase1-boot-recovery.spec.js (simula rete offline via `context.setOffline`, verifica loading→timeout→retry funzionante). Non toccato quizzettone.html: tutta la logica sta in state.js/render.js, non serve nulla nello script di boot. Suite completa non rieseguita (interrotta in background per evitare conflitti sull'emulatore condiviso); rieseguiti invece i test mirati più ampi (lobby, smoke, timer, xss) oltre a quello nuovo — tutti verdi. |
| PL-03 | Gestire gli esiti reali delle operazioni Firebase | fatto | b9c6048 | Aggiunto `showErrorBanner()` in js/render.js. `withUndo` ora ritorna esito e mostra errore+retry se `safeSet` fallisce (copre indirettamente `adminAdjustPoints`, che delega tutto a `withUndo`). Controllato esplicitamente il ritorno di `safeSet` in `adminStartGame`, `adminSaveSetup`, `adminResetGame`, `teamJoin`, `teamSubmitAnswer`: su fallimento non si avanza più lo stato locale (es. `teamJoin` non assegna più `teamId`/`teamName` prima di sapere se la scrittura è riuscita). Fuori scope (non toccato, come da elenco file del pacchetto): le `safeDelete` (silenziose per disegno) e i `db.ref(...).update()` diretti altrove nel codice. Test nuovo tests/e2e/phase1-write-errors.spec.js: simula un fallimento reale di `.set()` via monkey-patch di `db.ref` (non tramite regole Firebase, per non toccare FT-02) su join/risposta/reset, verifica banner+retry funzionante per tutti e tre. Suite mirata (lobby, smoke, xss, undo, boot-recovery) tutta verde. |
| PL-08 | Validazione e limiti sui file media | fatto | c5ecc5a | `uploadAudioFile` (js/firebase-init.js) ora rifiuta prima dell'upload i file non audio o oltre 8MB, con un `Error` dal messaggio chiaro. Non serve toccare js/render.js (a differenza di quanto ipotizzato dal piano): i due punti di chiamata (form domande, form effetti) avevano già un try/catch che mostra `e.message` nello stesso punto dove appare "Caricamento audio...", quindi ereditano il messaggio d'errore gratis. Nuovo test tests/e2e/phase1-media-validation.spec.js (tipo sbagliato + file sovradimensionato, su entrambi i punti di upload). Suite di regressione mirata (smoke, testmode-stats) verde. |
| PL-05 | Reset a due passaggi con checklist di backup (versione rivista, ex "ambiente di prova separato") | fatto | 8380415 | Nuova `showResetChecklistModal()` in js/render.js: Step 1 checklist a 3 caselle (nessuna preselezionata) con "Continua" disabilitato finché non sono tutte spuntate; Step 2 conferma finale separata che è l'unico punto a chiamare `adminResetGame`. `btnReset` non usa più `showConfirmModal` generica. Aggiornati due test esistenti che assumevano il vecchio flusso a un solo step (`phase1-undo.spec.js`, `phase1-write-errors.spec.js`) più un nuovo test dedicato che verifica che il reset vero e proprio non scatti finché entrambi gli step non sono completati. Suite mirata (undo, write-errors, smoke) verde. |
| PL-06 | Invio atomico delle risposte | fatto | 60e2a76 | `teamSubmitAnswer`/`adminSubmitTestAnswer` ora usano `db.ref(...).child(key).transaction(...)` sul singolo nodo `answers:<id>/<key>` invece di read-then-write sull'intero oggetto `answers:<id>`; "già risposto" (`current` esiste) non è più trattato come errore. Nuovo flag locale `pendingSubmitKey` (js/state.js) blocca subito tutte le opzioni al click e sopravvive ai re-render del tick da 250ms, con nuovo banner "Invio in corso...", riabilitato solo se la transazione fallisce davvero. Aggiornato `failNextWriteTo` in `phase1-write-errors.spec.js` per intercettare anche `.transaction()` attraverso `.child()` (non solo `.set()`), perché il vecchio monkey-patch non l'avrebbe più intercettata. Nuovo file `phase1-atomic-submit.spec.js`: due chiamate concorrenti a `teamSubmitAnswer` per la stessa squadra/domanda registrano sempre una sola risposta senza errore per il "perdente"; i pulsanti restano disabilitati per l'intera finestra di invio. Suite mirata (write-errors, timer, speed-bonus, testmode-stats, smoke) verde. |
| PL-07 | Join squadra atomico e univoco per nome | fatto | d1c0bb6 | Nuovo indice `teamNames:<nome-normalizzato>` (js/actions.js, helper `teamNameKey`) scritto con `transaction()`: chi vince crea la squadra, chi perde recupera l'id già creato dal vincitore (con un piccolo retry/attesa per la finestra non atomica tra "vinta la transazione sul nome" e "scritta teaminfo:"). Rimossa `findTeamByName` (scansione lineare, sostituita dall'indice). Nuova `adminRenameTeam` (aggiorna sia `teaminfo:` sia l'indice, rifiuta se il nuovo nome è già preso) + pulsante "✎" nella lobby Admin con un piccolo modale dedicato (`showRenameTeamModal`, niente `window.prompt` nativo). `adminRemoveTeam` ora libera anche l'indice del nome rimosso. **Limite noto, non risolto in questo pacchetto:** "Annulla ultima azione" dopo una rimozione squadra ripristina `teaminfo:` ma non ricrea l'indice del nome (l'undo generico salva/ripristina un solo path, non è a conoscenza degli effetti collaterali sull'indice) — un caso limite raro, non il percorso principale che il criterio del pacchetto chiede di coprire. Nuovo file `phase1-team-identity.spec.js`: due join quasi simultanei con lo stesso nome producono una sola squadra (due dispositivi separati, non due tab della stessa squadra come in PL-06); rinomina funzionante; rinomina rifiutata se il nome è già preso. Suite mirata (lobby, undo, write-errors, smoke) verde. |
| PL-09 | Modello dati di sessione strutturato | fatto | 296c3a6 | Nuovi helper di percorso in `js/firebase-init.js` (`sessionPath`, `statePath`, `teamPath`, `answersPath`, `scoreLedgerPath`, `teamNamePath`, `presencePath`, `questionBankPath`, `soundEffectPath`; `SESSION_ID='current'` fisso). `safeList` ridefinita da "scan del nodo piatto" a "elenca figli di un percorso". `js/state.js`: nuova variabile locale `gameQuestions` (era `state.gameQuestions`) popolata dal ramo separato `sessions/current/questionInstances`; `startListening()` legge rami annidati invece di smistare per prefisso stringa; nuova `migrateFlatStateToSessions()` one-shot (solo Admin) che sposta tutto il vecchio nodo piatto in un solo `update()` atomico. `js/actions.js`: riscritto interamente (sostituzione dei ~50 punti che usavano `'state'`/`'teaminfo:'+id`/ecc. con gli helper); `adminStartGame`/`adminContinueToFinal`/`adminStartTiebreakQuestion` scrivono `state` e `questionInstances` in un solo `update()` atomico multi-path; `adminResetGame` riscritta per pulire tutti i rami di sessione. Scelta di scope deliberata (documentata nel piano, sezione PL-09): `state` resta un nodo combinato config+runtime (non split in due), per contenere il rischio su un pacchetto già XL. **Due bug reali trovati e corretti durante la verifica, non nel piano originale:** (1) race tra la migrazione e `ensureJoinCode`/`ensureSeedQuestions` sullo stesso primo snapshot — `migrateFlatStateToSessions` ora ritorna un booleano e le tre `ensure*` vengono saltate sul giro in cui la migrazione ha davvero spostato qualcosa, per non sovrascrivere il dato appena migrato con dei default; (2) il criterio "c'è qualcosa da migrare" guardava solo `all.state`, ma Firebase pota silenziosamente un valore `{}`, quindi un database con solo domande legacy (`question:...`) e nessuno `state` vero non veniva mai migrato — ora il criterio controlla anche gli altri prefissi legacy (`hasLegacyFlatData`). Nuovo test dedicato `phase2-session-migration.spec.js` (seed diretto via REST di dati in forma piatta, verifica che la UI li legga correttamente e che le vecchie chiavi spariscano). Aggiornati anche alcuni test preesistenti che referenziavano percorsi piatti direttamente (`phase1-write-errors.spec.js`, `phase1-timer.spec.js`, `phase2-finals.spec.js` — inclusa l'aggiunta di un caricamento Admin "bootstrap" in un test che prima apriva solo pagine Team, scenario innaturale rispetto all'uso reale). **Suite e2e completa eseguita due volte fino al verde** (41/41, un singolo flake di chiusura contesto non riproducibile in isolamento). |
