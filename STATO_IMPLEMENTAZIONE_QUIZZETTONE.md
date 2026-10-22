# Stato di implementazione — Quizzettone

> Audit puntuale del codice reale rispetto a `Piano_modifiche_Quizzettone.md`.
> Metodo: lettura integrale di `index.html`, `quizzettone.html`, `firebase.json`, `package.json`,
> `js/firebase-init.js`, `js/state.js`, `js/actions.js`, `js/render.js` (nessun file riletto due volte).
> Legenda stato: ✅ Implementato · 🟡 Parziale · ❌ Mancante.
>
> Nota preliminare: il codice contiene una funzionalità — la "Modalità Party" (carte bonus/malus/sorpresa,
> `js/state.js` righe 547-586, `js/actions.js` righe 464-543) — che **non compare nel piano**. Non è
> valutata negli item sotto perché non ha un corrispettivo da confrontare; è segnalata qui come
> deviazione/aggiunta rispetto al piano, non come voce mancante.

---

## 1. Interventi fondamentali FT-01 → FT-12 (piano §2.1)

| ID | Fondamenta | Stato | Riferimento file/funzione | Note |
|---|---|---|---|---|
| FT-01 | Ambiente di prova separato | 🟡 | `js/firebase-init.js:20-22` (flag `?emulator=1`), `tests/helpers/emulator.js` | Esiste solo un emulatore RTDB locale usato dai test Playwright automatizzati. Non esiste un **secondo progetto Firebase reale** per collaudo manuale: la "Modalità prova" (`js/actions.js:384-440`) scrive squadre fittizie (`isTest:true`) sullo **stesso database di produzione** (`quizzettone-49543`, vedi `js/firebase-init.js:8-16`), solo escluse dalle statistiche via `realTeamIds()` (`js/state.js:396-398`). Un reset di prova tocca lo stesso `DB_ROOT` di produzione: il criterio di completamento FT-01 non è soddisfatto. |
| FT-02 | Regole Firebase note e versionate | ❌ | — | Nessun file `database.rules.json`/`storage.rules`, nessun `.firebaserc` nel repo. `firebase.json` contiene solo config emulatore (righe 1-10). Le regole realmente attive in console non sono documentate né verificabili dal codice. |
| FT-03 | Eliminazione XSS | 🟡 | `escapeHtml()` in `js/render.js:4-6`, usata 50 volte nel file | Escaping applicato in molti punti (form, domande, party card, statistiche) ma **non sistematico**: nomi squadra NON escapati in `rankRows()` (`js/render.js:27-34`, riusata da quasi tutte le schermate di classifica su Team/Display/Admin), in `renderTeam()` per il proprio nome (`js/render.js:334,420,439`), nella lobby Admin (`js/render.js:831`), nella classifica generale Admin (`js/render.js:1073`) e nella schermata spareggio (`js/render.js:1004,1020,1027,1038,1048,1056`). Un nome squadra con `<script>` o markup eseguirebbe codice ogni volta che una di queste viste si aggiorna. |
| FT-04 | Avvio e connessione comprensibili | ❌ | `render()` in `js/render.js:304-309` | `if(!state) return;` — se il primo snapshot Firebase non arriva, **non viene mostrato nulla** (stessa schermata bianca descritta dall'AUDIT). Esiste solo `connectionBadge()` (`js/render.js:40-43`) che segnala una disconnessione avvenuta *dopo* l'avvio (basata su `.info/connected`). Nessuno stato di caricamento iniziale, nessun timeout, nessun comando di retry esplicito. |
| FT-05 | Errori Firebase gestiti | ❌ | `safeGet/safeSet/safeDelete` in `js/firebase-init.js:33-46` | Le funzioni intercettano l'eccezione e restituiscono `true/false`/`null`, ma **quasi nessun chiamante controlla l'esito**: `adminStartGame`, `adminSaveSetup`, `teamJoin`, `teamSubmitAnswer` e la stragrande maggioranza delle azioni in `js/actions.js` fanno `await safeSet(...); await refresh();` senza mai verificare se la scrittura è realmente riuscita. Nessun "invio in corso / errore / retry" visibile nei flussi essenziali (join, risposta, cambio fase). |
| FT-06 | Invio atomico delle risposte | ❌ | `teamSubmitAnswer` in `js/actions.js:677-689`; `adminSubmitTestAnswer` in `js/actions.js:412-420` | Ancora un classico **read-then-write**: `safeGet('answers:'+teamId)` seguito da `safeSet(...)`, non una `db.ref(...).transaction()`. È esattamente l'anti-pattern che FT-06 chiede di eliminare — due tocchi ravvicinati o una риconnessione possono ancora produrre scritture in conflitto. Da notare: `closeAnswersTransactional` (`js/actions.js:104-116`) usa correttamente una `transaction()`, ma gestisce la **chiusura della domanda**, non l'invio della risposta. |
| FT-07 | Identità e presenza della squadra | 🟡 | `armPresence/disarmPresence` in `js/state.js:234-245`; `saveTeamSession/restoreFromUrl` in `js/actions.js:602-676` | Identità persistente via URL + `localStorage`, presenza online/offline con `onDisconnect().remove()` riarmata a ogni riconnessione (`js/state.js:219`), Admin vede online/offline e numero dispositivi (`js/render.js:828-832`). Manca il tracciamento esplicito dell'**"ultimo contatto"** (timestamp dell'ultima attività) per le squadre offline: `presenceByTeam` contiene solo le connessioni attualmente aperte. |
| FT-08 | Unicità e gestione dei nomi | 🟡 | `findTeamByName`/`teamJoin` in `js/actions.js:552-588` | `findTeamByName` è una scansione di sola lettura; `teamJoin` decide "riusa o crea" in base a quell'esito senza transazione né indice normalizzato — un classico **check-then-act**: due join simultanei con lo stesso nome possono ancora generare due squadre gemelle. Manca inoltre qualunque funzione di **rinomina** o risoluzione manuale da Admin (esiste solo la rimozione, `adminRemoveTeam`). |
| FT-09 | Stato partita strutturato | ❌ | `DB_ROOT` in `js/firebase-init.js:23`; `startListening` in `js/state.js:185-223` | Tutto vive ancora in **un unico nodo piatto** (`quizzettone/...`) con chiavi a prefisso stringa (`teaminfo:`, `answers:`, `overrides:`, `question:`, `effect:`) — esattamente lo schema che il piano chiede di abbandonare. Non esiste concetto di `sessionId`: una sola partita globale alla volta. `config`, `runtime`, `timer`, `finalisti`, `tiebreak`, `party` sono tutti mescolati in un unico oggetto `state` (`js/state.js:98-149`). |
| FT-10 | Snapshot della configurazione | 🟡 | `openQuestionTimer` in `js/actions.js:4-10`; `scoringFor` in `js/state.js:285-292` | Il **timer** cattura `durationMs` all'apertura della domanda, quindi la sua durata non cambia retroattivamente. Lo **scoring** però non è snapshottato automaticamente: `scoringFor()` legge `state.config.scoring` *corrente* per ogni domanda priva di override esplicito — se l'admin cambia il punteggio di default a metà partita, le domande già giocate senza override vengono ricalcolate con le nuove regole. Manca del tutto la "classifica congelata prima della domanda" richiesta dal piano §4.2. |
| FT-11 | Tempo autorevole condiviso | ❌ | `openQuestionTimer`, `adminStartTimerManually`, `adminResumeTimer` in `js/actions.js` (righe 4-10, 135-139, 145-150) | Il timer usa `Date.now()` del **client admin**, mai `firebase.database.ServerValue.TIMESTAMP` né un offset server (`.info/serverTimeOffset` non è letto in nessun file). Il countdown è condiviso tramite lo stesso `startedAt` in Firebase (quindi coerente tra i client), ma è ancorato all'orologio locale di chi apre la domanda, non a un tempo autorevole. |
| FT-12 | Checkpoint non hardcoded | ✅ | `adminNextQuestion` in `js/actions.js:195-219`; `state.config.checkpointMinQuestions` (`js/state.js:139`) | Il valore è configurabile (`checkpointMinQuestions`, default 4) e il midpoint è calcolato dinamicamente (`Math.ceil(list.length/2)`). Nessun valore hardcoded `8` presente in nessun file JS (verifica per ricerca testuale). |

---

## 2. Tipologie di domanda (piano §3.2 → §3.10)

| ID | Tipologia | Stato | Riferimento file/funzione | Note |
|---|---|---|---|---|
| 3.2 | Scelta multipla testuale | 🟡 | `renderTeamQuestion` (`js/render.js:488-559`); `addQuestion`/`bulkAddQuestions` (`js/state.js:488-518`) | Motore funzionante ma rigido: **sempre 4 opzioni fisse** (A-D), nessun "contratto comune" (tipo di contenuto/risposta dichiarato, tolleranza, politica di risposta) come richiesto dal piano §3.1. La risposta non è su invio atomico (FT-06) né su snapshot di configurazione (FT-10). |
| 3.3 | Vero o falso | ❌ | — | Nessun motore/preset a 2 opzioni: il form Admin (`js/render.js:1375-1378`) e `parseBulkQuestions` (`js/state.js:496-510`) richiedono sempre 4 opzioni testuali valide. Nessun malus maggiorato dedicato. |
| 3.4 | Domanda fotografica | ❌ | — | Nessun campo immagine, nessun tag `<img>`, nessuna anteprima Admin, nessun fallback per media mancante in tutto il codice. |
| 3.5 | Domanda audio | 🟡 | `uploadAudioFile` (`js/firebase-init.js:25-31`); cue audio (`js/state.js:619-624`, `js/render.js:113-155`); form (`js/render.js:1386,1619-1624`) | Base solida già presente: upload, riproduzione sincronizzata Admin/Display tramite `audioCue` con nonce, stato "Caricamento audio...". Mancano: validazione dimensione/formato file (nessun controllo su `file.size`/`type`), gestione esplicita di errori di caricamento lato squadra, regola di avvio del timer dedicata alla domanda audio. |
| 3.6 | Domanda video | ❌ | — | Nessun supporto video in nessun file (nessun tag `<video>`, nessun campo `videoUrl`). |
| 3.7 | Logica | ❌ | `CATEGORIES` in `js/state.js:49` | "Logica" non è tra le categorie presenti; non essendoci motori numero/ordinamento, può oggi sfruttare solo la scelta multipla, senza timer dedicato per singola domanda. |
| 3.8 | Ordinamento | ❌ | — | Nessun motore drag&drop o su/giù, nessuna serializzazione dell'ordine in stato/risposte. |
| 3.9 | Stima numerica | ❌ | `computeTiebreakAutoWinner` (`js/state.js:343-357`) | Nessun campo di risposta numerica in nessuna vista. Nota: la Sala pre-partita offre l'opzione "Più vicino al valore corretto" nel select regola pareggio (`js/render.js:712-717`, valore `'numerica'`), ma `computeTiebreakAutoWinner` gestisce **solo** `'prima_corretta'`/`'corretta_veloce'`: selezionare "numerica" nell'interfaccia non produce alcun comportamento diverso — opzione presente in UI ma non implementata a livello tecnico. |
| 3.10 | Risposta testuale libera | ❌ | — | Nessun campo di testo libero, nessuna coda "da revisionare", nessun sistema di alias/normalizzazione/fuzzy matching. |

---

## 3. Meccaniche di gioco (piano §4.1 → §4.14)

| ID | Meccanica | Stato | Riferimento file/funzione | Note |
|---|---|---|---|---|
| 4.1 | Formato partita e preset | 🟡 | `renderSalaPrePartita` (`js/render.js:710-778`) | Configurazione granulare completa (manche, domande, finalisti, punteggio, tiebreak, ingresso tardivo, timer). **Nessun preset** selezionabile (Classica/Rapida/Tutti contro tutti/Personalizzata — ricerca testuale "preset" negativa in tutto `js/`). È già una "Personalizzata" di fatto, ma senza scorciatoie preconfezionate né una modalità "Tutti contro tutti" senza eliminazione. |
| 4.2 | Punteggio dinamico predefinito | 🟡 | `scoringFor`/`computeSpeedBonusAtSubmission` (`js/state.js:285-313`) | Esiste solo il profilo statico `correct/wrong/noAnswer` più un bonus velocità **lineare a finestra temporale** (non basato sull'ordine delle risposte corrette come richiesto dal piano). Mancano: classifica congelata pre-domanda, tabella bonus per ordine (25/20/15/10/5%), penalità adattiva per fascia, bonus rimonta 0-8%, profili Classico/Dinamico/Personalizzato, indicatori di rischio per squadra. |
| 4.3 | Punti e vantaggi entrando in finale | 🟡 | `state.config.scoreCarryover` (`js/state.js:136`); `totalScore` (`js/state.js:335`) | Il campo di configurazione (`reset`/`keep`/`convert`) esiste ed è selezionabile in UI (`js/render.js:766,1534`), ma **non è mai letto** da nessuna funzione di scoring: `totalScore()` somma sempre `qualificationScore + roundScore('final')`, cioè si comporta sempre come "Mantieni" indipendentemente dal valore scelto. Nessuna modalità "Vantaggio per piazzamento" implementata. Impostazione presente ma non funzionale. |
| 4.4 | Spareggi coerenti | 🟡 | `adminRevealFinalists`/`adminAssignTiebreakWinner` (`js/actions.js:236-257,272-284`) | Risolve il vecchio bug della "dichiarazione manuale arbitraria" con un suggerimento automatico del vincitore per le regole `prima_corretta`/`corretta_veloce`. Ma non implementa "tre domande + stima numerica" per la qualificazione (si gioca **una** domanda per round di spareggio, scelta dall'admin) né uno spareggio "a oltranza" realmente automatizzato con eliminazione progressiva delle squadre che sbagliano: tutto richiede la scelta manuale di una nuova domanda a ogni giro. |
| 4.5 | Ingresso tardivo | ✅ | `lateJoinAllowed`/`teamJoin` (`js/actions.js:563-588`) | Tre politiche configurabili (`always`/`until_round1_end`/`blocked_after_start`), squadra tardiva marcata (`lateJoin:true`), parte da zero, partecipa dalla domanda successiva. Corrisponde bene alla specifica del piano. |
| 4.6 | Timer sincronizzato e controllabile | 🟡 | `adminPauseTimer/adminResumeTimer/adminAdjustTimer/adminCloseAnswers/adminReopenAnswers/adminCancelQuestion` (`js/actions.js:117-163`) | Pausa/ripresa, ±5s, chiusura immediata, riapertura (finestra fissa 10s, non riprende il residuo esatto), annullamento tutti presenti. Avvio automatico/manuale selezionabile. Mancano durate preimpostate (10/15/20/30/45/60s — è un campo libero in secondi) e l'opzione esplicita "nessun timer". Dipende da FT-11 (non autorevole). I comandi timer non passano da `withUndo`, quindi non compaiono nello storico azioni. |
| 4.7 | Ciclo della risposta | 🟡 | `renderTeamQuestion` banner (`js/render.js:515-522`); `js/render.js:950` (stato tabella Admin) | Stati "non risposto / inviata / bloccata" gestiti a livello UI. Mancano: "invio in corso" esplicito (rischio doppio invio dato che non è transazionale, FT-06), stato "errore/retry", "da revisionare" (assente per mancanza di testo libero), politica "risposta modificabile" (oggi sempre "primo invio definitivo": `teamSubmitAnswer` ritorna subito se `current[key]` esiste già). |
| 4.8 | Classifica, checkpoint e reveal | 🟡 | `computeStandingsRevealOrder`/`adminSetupStandingsReveal` (`js/actions.js:318-357`) | Buona copertura: checkpoint a metà/fine manche configurabile, reveal automatico dal basso con pari merito raggruppati, velocità rapida/normale/suspense, autoplay/pausa/salta, modalità multiple (`pause`/`classifica`/`complete`/`message`/`partial`). Mancano: rallentamento animato vicino alla zona di qualificazione, animazioni distinte per podio/vincitore, feedback sistematico post-domanda (% corrette, movimento di posizione) — oggi presente solo ai checkpoint, non dopo ogni singola domanda. |
| 4.9 | Regole modificabili durante la partita | ❌ | `adminSaveSetup` (`js/actions.js:81-93`: `if(state.setupLocked) return;`) | Una volta avviata la partita (`setupLocked:true`, impostato da `adminStartGame`), la Sala pre-partita mostra tutti i campi disabilitati (`js/render.js:731,735-775`) e `adminSaveSetup` rifiuta silenziosamente ogni scrittura: **nessuna** regola strutturale (timer, manche, finalisti, regola finale, ingresso) è modificabile dopo lo start, contrariamente a quanto richiesto dal piano. Le uniche modifiche live possibili sono il punteggio per singola domanda (`adminSetQuestionScoring`) e il punteggio di default globale (`adminSetScoringDefaults`), senza validazione, anteprima o conferma. |
| 4.10 | Undo minimo e registro Admin | 🟡 | `withUndo`/`adminUndoLast` (`js/actions.js:25-48`); `historyLogCard` (`js/render.js:1081-1093`) | Un livello di undo funzionante per: rimozione squadra, correzione punti, annullamento domanda, avanzamento reveal classifica, modalità checkpoint. Molte azioni ad alto impatto **non** passano da `withUndo` e quindi non generano voce di storico: apertura/chiusura domanda, comandi timer, cambio regole, rivelazione soluzione, cambio Modalità Party. Conferma richiesta per reset partita e rimozione squadra (`showConfirmModal`). |
| 4.11 | Sala pre-partita e lobby | 🟡 | Lobby Admin (`js/render.js:824-840`); `renderJoinCodeBlock` (`js/render.js:71-89`) | Codice breve + QR, nome, online/offline, dispositivi collegati, stato Pronta, indicatore ingresso tardivo, rimozione con conferma tutti presenti. Mancano: rinomina squadra da Admin, aggiunta manuale di una squadra reale (esiste solo l'aggiunta di squadre di **prova**), chiusura/riapertura esplicita delle iscrizioni, visualizzazione dell'orario d'ingresso (`joinedAt` è salvato ma mai mostrato). |
| 4.12 | Finale e modalità spettatore | ✅ | `renderSpectatorFinal` (`js/render.js:459-486`) | Implementa correttamente la "Diretta protetta": stato pensa/bloccata/scaduta, risposte visibili solo secondo `answerVisibilityForEliminated` (`secret`/`after_reveal`/`live`), corretto/sbagliato solo dopo `solutionRevealed`. Pronostici/voto pubblico correttamente assenti: il piano stesso li dichiara moduli opzionali successivi, fuori scope P1. |
| 4.13 | Pannello di regia | 🟡 | `renderAdmin` (`js/render.js:799-1256`) | L'ordine attuale (domanda+timer in alto, party, anteprima prossima domanda, colonna laterale con display/audio/classifica/storico) è già abbastanza vicino a quello consigliato dal piano. Mancano: indicatore "rischio per fascia" (dipende dallo scoring dinamico, assente), sezione "azione successiva raccomandata" esplicita, sezioni richiudibili durante la domanda (il collassamento esiste solo nella Sala pre-partita). Tabelle non responsive (vedi item 51). |
| 4.14 | Modalità prova, controlli e statistiche | 🟡 | `adminAddTestTeams`/`simulateTestTeamAnswers` (`js/actions.js:389-440`); `computePreGameChecklist` (`js/state.js:363-393`); `computeFinalStats` (`js/state.js:407-483`) | Modalità prova con squadre fittizie funzionante ma **sul database di produzione** (vedi FT-01). Checklist pre-start solida (soluzione mancante, duplicati, categorie vuote, quantità insufficiente). Riepilogo finale solido (podio, % corrette, domanda più facile/difficile, squadra più veloce, rimonta), persistito in `statsHistory/<gameId>`. Rivincita implementata (`adminStartRematch`). |

---

## 4. Elenco modifiche prioritizzato — item 1-75 (piano §6)

| # | Modifica | Stato | Riferimento file/funzione | Note |
|---:|---|---|---|---|
| 1 | Progetto Firebase separato per test | 🟡 | `js/firebase-init.js:20-22` | Vedi FT-01: solo emulatore per test automatici, non un progetto cloud reale per collaudo. |
| 2 | Verificare/versionare regole RTDB/Storage | ❌ | — | Vedi FT-02. |
| 3 | Sanificare input utente/XSS | 🟡 | `js/render.js:4-6,27-34` | Vedi FT-03: `escapeHtml` esiste ma non è applicata ovunque (in particolare `rankRows`). |
| 4 | Loading, timeout, errore, retry avvio | ❌ | `js/render.js:304-309` | Vedi FT-04. |
| 5 | Gestire esiti operazioni Firebase critiche | ❌ | `js/firebase-init.js:33-46` | Vedi FT-05. |
| 6 | Invio atomico della risposta | ❌ | `js/actions.js:677-689` | Vedi FT-06. |
| 7 | Atomico/univoco il join per nome | 🟡 | `js/actions.js:552-588` | Vedi FT-08. |
| 8 | Correggere checkpoint hardcoded | ✅ | `js/actions.js:195-219` | Vedi FT-12. |
| 9 | Validazione/limite file audio/media | ❌ | `js/firebase-init.js:25-31` | `uploadAudioFile` non controlla dimensione né tipo file. |
| 10 | Modello dati di sessione strutturato | ❌ | `js/firebase-init.js:23` | Vedi FT-09. |
| 11 | Snapshot/versione della configurazione | 🟡 | `js/actions.js:4-10`; `js/state.js:285-292` | Vedi FT-10. |
| 12 | Sala pre-partita configurabile | 🟡 | `js/render.js:710-778` | Form completo, ma manca riepilogo pre-start dedicato e versionamento della config (dipende da #11). |
| 13 | Preset Classica/Rapida/TuttiControTutti/Personalizzata | ❌ | — | Nessun selettore di preset in tutto il codice. |
| 14 | Salvataggio/duplicazione preset | ❌ | — | Dipende da #13, assente. |
| 15 | Contratto comune delle domande | ❌ | `js/state.js:488-518` | Le domande hanno solo `pool/category/question/options/correctIndex/adminNote/audioUrl`: nessun contratto con tipo contenuto/risposta, tolleranza, politica di risposta dichiarati. |
| 16 | Scelta multipla sul nuovo contratto | 🟡 | `js/render.js:488-559` | Vedi tipologia 3.2. |
| 17 | Vero/falso con profilo dedicato | ❌ | — | Vedi tipologia 3.3. |
| 18 | Domanda fotografica | ❌ | — | Vedi tipologia 3.4. |
| 19 | Domanda audio consolidata | 🟡 | `js/firebase-init.js:25-31` | Vedi tipologia 3.5. |
| 20 | Domanda video | ❌ | — | Vedi tipologia 3.6. |
| 21 | Categoria logica sui motori comuni | ❌ | `js/state.js:49` | Vedi tipologia 3.7. |
| 22 | Motore di ordinamento mobile | ❌ | — | Vedi tipologia 3.8. |
| 23 | Motore di stima numerica | ❌ | — | Vedi tipologia 3.9. |
| 24 | Risposta testuale ibrida con alias e revisione | ❌ | — | Vedi tipologia 3.10. |
| 25 | Motore di scoring a profili e override | 🟡 | `js/state.js:285-292`; `js/actions.js:362-367` | Override per domanda e per manche/finale esistono, ma non come "profili" selezionabili — solo numeri grezzi correct/wrong/noAnswer. |
| 26 | Bonus configurabile per ordine delle corrette | ❌ | `js/state.js:304-313` | Il bonus velocità esistente è a finestra temporale lineare, non basato sull'ordine di arrivo delle risposte corrette. |
| 27 | Penalità configurabile per posizione | ❌ | — | Nessuna fascia/moltiplicatore di posizione: `wrong` è un valore fisso identico per tutti. |
| 28 | Bonus rimonta 0-8% configurabile | ❌ | — | Assente. |
| 29 | Profili Classico, Dinamico, Personalizzato | ❌ | — | Assenti, esiste un solo modello di scoring configurabile a mano. |
| 30 | Modalità finale Azzera/Mantieni/Vantaggio | 🟡 | `js/state.js:136`; `js/state.js:335` | Vedi meccanica 4.3: campo presente ma non applicato — comportamento sempre equivalente a "Mantieni". |
| 31 | Finalisti in numero variabile | ✅ | `js/actions.js:236-257` | `finalistCount` configurabile, gestito correttamente anche quando `ranked.length<=finalistCount`. |
| 32 | Regole modificabili live con effetto prospettico | ❌ | `js/actions.js:81-93` | Vedi meccanica 4.9. |
| 33 | Spareggio qualificazione: 3 domande + stima | ❌ | `js/actions.js:258-264` | Si gioca una sola domanda per round di spareggio; nessuna stima numerica. |
| 34 | Spareggio finale a oltranza | 🟡 | `js/actions.js:292-310` | Suggerimento automatico vincitore presente; eliminazione progressiva/automatizzata assente, tutto manuale domanda per domanda. |
| 35 | Ingresso tardivo configurabile | ✅ | `js/actions.js:563-588` | Vedi meccanica 4.5. |
| 36 | Timer autorevole e sincronizzato | ❌ | `js/actions.js:4-10` | Vedi FT-11. |
| 37 | Pausa/riprendi e animazione congelata | ✅ | `js/actions.js:140-150` | `pausedRemainingMs` congela correttamente il countdown visuale. |
| 38 | ±5 secondi, chiudi, riapri, annulla | 🟡 | `js/actions.js:117-163` | Funzionalmente presenti; riapertura è una finestra fissa (non riprende il residuo esatto) e i comandi non finiscono nel registro eventi. |
| 39 | Politica definitiva/modificabile per risposta | ❌ | `js/actions.js:684` | Sempre "primo invio definitivo": `if(current[key]) return;` blocca qualunque modifica successiva. |
| 40 | Presenza, `onDisconnect`, riconnessione | 🟡 | `js/state.js:234-245` | Vedi FT-07: manca "ultimo contatto" per squadre offline. |
| 41 | Lobby con QR, Pronta, gestione squadre | 🟡 | `js/render.js:824-840` | Vedi meccanica 4.11. |
| 42 | Nuovo pannello di regia Admin | 🟡 | `js/render.js:799-1256` | Vedi meccanica 4.13. |
| 43 | Registro eventi e undo minimo | 🟡 | `js/actions.js:25-48` | Vedi meccanica 4.10. |
| 44 | Modalità prova con squadre fittizie | 🟡 | `js/actions.js:384-440` | Funziona ma su database di produzione (dipende da FT-01). |
| 45 | Validazione banca domande pre-start | ✅ | `js/state.js:363-393` | `computePreGameChecklist` copre soluzione mancante, duplicati, categorie vuote, quantità insufficiente. |
| 46 | Separare listener per ruolo e ramo | ❌ | `js/state.js:185-223` | Un solo listener su tutto `DB_ROOT`, identico per Admin/Team/Display: tutti scaricano l'intero stato del gioco, banca domande inclusa. |
| 47 | Reveal classifica automatico dal basso | ✅ | `js/actions.js:318-357` | `computeStandingsRevealOrder` calcola l'ordine dal fondo, pari merito raggruppati. |
| 48 | Animazioni cambio posizione/podio | 🟡 | CSS `.reveal-row`/`.reveal-pos` in `quizzettone.html:178-189` | Animazione generica di reveal presente; nessuna animazione dedicata a zona qualificazione/podio/vincitore. |
| 49 | Feedback post-domanda e mini-classifiche | 🟡 | `js/render.js:572-583` | Classifiche provvisorie esistono solo ai checkpoint, non dopo ogni singola domanda; nessun indicatore di movimento di posizione o % corrette per domanda mostrato alle squadre. |
| 50 | Regole e rischio visibili ai giocatori | 🟡 | `js/render.js:532-541` | Punti speciali e bonus velocità mostrati prima di rispondere; nessun indicatore di rischio (dipende dallo scoring dinamico assente). |
| 51 | Tabelle Admin responsive | ❌ | `quizzettone.html:157-159` | Nessun contenitore `overflow-x`/colonne prioritarie: le tabelle (`table{width:100%}`) non sono pensate per schermi stretti. |
| 52 | Preload e fallback media | ❌ | — | Nessuna logica di precaricamento della domanda successiva (audio incluso) né fallback per media mancante. |
| 53 | Estrarre blocchi Team/Display realmente condivisi | 🟡 | `renderTeamQuestion`, `rankRows`, `renderProvisionalStandings` (già condivise) vs. blocchi checkpoint/tiebreak duplicati (`js/render.js:359-391` e `627-660`) | Diversi blocchi sono già condivisi (domanda, classifiche, standings reveal); i blocchi checkpoint/spareggio/reveal-finalisti restano duplicati quasi identici tra `renderTeam` e `renderDisplay`. |
| 54 | Modalità spettatore Diretta protetta | ✅ | `js/render.js:459-486` | Vedi meccanica 4.12. |
| 55 | Pronostici e classifica pubblico | ❌ | — | Correttamente assente: il piano stesso li considera fuori scope P1/P4. |
| 56 | Riepilogo finale e rivincita | ✅ | `js/state.js:407-483`; `js/actions.js:447-462` | `computeFinalStats` e `adminStartRematch` entrambi implementati e funzionanti. |
| 57 | Albo d'oro persistente | 🟡 | `persistFinalStatsSnapshot` (`js/actions.js:265-271`) | I dati vengono salvati in `statsHistory/<gameId>` ma **non vengono mai riletti/mostrati** da nessuna vista: non esiste una schermata "Albo d'oro" che elenchi le serate passate. |
| 58 | Autenticazione reale Admin/squadre | ❌ | `ADMIN_PIN` in `js/actions.js:601` | Rinviata come da decisione esplicita del piano (§2.4); PIN statico `'2468'` hardcoded, coerente con lo scope attuale ma da tenere d'occhio se il link viene condiviso fuori dal gruppo fidato. |
| 59-74 | Arcade (Photopuzzle, Indovina chi, Sbaglia&Vinci, Music Box, Memory, Catena di parole, Numeri e cerchi, Alta o bassa, Ghigliottina, Roulette, Top 10, Corsa dei cavalli, Car Racing, Frase misteriosa, Calci di rigore, Cervelluzzle/Ruzzle) | ❌ (tutti e 16) | — | Nessun arcade del REGOLAMENTO implementato. La "Modalità Party" presente nel codice è una funzionalità diversa, non prevista dal piano (vedi nota introduttiva). |
| 75 | Poteri strategici opzionali | ❌ | — | Assenti. |

---

## 5. Sintesi finale

### Conteggio sui 75 item della tabella §6 (checklist più granulare)

| Stato | Conteggio | % |
|---|---:|---:|
| ✅ Implementato | 8 | 10.7% |
| 🟡 Parziale | 21 | 28.0% |
| ❌ Mancante | 46 | 61.3% |
| **Totale** | **75** | 100% |

### Conteggio per gruppo (di supporto, stessi item visti da angolazioni diverse)

| Gruppo | ✅ | 🟡 | ❌ | Totale |
|---|---:|---:|---:|---:|
| FT-01 → FT-12 (fondamenta) | 1 | 4 | 7 | 12 |
| Tipologie di domanda (3.2-3.10) | 0 | 2 | 7 | 9 |
| Meccaniche di gioco (4.1-4.14) | 2 | 11 | 1 | 14 |
| Item 1-75 (checklist definitiva) | 8 | 21 | 46 | 75 |

### Quali gate FT-01/FT-12 sono ancora aperti, e perché bloccano il resto

**11 dei 12 gate sono ancora aperti** (solo FT-12, checkpoint non hardcoded, è pienamente implementato):

- **❌ Mancanti (7):** FT-02 (regole non versionate), FT-04 (nessun loading/retry, stessa schermata bianca dell'AUDIT), FT-05 (errori Firebase silenziosi — quasi nessun `safeSet` controllato), FT-06 (invio risposta ancora read-then-write, non transazionale), FT-09 (stato ancora piatto a prefissi, nessuna sessione strutturata), FT-11 (timer su orologio locale, non autorevole).
- **🟡 Parziali (4):** FT-01 (solo emulatore di test automatico, la Modalità prova reale scrive in produzione), FT-03 (escaping non sistematico — `rankRows` espone ancora XSS sulle schermate di classifica), FT-07 (presenza sì, "ultimo contatto" no), FT-08 (join ancora race-condition, nessuna rinomina), FT-10 (solo il timer è snapshottato, non lo scoring).

Secondo il piano (§2.1, §6), questi interventi sono il **prerequisito esplicito** di quasi tutte le funzionalità successive:

- Il **motore di scoring dinamico** (item 25-29, sezione 4.2) dipende da FT-09 e FT-10 (stato strutturato + snapshot) — oggi assenti, quindi bonus per ordine, penalità per fascia e bonus rimonta non sono costruibili in modo affidabile sopra l'attuale modello dati.
- Le **nuove tipologie di domanda** (sezione 3) dipendono tutte da FT-05/FT-06/FT-09/FT-10 (contratto comune, invio atomico, stato strutturato, snapshot) — coerentemente, nessuna delle 9 tipologie è oggi "✅ Implementato" nemmeno per la più semplice (vero/falso).
- Il **timer autorevole condiviso** (FT-11) è dichiarato come dipendenza esplicita delle meccaniche 4.6 (timer), 4.2 (bonus ordine) e 4.4 (spareggi): oggi il timer funziona ma non è a prova dell'orologio sbagliato di un singolo dispositivo.
- **FT-06 non risolto** lascia aperto esattamente il rischio doppio-invio che il piano cita come motivazione originaria (RIEPILOGO "Doppio invio").
- **FT-03 parziale** lascia una vulnerabilità XSS realmente sfruttabile oggi (nome squadra malevolo → esecuzione script sulle schermate di classifica viste da tutti: Team, Display, Admin).

In sintesi: il "nucleo tecnico" che il piano vuole completato prima di ogni nuova meccanica (Fase 0-1 della roadmap) è solo parzialmente coperto. Il gioco **funziona già dal vivo** con il formato attuale (molte meccaniche del gruppo 4 sono 🟡/✅), ma i gate di sicurezza/affidabilità (FT-02, FT-04, FT-05, FT-06, FT-09, FT-11) restano da chiudere prima di costruire sopra le nuove tipologie di domanda e lo scoring dinamico, esattamente come raccomandato dalla Fase 0 e Fase 1 della roadmap (piano §7).
