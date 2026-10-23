# Audit Quizzettone — 2026-10-22

> Audit completo del progetto così com'è oggi. Sostituisce l'audit del 3 agosto, che descriveva il vecchio `index.html` monolitico (si trova ancora nella cronologia git, commit `323d92a`).

## Stato dopo le correzioni (branch `claude/quizzettone-full-audit-i4x1e8`, PR #4)

Il branch della PR #4 ora parte dalla **PR #3** come base (passo 0 della roadmap). Ci sono state portate le correzioni della vecchia PR #4 e sono stati corretti i finding ancora aperti. Le righe citate più sotto si riferiscono ancora a `main`. Test: **93 e2e + 51 unitari verdi**. Di questi, `tests/e2e/audit-fixes.spec.js` (16 test) fallisce in 14 casi sulla PR #3 originale; `tests/e2e/top10.spec.js` e `tests/unit/top10.spec.js` coprono la nuova modalità.

| # | Stato | Come |
|---|---|---|
| 1 | ✅ | Lo snapshot di undo esclude `history`, e si salvano solo i campi cambiati. Test: 25 azioni restano sotto i 20 KB |
| 2 | ✅ | Condizione `above+tied > posti` corretta. Con 3+ pari per meno posti si resta sullo spareggio, assegnando un posto alla volta (decisione B4: stesso spareggio, più posti) |
| 3 | ✅ | Spareggio giocabile dai telefoni dei soli candidati. Chiave `tiebreak-0` azzerata a ogni nuova domanda. Pulsante "Altra domanda di spareggio" |
| 4 | ⚠️ aperto | Serve la console Firebase (regole/auth) |
| 5 | ✅ | Escape già presente nella PR #3. In più, gli id squadra non generati dall'app vengono ignorati |
| 6, 9, 20 | ✅ | Già corretti dalla PR #3 (`serverNow`, transazioni, limiti di upload) |
| 7 | ✅ | Il tick aggiorna solo il timer. Battito del Display rimosso. I campi admin modificati sopravvivono ai re-render (valori, focus, file scelti) |
| 8 | ✅ | `patchState()`/`statePatchPaths()`: ogni azione scrive solo i propri campi. Test con due admin |
| 10 | ⚠️ aperto | Piano/bucket dello Storage in console |
| 11 | ✅ | Le PR non divergono più. CI in `.github/workflows/tests.yml` (unitari + Playwright con emulatore) |
| 12 | ✅ | La rivincita cancella risposte e punteggi di tutte le squadre, comprese quelle di prova |
| 13 | ✅ | Podio, statistiche e classifiche usano la stessa graduatoria (`standingsRanking`): finaliste prima, vincitrice in testa |
| 14 | ✅ / 🟡 | "Blocca duplicati" e spareggio "a oltranza" ora funzionano. L'opzione "numerica" è stata tolta. Il codice serata resta decorativo (domanda 5) |
| 15 | ✅ | `joinedAt` col tempo del server: chi entra a domanda aperta gioca dalla successiva, con avviso sul telefono e "Entrata dopo" in regia |
| 16 | ❌ aperto | Listener per ruolo: refactor della Fase 7 del piano |
| 17, 21, 23 | ✅ | Griglia `minmax(0,…)` + `.table-wrap`, Fisher-Yates, zoom consentito |
| 18 | ⚠️ | Operativo: unire lontano da una serata, dopo un backup JSON |
| 19 | ❌ aperto | Serve la decisione B3 (domanda 10) |
| 22 | ✅ | Testi calcolati da candidati e posizione reale. Ex aequo nelle classifiche |
| 25 | ✅ | Scheda "Regole della serata" in lobby (Display e telefoni), generata dalla configurazione |
| 26 | 🟡 | Estratta la scheda di attesa dello spareggio, comune a Squadra e Display |

**Altri problemi trovati e corretti durante il lavoro**
- `teamJoin` leggeva lo stato senza default: su un database appena creato l'ingresso delle squadre era bloccato.
- La checklist pre-partita contava come valide le domande Vero/Falso con 4 opzioni, e non teneva conto del tipo di gioco.
- Il Display mandava un battito ogni 2,5 s sul ramo ascoltato da tutti i client, quindi ridisegnava tutto su ogni dispositivo.
- Spareggio: se il pool finale era esaurito non c'erano domande. Ora si attinge al pool manche e, in Top Dieci, a una nuova estrazione di una classifica già giocata (`drawTiebreakCandidates`).

**Schermo condiviso e domande già giocate (2026-10-23)**
- **Schermo condiviso:** la proposta `PROPOSTA_SCHERMO_CONDIVISO_completa.md` è ora implementata per intero. Lo stato punto per punto è in fondo al documento.
- **Finding #16 (prestazioni):** resta aperto. Il battito del Display però non fa più ridisegnare i telefoni.
- **Domande già giocate:** una domanda (o classifica) mostrata in una partita con squadre vere viene scartata dalle partite successive.
  - Se le nuove non bastano, si riprendono quelle giocate da più tempo, con un avviso nella checklist e nel riepilogo prima dell'avvio.
  - Il gestore domande ha "Rimetti in gioco" (per il quiz e per Top Dieci) e mostra quante domande sono nuove e quante già giocate.
  - Le prove con sole squadre fittizie non consumano il mazzo.

**Top Dieci (nuova modalità, regolamento fornito il 2026-10-22)**
- **Si gioca a turno.** La squadra di turno scrive una voce della classifica sul telefono, entro il tempo del turno (30 s di default).
  - Se la voce è in classifica, compare sul tabellone di tutti (telefoni e Display) con il **dato** (es. "8.849 m") e il nome di chi l'ha trovata.
  - Il turno poi passa alla squadra successiva, sia con una risposta giusta sia con una sbagliata o con il tempo scaduto. Una voce già scoperta non fa perdere il turno: si riprova.
- **Punti:** tanti quanti la posizione (10° = 10 punti, 1° = 1 punto), moltiplicati per i "punti corretta". Il valore "sbagliata" è il malus per errore o tempo scaduto (default 0).
- **Fine della classifica:** quando è completa o dopo il numero di giri scelto (default 3; 0 = senza limite). Le voci mancanti le svela il presentatore, dal basso verso l'alto, con il loro dato.
- **Rotazione:** a ogni nuova classifica parte la squadra successiva.
- **Riconoscimento delle risposte:**
  - maiuscole, accenti, punteggiatura e articoli iniziali non contano;
  - 1-2 refusi sono tollerati sulle parole lunghe; le risposte corte devono essere esatte;
  - ogni voce può avere delle alternative, e il cognome da solo vale per i nomi composti.
  - In regia il presentatore può segnare "era giusta" una risposta respinta, o annullarne una accettata.
- **Regia:**
  - classifica completa con dati e alternative;
  - Inizia, Pausa, Passa il turno, Chiudi classifica, Annulla classifica;
  - cronologia delle risposte e punti per squadra.
- **Struttura della partita:** manche, finale tra le prime (su una classifica del pool finale) e spareggi riusano il motore esistente. Lo spareggio si gioca su una classifica tra le sole squadre in parità, e viene suggerita quella con più punti.
- **Dati:** il tabellone vive in `state/top10Boards/<domanda>`. Ogni mossa è una transazione su quel nodo, quindi due dispositivi non possono far saltare o raddoppiare un turno. Le squadre di prova giocano da sole il loro turno.
- **Come si avvia:** dall'hub (`quizzettone.html?gioco=topdieci`, preset: 4 manche da 1 classifica, finale a 2 sulla quinta, punti mantenuti) o con "Tipo di gioco" nella Sala.
- **Mazzo:** nel gestore domande una voce per riga, nel formato `Nome / alternativa = dato`, con lo stesso formato nell'import in blocco. Sono incluse 8 classifiche di esempio con dati e fonte.

## 0. Perimetro e metodo

Il repository oggi contiene **tre versioni** del gioco, e l'audit le copre tutte:

| Versione | Cosa è | Stato |
|---|---|---|
| **`main`** (`5589199`) | Versione pubblicata su GitHub Pages: hub `index.html` + `quizzettone.html` + `js/{firebase-init,state,actions,render}.js` | In produzione |
| **PR #4** (`claude/quizzettone-full-audit-i4x1e8`) | `main` + correzioni dell'audit precedente + 11 test | Aperta, non unita |
| **PR #3** (`claude/quizzettone-audit-planning-usu3kj`) | `main` + 41 commit: pacchetti PL-01→PL-19 del piano consolidato (sessioni, scoring dinamico, Vero/Falso, foto…) + 64 test | Aperta, non unita. Titolo e descrizione dicono "solo documentazione", ma contiene anche moltissimo codice |

**Come ho verificato.**
- Ho letto per intero `main`: `quizzettone.html`, `index.html`, i 4 file `js/*.js`, i test, le configurazioni e `Piano_modifiche_Quizzettone.md`. Della PR #3 ho letto le parti rilevanti e il suo `PROGRESS_LOG.md`.
- Ho eseguito le suite di test sull'emulatore Firebase locale: `main` 26/26 ✅, PR #4 37/37 ✅, PR #3 64/64 ✅.
- Ho scritto **15 esperimenti** (E1–E7 su `main` e PR #4, P1–P8 sulla PR #3) che riproducono i problemi qui sotto con browser reali.
- Il sito pubblicato e il database di produzione **non erano raggiungibili** da questa sessione, perché la rete li blocca. Tutto ciò che riguarda la produzione è quindi marcato come da verificare.

Legenda della verifica: **✅ test** = riprodotto con un test · **📖 codice** = certo dalla lettura del codice, che è deterministico · **⚠️ da verificare** = rischio che si può confermare solo a runtime o in console.

## 1. Executive summary

Il progetto è cresciuto molto bene da agosto. È diviso in 4 file JS invece di un unico HTML, è configurabile dalla Sala pre-partita e ha presenza, chiusura transazionale delle risposte, undo, modalità prova, statistiche e test automatici sull'emulatore. Anche la PR #3 è di buona qualità: 64 test verdi e un piano seguito pacchetto per pacchetto. Restano però **due bug che bloccano o rompono una serata** e che nessuna delle tre versioni ha corretto, più un problema di processo: due PR aperte che correggono le stesse cose in modo diverso.

**Rischi principali**
1. **Lo stato cresce in modo esponenziale (✅ test, tutte e tre le versioni).** Ogni azione annullabile salva dentro lo stato una copia JSON dello stato precedente, che contiene già la copia di prima. Dopo 12 azioni lo stato passa da 16 KB a **8,4 MB**, e alla 13ª supera il limite di 10 MB per stringa di Firebase. Ogni scrittura fa poi viaggiare MB verso tutti i telefoni (`js/actions.js:27`).
2. **Il pari al primo posto blocca la partita (✅ test).** `qualifiedSoFar: []` non viene salvato, perché Firebase non conserva gli array vuoti. Il pulsante "Assegna posto finale" va quindi in `TypeError` e il gioco resta fermo su "Risultato spareggio" (`js/actions.js:280`). Su `main` e sulla PR #3 succede già con **due** squadre pari al primo posto; sulla PR #4 con tre o più.
3. **Sicurezza ancora affidata alla fiducia.** Non c'è nessuna autenticazione, le regole Firebase non sono versionate (PL-04 "saltato" nella PR #3) e, su `main`, i nomi squadra sono ancora soggetti a XSS (corretto in entrambe le PR). Un upload di prova sullo Storage ha ricevuto **"Quota for bucket exceeded"**: probabile blocco del piano gratuito.

**Punti di forza**
1. La pipeline di punteggio è unica e coerente: `scoringFor → pointsForAnswer → teamPointsForQuestion → roundScore → totalScore` (`js/state.js:285-335`).
2. La chiusura delle risposte è una transazione idempotente eseguibile da qualunque client (`js/actions.js:104-116`), e la presenza è gestita con `onDisconnect` riarmato a ogni riconnessione (`js/state.js:213-239`).
3. Esiste una vera infrastruttura di test (Playwright + emulatore, con il parametro `?emulator=1` che non tocca la produzione) e la PR #3 la estende con costanza.

## 2. Audit tecnico

### 2.1 Architettura

- **Struttura.** Ci sono due pagine statiche. `index.html` è l'hub "Enigma Games", con la card Quizzettone e due card "Coming Soon" (Top Dieci, ???) (`index.html:141-162`). `quizzettone.html` contiene CSS e boot e carica, in ordine, `firebase-init.js`, `state.js`, `actions.js` e `render.js` come script classici con scope globale condiviso (`quizzettone.html:226-235`). Non c'è nessun bundler, ed è una scelta adatta a un progetto hobbistico.
- **Separazione delle responsabilità.** È buona, considerato che non ci sono moduli:
  - `firebase-init.js`: configurazione e accesso al database;
  - `state.js`: stato locale, listener, punteggi, statistiche e pesca delle domande;
  - `actions.js`: le scritture;
  - `render.js`: HTML e gestori degli eventi.

  Il debito tecnico sta nello stato **globale mutabile** condiviso da tutti i file (`js/state.js:66-96`) e nel render "a stringhe", dove `innerHTML` ricostruisce l'intera pagina a ogni evento (`js/render.js:437`, `:1217`).
- **Duplicazione.** I blocchi checkpoint/spareggio di Squadra e Display sono ancora copiati (`js/render.js:359-392` contro `:627-660`). Il CSS dei token è duplicato tra `index.html:10-22` e `quizzettone.html:26-38`.
- **Tre versioni divergenti (📖).** PR #3 e PR #4 toccano gli stessi file (`actions.js`, `render.js`, `state.js`, `firebase-init.js`) per risolvere gli stessi problemi in modo diverso: XSS, schermata di avvio, invio atomico, ora del server, limite audio, errori di scrittura. **Unirle entrambe produrrà conflitti estesi.** Serve una scelta (vedi §5).

### 2.2 Firebase (dati, regole, sicurezza)

- **Regole e autenticazione (⚠️ da verificare).** Non c'è nessuna chiamata `firebase.auth()` e manca un file di regole (`firebase.json` contiene solo l'emulatore). Il piano stesso (§2.4) accetta per ora l'assenza di auth, ma chiede di **verificare ed esportare subito** le regole (FT-02). La PR #3 l'ha esplicitamente saltato (PL-04). Con la chiave pubblica e le regole aperte, chiunque abbia l'URL può svuotare `quizzettone/`.
- **Storage (⚠️ da verificare).** L'upload di prova verso `quizzettone-49543.firebasestorage.app` ha risposto `storage/quota-exceeded`, mentre la lettura risponde 403. È compatibile con il blocco di Cloud Storage sul piano gratuito Spark. Le domande audio e gli effetti potrebbero non caricarsi più.
- **Modello dati.**
  - Su `main` resta il nodo piatto con chiavi a prefisso (`teaminfo:`, `answers:`, `question:`…), e tutto lo stato di partita, configurazione compresa, sta in un unico oggetto `state` (`js/state.js:98-149`).
  - La PR #3 introduce i rami `sessions/current/{state,teams,answers,scoreLedger,presence,questionInstances}`, `questionBank/` e `soundEffects/` (PR #3 `js/firebase-init.js:34-47`), come chiede il piano (§2.2, FT-09). La migrazione è un unico `update()` atomico eseguito dal primo admin che apre il pannello (PR #3 `js/state.js:410-440`).
  - **Rischio della migrazione (⚠️):** un telefono con ancora aperta la versione vecchia continua a scrivere sulle chiavi piatte. Dopo la migrazione quelle scritture vengono ignorate per sempre, perché `migrationAttempted` e il controllo "già migrato" impediscono una seconda passata.
- **Scritture "a stato intero" (✅ test E5/P7, tutte e tre).** Quasi tutte le azioni admin scrivono `safeSet('state', {...state, campo})`, cioè riscrivono **tutto** lo stato partendo dalla copia locale (ad esempio `js/actions.js:203`, `:221`, `:312`). Due dispositivi admin che agiscono insieme si annullano a vicenda: nel test, "Mostra classifica" di una scheda viene cancellato dal cambio checkpoint dell'altra. Allo stesso modo, una scrittura admin può annullare per un istante la chiusura transazionale fatta da un telefono, che il tick successivo ripristina.
- **Undo che cresce senza limite (✅ test E1/P3, tutte e tre).** `withUndo` salva `beforeJson: JSON.stringify(state)` (`js/actions.js:27`). `state` contiene già `history.last.beforeJson` dell'azione precedente, quindi ogni livello reinserisce il precedente con gli escape raddoppiati. Misure con 10 squadre e 2 manche da 15 domande, una dopo ogni cambio di modalità del checkpoint: **16 KB → 27 → 42 → 65 → 104 → 176 → 313 → 580 KB → 1,1 → 2,2 → 4,2 → 8,4 MB**. La catena si azzera solo con undo, correzione punti o rimozione squadra, cioè quando l'undo riguarda un percorso diverso da `state`. Le azioni che la allungano sono:
  - cambio modalità del checkpoint (`:220-222`);
  - annullamento domanda (`:128-134`);
  - **ogni fascia rivelata della classifica animata** (`:334-344`): una sola rivelazione con 10 squadre aggiunge fino a 10 livelli.

  Sulla PR #3 lo stato di partenza è più piccolo (3,9 KB, perché le domande sono fuori da `state`), ma il fattore ×1,9 per passo è lo stesso: 1,9 MB a 12 azioni.
- **Presenza.** È implementata bene (`js/state.js:230-245`). Manca solo "ultimo contatto" (FT-07). Le squadre di prova risultano sempre offline perché non hanno una presenza.
- **Ora del server.** Su `main` timer, chiusura a scadenza, bonus velocità, suggerimento dello spareggio e cue audio usano l'orologio di **ogni** dispositivo (`js/render.js:12`, `js/actions.js:9,112`). Un telefono con l'orologio avanti di 30 s **chiude la domanda per tutti** appena aperta: l'ho verificato con un test, che falliva su `main`. È corretto sia nella PR #4 sia nella PR #3 (PL-11).

### 2.3 Qualità del codice

- **Leggibilità e commenti.** Sono buoni. I commenti in italiano spiegano il *perché* delle scelte, per esempio la potatura degli `{}` a `js/actions.js:19-24` o la delega dei click a `js/render.js:1451-1459`. Non c'è codice morto né `console.log` di debug.
- **XSS (✅ test su `main`).** Il nome squadra è inserito senza escape in oltre 20 punti (ad esempio `js/render.js:31`, `:334`, `:831`, `:954`, `:1073`). È corretto in entrambe le PR: `teamLabel()` nella PR #4, `teamNameHtml()` nella PR #3.
- **Esiti delle scritture.** Su `main` nessun chiamante controlla il valore restituito da `safeSet`. Per esempio `teamJoin` mostra "Sei dentro!" anche se la scrittura fallisce (`js/actions.js:582`). La PR #4 copre l'ingresso. La PR #3 copre ingresso, risposta, start, setup e reset con un banner di errore e un comando per riprovare (PL-03).
- **Avvio senza feedback.** Su `main` c'è `if(!state) return;` e nient'altro (`js/render.js:305`), quindi se Firebase non risponde la pagina resta vuota. È corretto in entrambe le PR.
- **Array vuoti potati da Firebase (✅ test E3/P2).** Il codice in alcuni punti presume che `[]` sopravviva al salvataggio. In questo caso è la causa del blocco dello spareggio (§3.3). Altrove è già gestito con `||[]` (ad esempio `js/render.js:1039`).
- **Opzioni della Sala che non fanno nulla (📖).**
  - `scoreCarryover` ("Punti in ingresso finale", `js/render.js:766`) non viene mai letto: è implementato solo nella PR #3, con PL-16.
  - `blockDuplicateQuestions` (`js/render.js:769`) non è letto da nessuna funzione, né su `main` né nella PR #3.
  - Le regole di spareggio "a oltranza" e "più vicino al valore corretto" (`js/render.js:712-718`) non hanno alcun meccanismo: lasciano solo la scelta manuale all'admin (`js/state.js:337-349`). Le domande numeriche non esistono.

### 2.4 Performance

- **Un listener su tutto l'albero (📖, tutte e tre).** C'è `db.ref(DB_ROOT).on('value')` (`js/state.js:188`) e il piano §2.3 chiede di separarlo per ruolo. Ogni telefono scarica banca domande, mazzi party, preset e `statsHistory` (che cresce a ogni partita: `js/actions.js:267-271`), e a **ogni** evento ricostruisce l'intero oggetto e l'intera pagina. Esempio E7: con 300 domande il Display scarica 75 KB, di cui 66 KB sono la banca domande che non gli serve. Il problema diventa critico insieme alla crescita dell'undo descritta in §2.2.
- **Ridisegno completo ogni 250 ms (✅ test).** Durante una domanda il tick chiama `render()` (`js/state.js:279`) e ricostruisce tutta la pagina. Oltre al costo su telefoni datati, **svuota i campi che l'admin sta scrivendo** (vedi §3.3). È corretto nella PR #4, dove si aggiorna solo il timer; non nella PR #3.
- **Battito del Display (PR #3, ✅ test P4).** `armDisplayPresence` scrive un battito ogni 2,5 s (PR #3 `js/state.js:460-470`). Con il listener sull'intero albero, **ogni battito fa ridisegnare tutti gli schermi di tutti i client**. Durante una serata con Display acceso, è un ridisegno completo ogni 2,5 s su ogni telefono.
- **Media.** Su `main` non c'è nessun limite agli upload (`js/firebase-init.js:25-31`). Il limite è di 10 MB nella PR #4 e di 8 MB nella PR #3, che lo applica anche alle immagini.

### 2.5 Deploy e workflow

- **Deploy.** GitHub Pages serve direttamente `main`, senza build, e la home è l'hub `index.html`. Non c'è cartella `.github/`, quindi **nessuna CI**: i test esistono (26 su `main`, 64 sulla PR #3) ma vengono eseguiti solo a mano. Il `PROGRESS_LOG` della PR #3 annota più volte "suite completa non rieseguita". Una GitHub Action con l'emulatore costerebbe poco e coprirebbe proprio questo.
- **Ambiente di test.** Su `main` e sulla PR #4 la modalità prova scrive squadre fittizie sul **database di produzione** (`js/actions.js:389-398`), e il piano chiedeva un secondo progetto Firebase (FT-01). La PR #3 ha scelto, con conferma dell'utente, un reset in due passaggi con checklist di backup al posto del secondo progetto. L'emulatore locale c'è, ma serve solo ai test automatici.
- **PR aperte.** Due rami lunghi e non uniti (la PR #3 è ferma dal 7 agosto) su un progetto con un solo manutentore. Più passa il tempo, più costa riconciliarli.

## 3. Audit del game design

### 3.1 Flusso di gioco ricostruito (`main`)

1. **Hub → gioco.** `index.html` porta a `quizzettone.html`, dove si sceglie "Sono una squadra" oppure "Sono l'admin" (PIN) (`js/render.js:211-265`).
2. **Sala pre-partita.** L'admin configura il nome della partita, il numero di manche, le domande per manche, i finalisti, le domande di finale, la durata, i punteggi, la regola di spareggio, l'ingresso tardivo e l'avvio del timer. Tra le opzioni avanzate ci sono il punteggio della finale, i punti in ingresso in finale, la visibilità per gli eliminati, il blocco dei duplicati e il bonus velocità (`js/render.js:710-779`). Vede anche codice e QR, una checklist del mazzo, la modalità prova e la modalità party (`:809-850`).
3. **Lobby.** Le squadre entrano dal QR o dall'URL con il solo nome, possono segnarsi "Pronta" e vedono presenza ed eventuali badge "tardiva" o "PROVA" (`js/render.js:824-840`).
4. **Avvio.** Vengono pescate dal pool "manche" tante domande quante richiede la configurazione e divise per manche. La configurazione viene bloccata (`js/actions.js:49-80`).
5. **Ciclo della domanda.** Il timer parte da solo o a comando. L'admin può mettere in pausa e riprendere, aggiungere o togliere 5 s, chiudere subito, riaprire per 10 s, annullare la domanda, svelare la soluzione, cambiare il punteggio della singola domanda, correggere ±1 per squadra e annullare l'ultima azione (`js/render.js:858-961`, `js/actions.js:104-219`).
6. **Checkpoint.** A metà manche (se le domande sono almeno `checkpointMinQuestions`) e a fine manche, con varie modalità di visualizzazione (`js/actions.js:195-235`).
7. **Finalisti.** Si prendono i primi `finalistCount`. Con un pari al taglio parte uno spareggio con una domanda dal pool "finale", un suggerimento automatico per le regole `prima_corretta`/`corretta_veloce` e l'assegnazione manuale (`js/actions.js:236-284`).
8. **Finale.** Si gioca con `finalQuestionCount` domande e un punteggio di finale opzionale. Le eliminate guardano da spettatrici, con la visibilità delle risposte configurabile (`js/render.js:459-486`).
9. **Vincitore.** Si decide **solo sui punti della finale** (`js/actions.js:294`). In caso di pari si usa lo stesso spareggio (`:297-305`).
10. **Fine serata.** Statistiche (podio, % di risposte corrette, domanda più facile e più difficile, squadra più veloce, rimonta) salvate in `statsHistory`, classifica animata a fasce, rivincita o reset (`js/actions.js:265-376,447-462`).

### 3.2 Regole di punteggio

- Ci sono i punti `correct`/`wrong`/`noAnswer` della configurazione, con un punteggio di finale separato facoltativo (`js/state.js:285-292`).
- La singola domanda può avere un override (`scoringOverrides`).
- La correzione manuale per squadra e domanda ha la precedenza su tutto (`:314-322`).
- Le domande annullate valgono 0.
- Il **bonus velocità** è lineare: `maxBonus × (1 − trascorso/finestra)`, solo se la risposta è corretta. Viene calcolato una sola volta all'invio e salvato con la risposta (`:304-313`), e le squadre lo vedono annunciato prima di rispondere (`js/render.js:528-541`). È un buon esempio di trasparenza.
- **Incoerenza (📖).** Il vincitore viene da `roundScore(id,'final')` (`js/actions.js:294`), mentre classifica live, classifica animata e **podio delle statistiche** usano `totalScore`, cioè qualificazione più finale (`js/state.js:335`, `:449`). Con l'impostazione predefinita "Azzera" il podio può quindi mettere al 1° posto una squadra diversa da quella appena proclamata campione. La PR #3 (PL-16) cambia `totalScore` per i finalisti: va verificato che podio e vincitore ora coincidano.
- La PR #3 aggiunge profili Classico/Dinamico/Personalizzato, bonus per ordine di risposta, penalità adattiva per fasce e bonus rimonta (PL-13→PL-17), come prevede il piano §4.2.

### 3.3 Casi limite e gestione errori

| Caso | `main` | PR #4 | PR #3 | Verifica |
|---|---|---|---|---|
| **2 squadre pari al 1° posto** (2 posti in finale) | ❌ spareggio inutile → "Assegna" va in `TypeError` → partita bloccata | ✅ entrambe in finale | ❌ come `main` | ✅ test (E3, P2) |
| **3 o più squadre pari al 1° posto** | ❌ bloccata | ❌ bloccata | ❌ bloccata | ✅ test E3 |
| Pari per il 2° posto con una 1ª netta | ✅ spareggio corretto | ✅ | ✅ | ✅ test |
| **Le squadre in spareggio rispondono** | ❌ pulsanti disabilitati e "Tempo scaduto" (`js/render.js:344`) | ✅ | ❌ (PR #3 `js/render.js:528`) | ✅ test (P1) |
| Spareggio con una domanda diversa dalla prima / secondo spareggio nella stessa partita | ❌ risposte cercate con la chiave sbagliata (`js/state.js:350`, `js/render.js:1023`); le risposte vecchie restano | ✅ | ❌ | ✅ test (PR #4) / 📖 (PR #3) |
| Pari in finale | ✅ stesso spareggio (ma con 3+ finaliste pari vale la riga sopra) | ✅ | ✅ | 📖 + test del progetto |
| Squadra che si disconnette | ✅ pallino rosso, conteggio "offline" | ✅ | ✅ (+ presenza del Display) | 📖 |
| Admin che ricarica la pagina | ✅ stato su Firebase; si perdono solo pannelli aperti e moduli non salvati | ✅ | ✅ | 📖 |
| Doppio tocco sulla risposta | ❌ vince l'ultima | ✅ | ✅ | ✅ test |
| **Ingresso tardivo a domanda aperta** | ⚠️ risponde subito alla domanda in corso; il piano §4.5 dice "dalla successiva" | idem | idem | ✅ test (E6, P8) |
| **Rivincita dopo una prova con squadre fittizie** | ❌ le squadre di prova restano con le risposte vecchie, che valgono nella nuova partita (`js/actions.js:449-450`) | idem | idem | ✅ test (E4, P6) |
| **Due dispositivi admin** | ❌ le azioni simultanee si cancellano | idem | idem | ✅ test (E5, P7) |
| **L'admin compila la Sala mentre entrano squadre** | ❌ le modifiche non salvate si azzerano a ogni ingresso o "Pronta" | idem | ❌ e con il Display aperto si azzerano ogni 2,5 s | ✅ test (E2, P4) |
| L'admin compila "Punteggio per questa domanda" durante il timer | ❌ si svuota ogni 250 ms | ✅ | ❌ | ✅ test (P5) |
| Telefono con l'orologio sbagliato | ❌ può chiudere la domanda per tutti | ✅ | ✅ | ✅ test |
| Firebase irraggiungibile all'avvio | ❌ pagina vuota | ✅ | ✅ | ✅ test |
| Partita lunga con molti undo o una classifica animata | ❌ stato oltre i 10 MB (§2.2) | ❌ | ❌ | ✅ test (E1, P3) |
| Rientro con il nome di un'altra squadra | ⚠️ entra nella squadra altrui | idem | idem (con indice atomico: niente doppioni) | 📖 |

### 3.4 Chiarezza per l'utente finale

- **Nessuna schermata con le regole.** Il giocatore vede solo messaggi di stato. Il formato (manche, finale, spareggi, punti) va spiegato a voce.
- **Elementi chiari:** QR e codice, "Pronta", i badge "Punti speciali" e "Bonus velocità attivo" annunciati prima di rispondere, la modalità spettatore delle eliminate, il banner di connessione persa.
- **Elementi che confondono:**
  - il **"codice serata"** è mostrato in grande ma non viene mai chiesto né controllato all'ingresso: basta l'URL (`js/render.js:71-89`; il join a `:267-301` chiede solo il nome);
  - "Due squadre si giocano l'accesso in finale" compare anche con 3 squadre o nello spareggio della vittoria (`js/render.js:348`, `:618`);
  - "Secondo posto, ma che partita!" compare a ogni finalista non vincitrice, anche quarta su quattro (`js/render.js:426`);
  - la classifica live numera 1°, 2° anche a pari punti (`js/render.js:27-34`), mentre la classifica animata raggruppa correttamente i pari merito.

### 3.5 Coerenza tra piano (`Piano_modifiche_Quizzettone.md`) e implementazione

| Piano | `main` | PR #3 |
|---|---|---|
| FT-01 ambiente di test separato | ❌ modalità prova sul database di produzione | 🟡 sostituito da reset in 2 passaggi + backup manuale (scelta confermata dall'utente) |
| FT-02 regole versionate | ❌ | ❌ (PL-04 saltato) |
| FT-03…FT-06, FT-11 (XSS, avvio, errori, invio atomico, ora del server) | ❌ | ✅ |
| FT-07 presenza / ultimo contatto | 🟡 manca l'ultimo contatto | 🟡 |
| FT-08 nomi unici, rinomina | ❌ | ✅ indice atomico + `adminRenameTeam` |
| FT-09 / FT-10 sessione strutturata, snapshot | ❌ | ✅ (vedi rischio di migrazione, §2.2) |
| §2.3 listener separati per ruolo | ❌ | ❌ |
| §4.3 Azzera / Mantieni / Vantaggio | ❌ opzione visibile ma inerte | ✅ PL-16 |
| §4.4 spareggi (tre domande, poi stima numerica; oltranza in finale) | 🟡 una domanda + scelta admin | 🟡 idem |
| §4.5 ingresso tardivo "dalla domanda successiva" | ❌ | ❌ |
| §4.10 undo minimo | 🟡 funziona ma cresce in modo esponenziale | 🟡 idem |
| §4.11 rinomina, blocco, chiusura iscrizioni | 🟡 solo rimozione | 🟡 + rinomina |
| §4.12 diretta protetta per le eliminate | ✅ | ✅ |
| §4.14 controlli pre-start, statistiche, rivincita | ✅ (rivincita con il problema delle squadre di prova) | ✅ idem |
| Fase 4: tipologie di domanda | ❌ solo scelta multipla a 4 opzioni | 🟡 contratto comune + Vero/Falso + foto (PL-18/19) |

## 4. Findings prioritizzati

| # | Area | Severità | Descrizione | File/riga (`main`) | Raccomandazione | Stato `main` · PR #4 · PR #3 |
|---|---|---|---|---|---|---|
| 1 | Dati / affidabilità | **Critico** | Lo snapshot di undo contiene lo snapshot precedente: lo stato raddoppia a ogni azione annullabile e supera i 10 MB in una partita normale (✅) | `js/actions.js:25-35` (riga 27); azioni a `:220-222`, `:128-134`, `:334-344` | Salvare lo snapshot senza `history` (`{...before, history:null}`) o solo i campi cambiati; aggiungere un test che misuri la dimensione dopo 20 azioni | ❌ · ❌ · ❌ |
| 2 | Game design | **Critico** | Pari al 1° posto → `qualifiedSoFar` vuoto non salvato → `TypeError` su "Assegna" → partita bloccata (✅) | `js/actions.js:248-252`, `:280` | Usare `(state.tiebreak.qualifiedSoFar \|\| [])`; permettere di assegnare più posti dallo stesso spareggio (decisione B4); correggere la condizione `above+tied > finalistCount` | ❌ · 🟡 (solo 3+ pari) · ❌ |
| 3 | Game design | **Critico** | Lo spareggio non si gioca dai telefoni (`active=false`); chiave risposte sbagliata con domande diverse dalla prima; risposte vecchie non azzerate (✅) | `js/render.js:344`; `js/state.js:350`; `js/render.js:1023`; `js/actions.js:258-264` | Portare nella PR #3 la correzione della PR #4 | ❌ · ✅ · ❌ |
| 4 | Sicurezza | **Critico** (da verificare) | Nessuna auth, regole non versionate: con regole aperte chiunque può cancellare tutto | `js/firebase-init.js:8-23`; `firebase.json` | Esportare e versionare `database.rules.json`/`storage.rules` (FT-02); valutare l'auth anonima per i team | ⚠️ · ⚠️ · ⚠️ |
| 5 | Sicurezza | **Alto** | XSS sui nomi squadra (✅) | `js/render.js:31,334,831,954,1073`… | Già corretto nelle PR: unirne una | ❌ · ✅ · ✅ |
| 6 | Tempo | **Alto** | Orologi dei dispositivi: un telefono avanti chiude la domanda per tutti; bonus velocità falsato (✅) | `js/actions.js:9,112`; `js/render.js:12`; `js/state.js:271-273` | Già corretto nelle PR | ❌ · ✅ · ✅ |
| 7 | UX regia | **Alto** | Form admin azzerati: tick a 250 ms, ogni evento in lobby, e nella PR #3 il battito del Display ogni 2,5 s (✅) | `js/state.js:279`; `js/render.js:1217`; PR #3 `js/state.js:460-470` | Aggiornare solo il timer (come nella PR #4); non ridisegnare la Sala mentre ha il focus, oppure salvare e ripristinare i valori; nella PR #3 togliere il battito dal ramo ascoltato da tutti | ❌ · 🟡 · ❌ (peggiorato) |
| 8 | Dati | **Alto** | Scritture a stato intero: due admin si cancellano le azioni a vicenda (✅) | `js/actions.js` (es. `:203,221,312`) | Usare `update()` sui soli campi toccati (`state/standingsVisible`…) o transazioni | ❌ · ❌ · ❌ |
| 9 | Affidabilità | **Alto** | Invio risposta non atomico; ingresso e avvio senza controllo degli esiti; pagina vuota se Firebase tace (✅) | `js/actions.js:677-689,582`; `js/render.js:305` | Già corretto nelle PR | ❌ · ✅ · ✅ |
| 10 | Infrastruttura | **Alto** (da verificare) | Lo Storage risponde "quota exceeded" all'upload | `js/firebase-init.js:25-31` | Controllare piano e bucket in console Firebase; senza Blaze gli audio non si caricano | ⚠️ · ⚠️ · ⚠️ |
| 11 | Deploy | **Medio** | Due PR divergenti sugli stessi file; nessuna CI | — | Vedi §5 passo 0; aggiungere una GitHub Action con Playwright ed emulatore | — |
| 12 | Game design | **Medio** | La rivincita conserva squadre di prova e risposte vecchie, che valgono nella nuova partita (✅) | `js/actions.js:447-462` | Nella rivincita cancellare anche le risposte delle squadre di prova, o rimuovere le squadre di prova | ❌ · ❌ · ❌ |
| 13 | Game design | **Medio** | Podio delle statistiche (totale) e vincitore (solo finale) possono non coincidere (📖) | `js/actions.js:294` vs `js/state.js:449` | Usare la stessa classifica in tutte le schermate di fine partita | ❌ · ❌ · ⚠️ da verificare dopo PL-16 |
| 14 | Configurazione | **Medio** | Opzioni visibili ma senza effetto: punti in ingresso in finale, blocco duplicati, spareggio "a oltranza"/"numerico"; codice serata mai richiesto (📖) | `js/render.js:712-718,766,769,71-89` | Implementarle o nasconderle; decidere se il codice va chiesto all'ingresso | ❌ · ❌ · 🟡 (ingresso in finale sì, il resto no) |
| 15 | Game design | **Medio** | L'ingresso tardivo può rispondere alla domanda già aperta (✅) | `js/actions.js:563-588`; `js/render.js:339-341` | Salvare `joinedAt` col tempo del server e ignorare le domande aperte prima | ❌ · ❌ · ❌ |
| 16 | Performance | **Medio** | Ogni client scarica tutto l'albero (banca, statistiche, mazzi) e ridisegna tutta la pagina a ogni evento | `js/state.js:188` | Listener separati per ruolo (piano §2.3, Fase 7) | ❌ · ❌ · ❌ |
| 17 | Mobile | **Medio** | La pagina admin sborda su smartphone: la griglia `1fr` non si restringe e le tabelle non scorrono (✅ 531px su 375) | `quizzettone.html:63-66`; `js/render.js:946,1071` | `minmax(0,1fr)` + `.table-wrap` (come nella PR #4) | ❌ · ✅ · ❌ |
| 18 | Migrazione | **Medio** (PR #3) | Dopo la migrazione a `sessions/`, i client vecchi ancora aperti scrivono su chiavi ignorate | PR #3 `js/state.js:410-440` | Unire e pubblicare solo lontano da una serata, dopo un backup; far ricaricare tutti i dispositivi | n/a · n/a · ⚠️ |
| 19 | Identità | **Medio** | Rientro per nome = chiunque può prendere il posto di un'altra squadra | `js/actions.js:552-588` | Decisione B3 (rientro solo dal proprio dispositivo o con un codice) | ❌ · ❌ · 🟡 (niente doppioni) |
| 20 | Media | **Basso** | Upload audio senza limiti | `js/firebase-init.js:25-31` | Già corretto nelle PR | ❌ · ✅ · ✅ |
| 21 | Qualità | **Basso** | Mescolamento `sort(()=>Math.random()-0.5)` non uniforme | `js/state.js:598,609` | Fisher-Yates (come nella PR #4) | ❌ · ✅ · ❌ |
| 22 | UX testi | **Basso** | "Due squadre si giocano…", "Secondo posto…", classifica live senza ex aequo | `js/render.js:348,618,426,27-34` | Testi calcolati da `candidates`/posizione; numerazione con pari merito | ❌ · 🟡 · ❌ |
| 23 | Accessibilità | **Basso** | `user-scalable=no` impedisce lo zoom a chi vede poco | `index.html:5`; `quizzettone.html:6` | Togliere `maximum-scale`/`user-scalable` | ❌ · ❌ · ❌ |
| 24 | Sicurezza | **Basso** (accettato) | PIN admin `2468` in chiaro nel sorgente | `js/actions.js:601` | Come da piano §2.4: è solo una barriera contro i tocchi accidentali | — |
| 25 | Chiarezza | **Basso** | Nessuna schermata con le regole per i giocatori | — | Regole sul Display in lobby, generate dalla configurazione | ❌ · ❌ · ❌ |
| 26 | Architettura | **Basso** | Markup Squadra/Display duplicato (checkpoint, spareggio); CSS duplicato tra le pagine | `js/render.js:359-392` vs `:627-660` | Estrarre funzioni condivise quando si toccano | ❌ · 🟡 · ❌ |

## 5. Roadmap consigliata

0. **Scegliere la base, prima di tutto.** Consiglio la **PR #3**, che è più completa, segue il piano approvato e ha 64 test verdi. Poi:
   - portarci dalla PR #4 solo ciò che le manca: spareggio giocabile e chiave delle risposte (#3), condizione del pari al taglio (#2), tick che aggiorna solo il timer (#7), griglia e tabelle (#17), Fisher-Yates (#21) e i relativi test;
   - chiudere la PR #4 senza unirla;
   - correggere titolo e descrizione della PR #3, che oggi dice "solo documentazione".
1. **Prima della prossima serata, in qualunque versione:**
   - correggere #1 (dimensione dell'undo) e #2 (blocco dello spareggio), con test;
   - verificare in console regole e Storage (#4, #10).
2. **Unione della PR #3.** Va fatta lontano da una serata e dopo un'esportazione JSON del database (#18). Poi si apre l'admin una volta per migrare e si fanno ricaricare tutti i dispositivi.
3. **Robustezza della regia:**
   - #7: niente form azzerati e niente battito nel ramo ascoltato da tutti;
   - #8: `update()` sui singoli campi invece della riscrittura dell'intero stato.
4. **Coerenza delle regole:** #12 (rivincita), #13 (podio e vincitore), #14 (implementare o nascondere le opzioni), #15 (ingresso tardivo) e la decisione su B4 (3 o più pari).
5. **Processo:** una GitHub Action che esegua la suite Playwright con l'emulatore su ogni PR (#11).
6. **Solo dopo, nuove modalità.** "Top Dieci" è nel piano come arcade P5-C, da costruire riusando un motore di "Ordinamento" che ancora non esiste (piano §4.15, Fase 8). Va affrontata dopo la Fase 4 (tipologie di domanda), non prima.

---

## Domande aperte che richiedono una tua conferma

1. **Quale PR è la base?** Confermi la PR #3, con il trasferimento delle correzioni mancanti dalla PR #4? Oppure preferisci unire prima la #4 (più piccola) e poi riallineare la #3?
2. **Regole Firebase e Storage:** cosa c'è oggi in console (Realtime Database → Regole, Storage → piano/bucket)? Lo Storage "quota exceeded" dipende dal piano Spark?
3. **3 o più squadre pari al 1° posto:** si assegnano più posti dallo stesso spareggio, o si gioca una domanda per ogni posto?
4. **Ingresso tardivo:** chi entra a domanda aperta può rispondere, oppure partecipa dalla domanda successiva come dice il piano?
5. **Codice serata:** va chiesto all'ingresso, così da bloccare chi ha solo il link, o è solo decorativo?
6. **Opzioni inerti** ("blocca duplicati", spareggio "a oltranza" e "numerico"): le implemento o le nascondo finché non esistono?
7. **Classifica di fine partita:** con "Azzera", il podio delle statistiche deve seguire la finale (come il vincitore) o il totale della serata?
8. **Rivincita dopo una prova:** le squadre fittizie vanno rimosse automaticamente?
9. **Due dispositivi admin** (es. portatile + telefono) sono uno scenario che vuoi supportare? Da questo dipende la priorità del finding #8.
10. **Rientro con lo stesso nome:** resta libero (comodo ma permette di prendere il posto di altri) o va legato al dispositivo o a un codice?
