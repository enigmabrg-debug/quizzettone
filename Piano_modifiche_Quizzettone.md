# Piano di modifiche Quizzettone

> Versione consolidata del 3 agosto 2026  
> Progetto: quiz multiplayer web in HTML/CSS/JavaScript, Firebase Realtime Database e GitHub Pages  
> Contesto: progetto hobbistico, mantenuto da una sola persona e utilizzato dal vivo con amici

## Fonti e criterio di tracciabilità

Il piano integra quattro documenti, citati con queste abbreviazioni:

- **AUDIT** — `AUDIT_QUIZZETTONE`: stato reale del codice, fragilità e riferimenti a `index.html`;
- **RIEPILOGO** — `RIEPILOGO_AUDIT_QUIZZETTONE`: revisione delle priorità in rapporto al contesto hobbistico;
- **BRAINSTORMING** — `Quizzettone_Brainstorming_e_Roadmap`: idee già valutate, backlog QZ-01–QZ-18 e decisioni di prodotto;
- **REGOLAMENTO** — `regolamento_tecnico_quiz_live_cervellone_drwhy`: riferimento principale per domande, punteggi, tempi, manche e giochi secondari.

Le decisioni prese durante il chiarimento non introducono temi estranei: risolvono alternative già presenti nei quattro documenti. Quando il piano propone un dettaglio tecnico non prescritto testualmente dalle fonti, lo indica come **adattamento tecnico consigliato** o **proposta aggiuntiva**.

## 1. Executive summary

Quizzettone è già giocabile, ma il flusso attuale è rigido e poggia su operazioni Firebase che possono fallire senza feedback, su un unico stato poco strutturato e su alcune vulnerabilità semplici da correggere.  
La direzione scelta è conservare il formato “due qualificazioni più finale”, trasformandolo in una partita configurabile, con punteggio dinamico, nuove modalità di risposta e controllo completo dell’admin.  
Prima delle nuove meccaniche devono essere sistemati ambiente di prova, XSS, errori di connessione, invii atomici e modello dello stato; l’autenticazione completa resta differita, ma le regole Firebase devono essere verificate subito.  
Gli arcade entreranno tutti nel backlog e verranno sviluppati uno alla volta soltanto dopo che il nucleo della partita sarà stabile e collaudato dal vivo.

## 2. Fondamenta tecniche da sistemare prima

### 2.1 Interventi che costituiscono il gate iniziale

| ID | Fondamenta | Intervento operativo | Criterio di completamento | Funzioni che dipendono da questo intervento | Fonte |
|---|---|---|---|---|---|
| FT-01 | Ambiente di prova separato | Creare un secondo progetto Firebase per sviluppo e collaudo, con configurazione distinta da quella di produzione. Eseguire prove, reset e migrazioni soltanto sul progetto di test. | Un reset di test non può modificare squadre, domande o partite reali. | Tutte le fasi successive, modalità prova, migrazione del modello dati. | RIEPILOGO, “Database di test e partita coincidenti” e Roadmap 1; BRAINSTORMING §12/QZ-15. |
| FT-02 | Regole Firebase conosciute e versionate | Controllare le regole effettive di Realtime Database e Storage, esportarle nel repository e documentare i percorsi leggibili e scrivibili. Per ora si mantiene l’accesso attuale; l’autorizzazione reale viene pianificata come seconda fase. | Le regole presenti in console coincidono con i file versionati; non ci sono dubbi su chi possa scrivere ciascun ramo. | Sicurezza dei dati, affidabilità degli errori, futura autenticazione. | AUDIT §2.2 e finding #2; RIEPILOGO “Regole Firebase e PIN admin”. |
| FT-03 | Eliminazione XSS | Applicare escaping sistematico a nomi delle squadre e a qualsiasi altro testo proveniente dagli utenti prima di inserirlo nell’HTML. Preferire `textContent` quando non serve markup. | Nomi contenenti tag, virgolette o script vengono mostrati come testo innocuo in Team, Admin e Display. | Lobby, classifica, spettatori, albo d’oro. | AUDIT finding #1; RIEPILOGO “XSS nei nomi delle squadre”; BRAINSTORMING P0-01. |
| FT-04 | Avvio e connessione comprensibili | Aggiungere stato iniziale di caricamento, timeout, messaggio di errore, indicatore online/offline e comando di retry. | Se il primo snapshot non arriva, nessuna vista resta bianca e l’utente sa come reagire. | Tutte le viste. | AUDIT finding #4; RIEPILOGO “Schermata bianca all’avvio”; BRAINSTORMING P0-03. |
| FT-05 | Errori Firebase gestiti | Fare restituire esiti espliciti alle operazioni `safeGet`, `safeSet` e `safeDelete`; mostrare “invio in corso”, successo, errore e retry nei flussi essenziali. Non avanzare l’interfaccia se una scrittura fallisce. | Join, risposta, cambio fase, correzione punti e reset non possono apparire riusciti se Firebase li ha rifiutati. | Lobby, risposte, regia, undo. | AUDIT §2.3 e finding #12; RIEPILOGO “Errori Firebase silenziosi”. |
| FT-06 | Invio atomico delle risposte | Sostituire il read-then-write con una transazione Firebase; disabilitare il pulsante dopo la conferma e riattivarlo soltanto in caso di fallimento. | Due tocchi ravvicinati non possono creare o sostituire due risposte; la prima conferma valida resta quella ufficiale quando la domanda usa il blocco immediato. | Bonus per ordine di risposta, finale, spareggi, statistiche di velocità. | AUDIT finding #5; RIEPILOGO “Doppio invio”; BRAINSTORMING P0-05. |
| FT-07 | Identità e presenza della squadra | Associare il dispositivo a un identificativo persistente, registrare `online`, ultimo contatto e riconnessione; usare `onDisconnect` senza cancellare squadra o punteggio. | Dopo refresh o perdita di rete la squadra recupera identità, domanda e stato; l’admin vede offline e ultimo contatto. | Lobby, ingresso tardivo, timer, conteggio delle risposte. | AUDIT finding #3; RIEPILOGO “Presenza online”; BRAINSTORMING §§5–6; REGOLAMENTO §14.2. |
| FT-08 | Unicità e gestione dei nomi | Impedire la creazione concorrente di due squadre con lo stesso nome tramite indice normalizzato o transazione; consentire rinomina e risoluzione manuale da Admin. | Due join simultanei con lo stesso nome non generano squadre gemelle. | Lobby, albo d’oro, riconnessione. | AUDIT finding #6; BRAINSTORMING §5. |
| FT-09 | Stato partita strutturato | Separare configurazione, stato operativo, squadre, istanze delle domande, risposte, punteggi ed eventi. Evitare di aggiungere altre chiavi a prefisso nello stesso nodo piatto. | Ogni fase legge e scrive un ramo chiaro; una nuova tipologia di domanda non richiede condizioni sparse in tutto il file. | Tutte le nuove meccaniche. | AUDIT §§2.1–2.2; BRAINSTORMING §§3–4 e dipendenze 95–99. |
| FT-10 | Snapshot della configurazione | Quando una domanda viene aperta, salvare nell’istanza la configurazione effettiva di timer, punteggio, classifica e politica di risposta. Le modifiche successive dell’admin valgono soltanto per il futuro. | Ricalcolare una domanda produce sempre lo stesso risultato; cambiare regole non altera retroattivamente punti già assegnati. | Regole modificabili dopo lo start, scoring per domanda, undo e statistiche. | BRAINSTORMING §§4, 11 e domanda aperta sulle modifiche; REGOLAMENTO §§7.4 e 14.5. |
| FT-11 | Tempo autorevole condiviso | Registrare apertura e ricezione con timestamp server e usare l’offset server per il conto alla rovescia visuale. Il timer non deve dipendere dall’orologio del telefono. | Admin, Display e Team convergono sullo stesso istante di chiusura; la riconnessione recupera il tempo residuo corretto. | Bonus d’ordine, timer, spareggi veloci. | REGOLAMENTO §14.1; BRAINSTORMING §6/QZ-04–QZ-07. |
| FT-12 | Checkpoint non hardcoded | Eliminare il valore `8` dal testo e calcolare domande giocate e checkpoint dalla configurazione effettiva. | Qualunque numero di domande produce testi e passaggi coerenti. | Manche configurabili e preset. | AUDIT finding #8; RIEPILOGO “Numero 8 hardcoded”; BRAINSTORMING P0-06. |

### 2.2 Modello dati concettuale consigliato

Non è necessario adottare esattamente questi nomi, ma le responsabilità devono essere separate. È un adattamento tecnico derivato dalla struttura fragile descritta nell’AUDIT e dalle dipendenze del BRAINSTORMING.

| Ramo concettuale | Contenuto | Nota operativa |
|---|---|---|
| `sessions/{sessionId}/config` | Regole correnti della partita e numero di versione. | Modificabile dall’admin; ogni variazione incrementa la versione e vale in avanti. |
| `sessions/{sessionId}/runtime` | Fase, manche, domanda corrente, apertura/chiusura, pausa, finalisti e spareggio. | Fonte unica dello stato operativo. |
| `sessions/{sessionId}/teams` | Nome, proprietario del dispositivo, presenza, ingresso, stato Pronta e qualificazione. | Non contiene le risposte. |
| `sessions/{sessionId}/questionInstances` | Domande effettivamente estratte con snapshot di timer, scoring e politica di risposta. | Evita che la modifica della banca cambi una domanda già giocata. |
| `sessions/{sessionId}/answers` | Una risposta per squadra e istanza, timestamp server, stato e revisione admin. | Scrittura atomica e limitata al flusso della domanda. |
| `sessions/{sessionId}/scoreLedger` | Eventi di punteggio calcolati, correzioni manuali e motivazioni. | Preferibile a un totale mutato senza spiegazione; facilita undo e statistiche. |
| `sessions/{sessionId}/events` | Apertura, pausa, variazioni timer/regole, chiusura, annullamento, rimozioni e reveal. | Registro leggero, non un sistema enterprise di event sourcing. |
| `questionBank` | Domande, media, categorie, alias, difficoltà e storico utilizzi. | Ascoltato soltanto da Admin, non da tutti i Team. |
| `hallOfFame` | Risultati finali essenziali delle serate concluse. | Conservazione limitata ai dati scelti nella sezione 8. |

### 2.3 Interventi tecnici da fare senza una riscrittura generale

- Separare progressivamente i listener: Team riceve stato corrente, propria risposta e dati necessari; Display riceve stato pubblico; Admin riceve anche banca domande e regia. Non serve riscrivere tutto in una sola volta. **Fonte:** AUDIT §2.2/§2.4; RIEPILOGO “Listener sull’intero database”.
- Estrarre in funzioni condivise soltanto i blocchi Team/Display che verranno modificati durante il nuovo flusso, in particolare checkpoint, spareggi e classifica. **Fonte:** AUDIT finding #9; RIEPILOGO, priorità bassa alla duplicazione.
- Mantenere la pipeline di scoring centralizzata, che è già un punto di forza, sostituendone l’interno con profili e snapshot configurabili. **Fonte:** AUDIT, Executive summary e §3.2.
- Aggiungere test minimi per formule di punteggio, parità, transizioni principali e modifiche prospettiche. Non è necessario introdurre una pipeline complessa: bastano test ripetibili sulle funzioni pure e una checklist di prova live. **Fonte:** AUDIT §2.5; RIEPILOGO Roadmap 6–7.
- Validare dimensione e tipo di audio, immagini e video e precaricare il contenuto della domanda successiva. **Fonte:** AUDIT finding #10; BRAINSTORMING §§11–12.
- Rendere responsive le tabelle Admin con contenitori scorrevoli e colonne prioritarie. **Fonte:** AUDIT finding #11; RIEPILOGO tabella delle priorità.

### 2.4 Scelta consapevole sull’autenticazione

Per la prima fase non verrà introdotto un vero account Admin. Il PIN rimane una barriera contro pressioni accidentali, non una protezione di sicurezza. Rimangono comunque obbligatori la verifica delle regole, la correzione XSS, la gestione degli errori e la separazione dell’ambiente di test.

L’autenticazione reale passa alla seconda fase: account Firebase per l’admin, utenti anonimi associati alle squadre e regole per proprietario/percorso. Se la verifica iniziale mostrasse regole globalmente pubbliche e il link fosse condiviso fuori dal gruppo fidato, questo intervento dovrà tornare immediatamente tra i prerequisiti P0. **Fonte:** AUDIT finding #2 e PIN Admin; RIEPILOGO “Regole Firebase e PIN admin”.

## 3. Nuove tipologie di domanda da implementare

### 3.1 Contratto comune della domanda

Prima di aggiungere nuove interfacce, ogni domanda deve poter dichiarare almeno:

- testo e categoria;
- tipo di contenuto: testo, immagine, audio o video;
- tipo di risposta: scelta, vero/falso, ordinamento, numero o testo libero;
- soluzione, eventuali alias e tolleranza;
- timer consigliato e regola di avvio;
- profilo di punteggio e override della singola domanda;
- politica di risposta: definitiva o modificabile;
- difficoltà, stato di validazione e storico di utilizzo;
- file multimediali con metadati, dimensione e disponibilità.

La configurazione della partita fornisce i valori predefiniti; manche e singola domanda possono sovrascriverli. La precedenza è: **domanda → manche → partita → preset di sistema**. **Fonte:** BRAINSTORMING §§4, 6 e 12; REGOLAMENTO §§3, 8–9 e 14.

### 3.2 Scelta multipla testuale

**Meccanica.** Domanda con 3–5 alternative, una risposta corretta e conferma della scelta. Lo standard resta quattro opzioni.

**Adattamento per Quizzettone.** È l’evoluzione del flusso attuale: deve usare il nuovo contratto, la risposta atomica, la politica definitiva/modificabile e il punteggio dinamico. L’ordine delle alternative resta uguale per tutti per rendere comprensibile il Display condiviso.

**Complessità:** bassa.  
**Dipendenze:** FT-05, FT-06, FT-09, FT-10 e nuovo scoring.  
**Fonte:** REGOLAMENTO §9.1; AUDIT §3.1–§3.2.

### 3.3 Vero o falso

**Meccanica.** Due alternative, timer più breve e possibilità di aumentare la penalità perché la probabilità casuale è del 50%.

**Adattamento per Quizzettone.** Non richiede un motore separato: è una scelta multipla con due opzioni e preset dedicato. Il malus più alto è un override visibile, non una correzione nascosta.

**Complessità:** bassa.  
**Dipendenze:** scelta multipla e override per domanda.  
**Fonte:** REGOLAMENTO §9.7 e §6.4.

### 3.4 Domanda fotografica

**Meccanica.** Riconoscimento di persona, luogo, logo, oggetto, film o dettaglio; risposta tramite uno dei motori supportati.

**Adattamento per Quizzettone.** Aggiungere caricamento/URL immagine, anteprima Admin, fallback se il file manca e modalità di adattamento al Display senza tagli importanti. Il timer indicativo è 30–45 secondi, ma rimane configurabile.

**Complessità:** media.  
**Dipendenze:** validazione media, precaricamento e controllo pre-partita.  
**Fonte:** REGOLAMENTO §9.2; BRAINSTORMING §§6 e 12.

### 3.5 Domanda audio

**Meccanica.** Riconoscere titolo, artista, voce, colonna sonora, strumento o effetto.

**Adattamento per Quizzettone.** Consolidare la funzione audio già presente: controllo dimensione/formato, anteprima, stato di caricamento, riproduzione sincronizzata su Display/Admin e fallback. Il timer parte con la comparsa della domanda come impostazione standard; la domanda può impostare una finestra più lunga o un avvio diverso.

**Complessità:** media, perché esiste già una base parziale.  
**Dipendenze:** FT-11, validazione file, controlli qualità e gestione errori.  
**Fonte:** AUDIT §2.4; REGOLAMENTO §9.3; BRAINSTORMING §§6, 11 e 12.

### 3.6 Domanda video

**Meccanica.** Scena, evento sportivo, pubblicità, videoclip o filmato interrotto prima della soluzione.

**Adattamento per Quizzettone.** Supportare URL o file compatibili, poster di caricamento, controllo della riproduzione, modalità silenziosa/sonora e fallback. Per non appesantire Firebase e i telefoni, il video non deve transitare nel nodo realtime: nel database restano soltanto metadati e URL.

**Complessità:** medio-alta.  
**Dipendenze:** nuovo schema, validazione media, precaricamento, timer condiviso.  
**Fonte:** REGOLAMENTO §9.4; BRAINSTORMING §§4, 6 e 12.

### 3.7 Logica

**Meccanica.** Sequenze, analogie, deduzioni, figure mancanti, calcoli e relazioni.

**Adattamento per Quizzettone.** “Logica” è soprattutto una famiglia di contenuti: può usare scelta multipla, numero, ordinamento o immagine. Deve poter impostare 45–60 secondi e, se necessario, avvio manuale del timer.

**Complessità:** bassa per il motore, variabile per i contenuti.  
**Dipendenze:** motori di risposta già disponibili e timer per domanda.  
**Fonte:** REGOLAMENTO §9.5; BRAINSTORMING §6.

### 3.8 Ordinamento

**Meccanica.** Disporre elementi per cronologia, grandezza, posizione geografica, durata o classifica.

**Adattamento per Quizzettone.** Interfaccia mobile con trascinamento e alternativa accessibile tramite pulsanti su/giù. Nella prima implementazione la risposta è corretta soltanto se l’ordine è interamente esatto. Un credito parziale, ricavato dalla meccanica Top 10 del REGOLAMENTO, resta un’opzione avanzata da attivare esplicitamente.

**Complessità:** medio-alta.  
**Dipendenze:** nuovo motore di risposta, serializzazione dell’ordine, editor Admin e test mobile.  
**Fonte:** REGOLAMENTO §9.6 e, per l’eventuale credito parziale, §10.4.

### 3.9 Stima numerica

**Meccanica.** Inserimento di un numero; punteggio basato su valore esatto, tolleranza o errore percentuale. È anche il metodo di chiusura dello spareggio di qualificazione.

**Adattamento per Quizzettone.** Campo numerico localizzato, unità mostrata chiaramente, valori min/max e gestione di decimali. Modalità disponibili: corretta entro tolleranza, fasce di errore percentuale o solo “più vicino” per spareggio. In caso di uguale distanza nello spareggio prevale la ricezione server più rapida; se persiste la parità si usa una seconda stima.

**Complessità:** media.  
**Dipendenze:** timestamp server, scoring per tipo e stato di spareggio.  
**Fonte:** REGOLAMENTO §§8.7, 9.8 e 14.4; BRAINSTORMING §9.

### 3.10 Risposta testuale libera

**Meccanica.** La squadra digita una parola o frase e la conferma. Il testo rimane modificabile prima della conferma; dopo segue la politica di risposta scelta per la domanda.

**Adattamento per Quizzettone.** La correzione è ibrida:

1. normalizzazione di maiuscole/minuscole, spazi, apostrofi, punteggiatura e accenti secondo regole documentate;
2. confronto con risposta principale e alias preparati dall’admin;
3. accettazione automatica soltanto delle corrispondenze normalizzate sicure;
4. risposte non riconosciute poste in stato “Da revisionare”;
5. approvazione o rifiuto manuale dell’admin, con applicazione coerente a risposte equivalenti.

Il fuzzy matching può suggerire all’admin possibili equivalenze, ma non deve assegnare automaticamente punti a risposte semanticamente dubbie.

**Complessità:** alta.  
**Dipendenze:** editor degli alias, coda di revisione Admin, ledger dei punteggi, XSS e normalizzazione testuale.  
**Fonte:** BRAINSTORMING §§6, 11 e domanda aperta 105; REGOLAMENTO §§10.11–10.13 per prove testuali e a indizi.

## 4. Meccaniche di gioco da introdurre o modificare

### 4.1 Formato della partita e preset

Il formato predefinito conserva l’identità attuale del progetto, pur rendendo ogni valore modificabile.

| Preset | Struttura iniziale | Regola della finale | Stato nel piano | Fonte |
|---|---|---|---|---|
| **Serata classica** | 2 manche di qualificazione da 15 domande, 2 finalisti predefiniti ma numero variabile, finale da 10. | Finale a eliminazione: punti azzerati e nessun vantaggio di default. | Preset principale della prima release. | BRAINSTORMING §§3–4; AUDIT §3.1. |
| **Partita rapida** | 1 manche da 10, 2 finalisti, finale da 5. | Stesse opzioni della finale classica. | Preset secondario della prima release. | BRAINSTORMING §4. |
| **Tutti contro tutti** | Numero di manche configurabile; nessuna squadra eliminata nell’ultima manche. | Mantenimento dei punti predefinito; reset o vantaggi selezionabili. | Preset della prima release, dopo il nucleo classico. | BRAINSTORMING §4; REGOLAMENTO §§8 e 12. |
| **Personalizzata** | Tutti i parametri modificabili. | Azzeramento, mantenimento o vantaggio configurato. | Necessaria. | BRAINSTORMING §4. |
| **Torneo lungo** | 3 manche, 4 finalisti, semifinale e finale. | Da progettare separatamente. | Non incluso nella prima versione. | BRAINSTORMING §§4 e 19, risposta 109. |

La Sala pre-partita deve configurare nome, manche, numero di domande, finalisti, domande finali, timer, profili di punteggio, categorie, spareggi, ingresso tardivo, checkpoint, visibilità spettatori e comportamento dei punti in finale. Lo start mostra un riepilogo e salva la prima versione della configurazione.

### 4.2 Punteggio dinamico predefinito

Il punteggio è configurabile a livello di partita, manche e domanda. Il profilo dinamico è predefinito; restano disponibili un profilo classico `+1/0/0` e un profilo personalizzato.

#### Classifica congelata prima della domanda

Prima di aprire la domanda il sistema salva:

- posizione consolidata di ogni squadra;
- fascia di rischio e bonus rimonta;
- tabella del bonus d’ordine;
- valore base, penalità, astensione e moltiplicatori;
- politica di risposta e timer.

Questi valori non cambiano durante la raccolta delle risposte. **Fonte:** REGOLAMENTO §7.4.

#### Risposta corretta

Formula iniziale:

```text
punti_corretti =
valore_base
+ valore_base × bonus_ordine
+ valore_base × bonus_rimonta
```

Valore base consigliato: `1.000`, modificabile.

Il bonus velocità usa l’**ordine delle sole risposte corrette**, non i secondi trascorsi. È un adattamento deliberato rispetto al decadimento temporale del REGOLAMENTO, scelto per rendere immediatamente visibile la competizione tra squadre.

| Ordine tra le risposte corrette | Bonus predefinito | Configurabilità |
|---:|---:|---|
| 1ª | +25% | Modificabile per partita o domanda. |
| 2ª | +20% | Modificabile. |
| 3ª | +15% | Modificabile. |
| 4ª | +10% | Modificabile. |
| 5ª | +5% | Modificabile. |
| Dalla 6ª | 0% | È possibile estendere la tabella. |

Le risposte sbagliate non occupano posizioni. Se due risposte corrette hanno lo stesso timestamp server, ricevono lo stesso bonus e si applica la numerazione competitiva: due prime a pari tempo sono seguite dalla terza posizione.

#### Penalità adattiva e bonus rimonta

Formula iniziale dell’errore:

```text
penalita =
valore_base × aliquota_errore × moltiplicatore_posizione
```

Aliquota di errore consigliata: `20%` del valore base, modificabile.

| Fascia prima della domanda | Moltiplicatore errore consigliato | Bonus rimonta sulla corretta |
|---|---:|---:|
| Prime 10% | ×2,00 | 0% |
| 11–25% | ×1,75 | 0% |
| 26–50% | ×1,40 | +2% |
| 51–75% | ×1,10 | +5% |
| Ultime 25% | ×0,70 | +8% |

Con domanda da 1.000 punti e aliquota del 20%, una squadra nella prima fascia perde 400 punti, mentre una nell’ultima ne perde 140: il leader rischia circa 2,86 volte più dell’ultima squadra. Soglie, moltiplicatori e bonus sono modificabili nella configurazione avanzata.

Questo risolve l’obiettivo di equilibrio senza rendere identico il premio per prestazioni diverse: la squadra in fondo può recuperare, ma deve comunque rispondere correttamente e competere nell’ordine di arrivo. **Fonte:** REGOLAMENTO §§4–5 e 16; BRAINSTORMING §10/QZ-17–QZ-18.

#### Astensione e risposta modificabile

- Astensione standard: `0` punti.
- Una manche o domanda può introdurre una penalità annunciata per la mancata risposta.
- Politica standard: primo invio confermato definitivo.
- Politica alternativa: risposta modificabile fino alla chiusura; in questo caso l’ordine ufficiale usa il timestamp dell’ultima conferma.

**Fonte:** REGOLAMENTO §§6 e 14.3; BRAINSTORMING §§4, 6 e 10.

#### Trasparenza verso i giocatori

Prima della partita devono essere mostrati in forma semplice:

- valore base;
- bonus assegnato alle prime risposte corrette;
- penalità dell’errore;
- bonus rimonta;
- comportamento dell’astensione;
- eventuale domanda con regole speciali.

Durante la domanda può apparire un indicatore sintetico personale, per esempio `Rischio errore ×1,75` e `Bonus rimonta +5%`. **Fonte:** REGOLAMENTO §§14.5 e 15.

### 4.3 Punti e vantaggi entrando in finale

Sono disponibili tre modalità:

1. **Azzera:** tutti i finalisti partono da zero;
2. **Mantieni:** i punteggi di qualificazione continuano;
3. **Vantaggio per piazzamento:** l’admin configura un credito iniziale per le posizioni di qualificazione.

Per la finale a eliminazione lo standard è **Azzera**, senza vantaggi. Se viene selezionata la modalità vantaggio, una scala iniziale suggerita è `+30%`, `+20%`, `+10%` del valore base di una domanda per le prime tre posizioni, ma l’intera tabella è configurabile.

Per la finale senza eliminati lo standard è **Mantieni**; l’admin può comunque scegliere reset o vantaggi. **Fonte:** BRAINSTORMING §§4, 10 e risposta alla domanda 101; REGOLAMENTO §§8 e 12.

### 4.4 Spareggi coerenti

#### Accesso alla finale

1. Partecipano soltanto le squadre in parità per i posti necessari.
2. Si giocano tre domande con il profilo di punteggio selezionato per lo spareggio.
3. Se la parità rimane, si gioca una stima numerica.
4. Vince chi è più vicino; a uguale distanza prevale il timestamp server più rapido.
5. Se la parità persiste, si propone una seconda stima.

#### Pareggio conclusivo

Spareggio a oltranza:

- con due squadre, una sola corretta chiude la partita; se entrambe sono corrette o entrambe sbagliano, si continua;
- con più squadre ancora in parità, continuano quelle corrette; se nessuna è corretta si ripete; quando ne rimane una, vince;
- l’admin può annullare una domanda ambigua senza assegnare punti.

Questa meccanica sostituisce la dichiarazione manuale arbitraria del vincitore presente nel codice. **Fonte:** AUDIT finding #7; RIEPILOGO “Pareggio nella finale”; BRAINSTORMING §9/QZ-11; REGOLAMENTO §§8.7 e 14.4.

### 4.5 Ingresso tardivo

La regola è configurabile pre-partita:

- sempre consentito;
- consentito fino alla fine della prima manche;
- bloccato dopo lo start.

L’impostazione predefinita è **fino alla fine della prima manche**. La nuova squadra:

- parte da zero;
- viene marcata come ingresso tardivo;
- partecipa dalla domanda successiva, non da quella già aperta;
- non recupera domande precedenti;
- non entra retroattivamente in finali o spareggi già determinati.

**Fonte:** AUDIT §3.3; RIEPILOGO “Ingresso tardivo”; BRAINSTORMING §5/QZ-03.

### 4.6 Timer sincronizzato e controllabile

Impostazioni disponibili:

- 10, 15, 20, 30, 45, 60 secondi;
- durata personalizzata;
- nessun timer;
- timer per manche e per domanda;
- avvio con la comparsa della domanda come standard;
- avvio manuale o differito come override.

Comandi live:

- pausa e ripresa dallo stesso residuo;
- `+5` e `-5` secondi;
- chiusura immediata;
- riapertura controllata;
- annullamento della domanda.

Durante la pausa le nuove risposte sono bloccate. Aggiungere tempo non riapre automaticamente una domanda già chiusa. Ogni comando è scritto nello stato condiviso e nel registro eventi. **Fonte:** BRAINSTORMING §6/QZ-04–QZ-07; REGOLAMENTO §§8–9 e 14.1.

### 4.7 Ciclo della risposta

Ogni squadra attraversa stati espliciti:

```text
non iniziata → compilazione → invio in corso → bloccata
                                      ↘ errore/retry
```

Per il testo libero può seguire `da revisionare → accettata/rifiutata`. Per la politica modificabile, `bloccata` arriva alla chiusura o alla conferma definitiva. Admin e Display non devono mostrare il contenuto delle risposte durante la fase protetta; mostrano soltanto conteggi e stati.

**Fonte:** RIEPILOGO “Errori Firebase silenziosi” e “Doppio invio”; BRAINSTORMING §§8 e 11.

### 4.8 Classifica, checkpoint e reveal

- Checkpoint configurabili, con reveal completo almeno dopo ogni manche.
- Possibilità per l’admin di mostrare una classifica integrale o avviare il reveal in qualsiasi momento.
- Ordine calcolato automaticamente dall’ultima posizione; l’admin può avanzare manualmente, usare autoplay, mettere in pausa o saltare alla classifica completa.
- Pari merito rivelati insieme, senza ordine artificiale.
- Rallentamento vicino alla zona di qualificazione e animazioni separate per finalisti, podio e vincitore.
- Classifica eventualmente nascosta nelle ultime domande, come opzione annunciata.
- Dopo una domanda possono essere mostrati soluzione, percentuale corretta, prime risposte corrette, punti guadagnati/persi e movimento di posizione senza mostrare sempre tutta la classifica.

**Fonte:** BRAINSTORMING §7/QZ-08–QZ-09; REGOLAMENTO §7; AUDIT §3.1 punto 9.

### 4.9 Regole modificabili durante la partita

L’admin può modificare anche dopo lo start timer, punteggi, numero di manche, finalisti, regola della finale, ingresso e altre impostazioni. Per evitare incoerenze:

- ogni modifica è validata;
- viene mostrata un’anteprima dell’effetto operativo;
- le modifiche strutturali richiedono conferma;
- nessuna modifica ricalcola domande già concluse;
- le nuove regole si applicano dalla successiva domanda non aperta o dalla successiva fase compatibile;
- la configurazione usata da ciascuna domanda rimane nel suo snapshot;
- operazioni impossibili, come impostare più finalisti delle squadre disponibili, sono rifiutate con spiegazione.

**Fonte:** BRAINSTORMING §§4, 11 e domanda aperta sulle regole dopo lo start; REGOLAMENTO §14.5.

### 4.10 Undo minimo e registro Admin

Prima versione:

- annulla l’ultima correzione manuale di punteggio;
- ripristina una squadra rimossa tramite rimozione logica, non cancellazione immediata;
- conferma obbligatoria per reset, annullamento domanda e avanzamenti decisivi;
- registra apertura/chiusura, timer, regole modificate, correzioni, rimozioni, annullamenti e reveal.

Non è previsto il rollback generale di una fase già vista dai giocatori. **Fonte:** BRAINSTORMING §11/QZ-14; RIEPILOGO “Recupero dagli errori”.

### 4.11 Sala pre-partita e lobby

La stessa schermata può unire configurazione e lobby. Deve mostrare:

- codice breve e QR code;
- nome, online/offline, ultimo contatto e orario d’ingresso;
- numero di dispositivi collegati;
- stato Pronta;
- indicatore di ingresso tardivo;
- rinomina, rimozione, blocco e aggiunta manuale;
- chiusura/riapertura iscrizioni;
- quantità e qualità delle domande disponibili;
- regole correnti e riepilogo prima dello start.

**Fonte:** BRAINSTORMING §§3–5/QZ-01–QZ-03; REGOLAMENTO §8.1.

### 4.12 Finale e modalità spettatore

La modalità predefinita è **Diretta protetta**:

- gli eliminati vedono finalisti e stato “sta pensando”, “bloccata” o “tempo scaduto”;
- le risposte diventano visibili soltanto quando tutti i finalisti hanno bloccato oppure il timer è scaduto;
- corretto/sbagliato appare dopo il reveal dell’admin;
- il punteggio della finale si aggiorna dopo l’assegnazione;
- il Display pubblico non rivela risposte prima del momento protetto.

Pronostici, voto del vincitore, classifica del pubblico e “Campione del pubblico” restano moduli opzionali successivi e non influenzano il punteggio ufficiale. **Fonte:** BRAINSTORMING §8/QZ-10; REGOLAMENTO §14.5 sulla trasparenza e prevenzione degli abusi.

### 4.13 Pannello di regia

Ordine visivo consigliato:

1. domanda corrente e anteprima della prossima;
2. timer e stato apertura/chiusura;
3. risposte ricevute, mancanti, in revisione e squadre offline;
4. azione successiva raccomandata;
5. scoring della domanda e rischio per fascia;
6. audio/media e Display;
7. classifica, checkpoint e finale;
8. correzioni, undo e storico.

Le impostazioni avanzate devono restare richiudibili per non trasformare la regia in un pannello sovraccarico. **Fonte:** BRAINSTORMING §§2 e 11; RIEPILOGO, criterio anti-over-engineering.

### 4.14 Modalità prova, controlli e statistiche

Modalità prova:

- usa il progetto Firebase di test;
- crea squadre fittizie;
- prova domande, media, timer, punteggio, classifica, finale e spareggi;
- non alimenta albo d’oro o statistiche reali.

Controlli pre-start:

- soluzione mancante;
- alias o tolleranze non validi;
- media assenti o troppo grandi;
- categorie vuote;
- duplicati/domande già usate;
- quantità insufficiente per il preset;
- comportamento di finale e spareggio non definito.

Riepilogo finale:

- podio e punteggi;
- percentuale corretta per squadra;
- domanda più facile/difficile;
- squadra mediamente più rapida nell’ordine delle corrette;
- miglior rimonta;
- esiti di finale e spareggi;
- rivincita con configurazione e squadre;
- salvataggio essenziale nell’albo d’oro.

**Fonte:** BRAINSTORMING §§12–13/QZ-15–QZ-16; RIEPILOGO checklist di collaudo.

### 4.15 Giochi secondari da mantenere nel backlog

Tutti gli arcade del REGOLAMENTO entrano nel backlog, ma non nella prima release. La colonna “solidità della fonte” distingue le meccaniche documentate da ricostruzioni progettuali del documento di riferimento.

| Arcade | Meccanica da conservare | Adattamento per Quizzettone | Complessità | Onda suggerita | Fonte |
|---|---|---|---|---|---|
| Photopuzzle | Tasselli rimossi progressivamente; più copertura residua, più punti. | Motore immagine a livelli, invio singolo e punteggio legato allo stato del puzzle. | Alta | P5-A | REGOLAMENTO §10.1, meccanica documentata. |
| Memory | Memorizzazione di coppie, caselle coperte e valore decrescente con la facilità. | Griglia sincronizzata, fasi di osservazione/risposta e serie di prove. | Molto alta | P5-B | REGOLAMENTO §10.2, meccanica e intervalli documentati. |
| Indovina chi | Otto personaggi, cinque indizi progressivi, premio maggiore rispondendo prima. | Motore a indizi, esclusione progressiva e tentativo singolo/configurabile. | Alta | P5-A | REGOLAMENTO §10.3, meccanica documentata. |
| Top 10 | Individuazione del primo o ricostruzione/scala della classifica. | Riutilizzare il motore Ordinamento; tenere le tre varianti separate. | Media-alta | P5-C | REGOLAMENTO §10.4, meccanica documentata; non prioritaria ora. |
| Catena di parole | Parola che collega logicamente due termini, con indizi progressivi. | Risposta testuale con alias e livelli di suggerimento. | Media | P5-B | REGOLAMENTO §10.5, gioco elencato e implementazione ricostruita. |
| Sbaglia & Vinci | Selezionare intenzionalmente la risposta conforme a una regola invertita. | Variante della scelta multipla con istruzione molto visibile e preset di scoring. | Bassa-media | P5-A | REGOLAMENTO §10.6, formula ricostruita. |
| Numeri e cerchi | Memorizzare numero, posizione, colore o sequenza. | Motore visuale a fasi con domanda finale scelta/numero. | Alta | P5-B | REGOLAMENTO §10.7, meccanica ricostruita. |
| Corsa dei cavalli | Risposte corrette fanno avanzare; velocità determina movimento. | Visualizzazione della corsa alimentata dall’ordine delle corrette; punteggio finale separato e limitato. | Molto alta | P5-C | REGOLAMENTO §10.8, meccanica ricostruita. |
| Car Racing | Gara con accelerazione, turbo e ostacoli limitati. | Riutilizzare il motore corsa; casualità non oltre il 10–15% dell’esito. | Molto alta | P5-C | REGOLAMENTO §10.9, proposta progettuale. |
| Alta o bassa | Prevedere se il valore successivo è maggiore/minore; possibile serie “rischia o incassa”. | Motore a serie con premio accumulato e stop volontario. | Media | P5-B | REGOLAMENTO §10.10. |
| Ghigliottina | Una parola collega cinque indizi. | Risposta testuale, indizi progressivi e valore decrescente. | Media | P5-B | REGOLAMENTO §10.11. |
| Frase misteriosa | Lettere rivelate, tentativi e punteggio decrescente. | Stato condiviso della frase, reveal progressivo e blocchi temporanei. | Alta | P5-C | REGOLAMENTO §10.12. |
| Music Box/Crazy Radio | Titolo, artista, anno, brano alterato o sovrapposto. | Estensione dell’audio già consolidato; livelli temporali e tentativo singolo. | Media | P5-A | REGOLAMENTO §10.13. |
| Roulette | La ruota seleziona categoria, valore o rischio; la risposta determina l’esito. | Animazione separata dalla logica, risultato della ruota salvato prima della domanda. | Media | P5-B | REGOLAMENTO §10.14, proposta progettuale. |
| Calci di rigore | Sfida fra due squadre con tiro/portiere e domande. | Stato testa-a-testa riutilizzabile anche come spareggio speciale. | Molto alta | P5-C | REGOLAMENTO §10.15. |
| Cervelluzzle/Ruzzle | Griglia di lettere, parole adiacenti e punteggio per lunghezza/unicità. | Validazione dizionario, invii multipli e deduplicazione tra squadre. | Molto alta | P5-C | REGOLAMENTO §10.16. |

Il peso complessivo di un arcade deve restare tra il 15% e il 35% di una manche tradizionale, salvo scelta esplicita dell’admin. **Fonte:** REGOLAMENTO §11.

### 4.16 Poteri strategici opzionali

Raddoppio, Scudo, 50:50, Tempo extra, Cambio risposta e Recupero restano backlog P5. Non sono regole universali documentate di Cervellone/Dr.Why e devono essere presentati come moduli opzionali, visibili prima della partita. La prima sperimentazione dovrebbe riguardare un solo potere per volta e non precedere il collaudo del punteggio dinamico. **Fonte:** REGOLAMENTO §13; BRAINSTORMING Roadmap P5.

## 5. Idee dal brainstorming: stato e integrazione

| Idea | Stato consolidato | Integrazione nel piano | Conflitto o revisione risolta | Fonte |
|---|---|---|---|---|
| QZ-01 Sala pre-partita configurabile | Approvata | P1, dopo il gate tecnico. | Nessun conflitto; diventa il centro della configurazione versionata. | BRAINSTORMING §§3–4. |
| QZ-02 Lobby con squadre connesse | Approvata | P1/P2 con presenza e riconnessione. | La presenza era ridimensionata dal RIEPILOGO, ma resta necessaria per la lobby desiderata. | BRAINSTORMING §5; AUDIT #3; RIEPILOGO. |
| QZ-03 Ingresso durante la partita | Decisa | Configurabile; default fino a fine prima manche, zero punti, domanda successiva. | Risolta l’assenza di regola nel codice attuale. | BRAINSTORMING §5; AUDIT §3.3. |
| QZ-04–QZ-07 Timer e pausa | Approvate | Timer condiviso, pausa, ±5, animazione congelata. | Richiedono timestamp autorevole e stato centralizzato. | BRAINSTORMING §6; REGOLAMENTO §§8–9 e 14. |
| QZ-08 Classifica automatica dal basso | Approvata | Ordine automatico, avanzamento manuale o autoplay. | “Manuale” riguarda il comando dell’admin, non il calcolo dell’ordine. | BRAINSTORMING §7 e Registro decisioni. |
| QZ-09 Animazioni cambio posizione | Seconda fase | P3, dopo scoring e classifica affidabili. | Nessun conflitto. | BRAINSTORMING §§7 e 16. |
| QZ-10 Risposte finalisti agli eliminati | Approvata | Diretta protetta predefinita. | Risolta la scelta fra segreta, protetta e totale. | BRAINSTORMING §8 e Registro decisioni. |
| QZ-11 Spareggio finale automatico | Approvata e definita | Tre domande + stima in qualificazione; a oltranza in finale. | Corregge l’incoerenza individuata nell’AUDIT. | BRAINSTORMING §9; AUDIT #7. |
| QZ-12 Preset di partita | Approvata | Classica, Rapida, Tutti contro tutti e Personalizzata. | Torneo lungo rinviato. | BRAINSTORMING §§4 e 19. |
| QZ-13 Salvataggio configurazioni | Approvata dopo i preset | Le configurazioni possono essere duplicate e riutilizzate. | Dipende dal nuovo modello dati. | BRAINSTORMING §16. |
| QZ-14 Undo e registro | Approvata in forma minima | Undo punti/rimozione squadra e conferme ad alto impatto. | Evitato un rollback generale sproporzionato. | BRAINSTORMING §11; RIEPILOGO. |
| QZ-15 Modalità prova | Approvata | Usa progetto Firebase separato e dati fittizi. | Rafforzata dal rischio concreto di contaminare produzione. | BRAINSTORMING §12; RIEPILOGO. |
| QZ-16 Statistiche finali | Approvata dopo il nuovo flusso | Riepilogo e albo d’oro essenziale. | I dettagli di conservazione restano aperti. | BRAINSTORMING §§13 e 19. |
| QZ-17 Bonus velocità | Approvata e modificata | Bonus basato sull’ordine delle risposte corrette, con tabella configurabile. | Si discosta dal decadimento temporale del REGOLAMENTO per decisione di design. | BRAINSTORMING §10; REGOLAMENTO §§3 e 16. |
| QZ-18 Rimonta dinamica | Approvata | Bonus corrette fino all’8% e forte differenza delle penalità per posizione. | Passa da “non prioritaria” a parte del profilo dinamico standard. | BRAINSTORMING §10; REGOLAMENTO §§4–5 e 16. |
| Regole modificabili dopo lo start | Approvata | Tutte accessibili all’admin, validate e valide soltanto in avanti. | Risolta la domanda aperta del BRAINSTORMING senza ricalcolo retroattivo. | BRAINSTORMING §§4 e 19. |
| Finale con finalisti variabili | Approvata | Da 2 fino al numero di squadre compatibile con la configurazione. | Richiede UI e spareggio capaci di gestire più di due finalisti. | BRAINSTORMING domanda 100. |
| Autenticazione reale | Rinviata | Seconda fase; immediata soltanto se le regole risultano incompatibili con l’uso sicuro. | Scelta pragmatica per non complicare ora il progetto. | AUDIT #2; RIEPILOGO sicurezza. |
| Rifattorizzazione completa del file unico | Non pianificata | Estrazioni selettive durante le funzionalità. | Segue il RIEPILOGO: nessuna riscrittura senza beneficio concreto. | AUDIT §2.1; RIEPILOGO valutazione generale. |
| Arcade | Backlog completo | Onda P5-A/B/C, uno alla volta. | Non entrano tutti nella prima release. | REGOLAMENTO §10; BRAINSTORMING Roadmap P5. |

## 6. Elenco modifiche prioritizzato

### Legenda

- **P0:** prerequisito prima delle nuove funzioni;
- **P1:** nucleo configurabile e regole fondamentali;
- **P2:** controllo operativo e affidabilità live;
- **P3:** esperienza, presentazione e ottimizzazione;
- **P4:** finale, pubblico e storico;
- **P5-A/B/C:** backlog opzionale, in ordine indicativo di sperimentazione.

Complessità: **XS** poche modifiche circoscritte; **S** piccola; **M** media; **L** alta; **XL** molto alta o nuovo sottosistema.

| # | Modifica | Fonte (audit/brainstorming/regolamento) | Tipo (fix tecnico/nuova meccanica/UX) | Priorità | Complessità | Dipendenze |
|---:|---|---|---|---|---|---|
| 1 | Creare progetto Firebase separato per test | RIEPILOGO Roadmap 1; BRAINSTORMING §12/QZ-15 | Fix tecnico | P0 | S | Accesso console Firebase |
| 2 | Verificare e versionare regole RTDB/Storage | AUDIT #2; RIEPILOGO sicurezza; BRAINSTORMING P0-02 | Fix tecnico | P0 | M | Nessuna |
| 3 | Sanificare tutti gli input utente/XSS | AUDIT #1; RIEPILOGO XSS; BRAINSTORMING P0-01 | Fix tecnico | P0 | S | Inventario dei render |
| 4 | Loading, timeout, errore e retry all’avvio | AUDIT #4; RIEPILOGO schermata bianca; BRAINSTORMING P0-03 | UX/Fix tecnico | P0 | S | Stato connessione |
| 5 | Gestire esiti delle operazioni Firebase critiche | AUDIT #12; RIEPILOGO errori silenziosi | Fix tecnico | P0 | M | Messaggi UI comuni |
| 6 | Rendere atomico l’invio della risposta | AUDIT #5; RIEPILOGO doppio invio; BRAINSTORMING P0-05 | Fix tecnico | P0 | M | Transazioni Firebase |
| 7 | Rendere atomico/univoco il join per nome | AUDIT #6; BRAINSTORMING §5 | Fix tecnico | P0 | M | Identità squadra |
| 8 | Correggere il checkpoint hardcoded | AUDIT #8; RIEPILOGO; BRAINSTORMING P0-06 | Fix tecnico | P0 | XS | Config domande |
| 9 | Aggiungere validazione e limite ai file audio/media | AUDIT #10; BRAINSTORMING §12 | Fix tecnico/UX | P0 | S | Regole Storage |
| 10 | Definire modello dati di sessione strutturato | AUDIT §§2.1–2.2; BRAINSTORMING §§3–4/95–99 | Fix tecnico | P1 | L | P0 completato |
| 11 | Implementare snapshot/versione della configurazione | BRAINSTORMING §§4 e 11; REGOLAMENTO §7.4 | Fix tecnico | P1 | L | #10 |
| 12 | Sala pre-partita configurabile | BRAINSTORMING QZ-01 | UX/Nuova meccanica | P1 | L | #10–11 |
| 13 | Preset Classica, Rapida, Tutti contro tutti e Personalizzata | BRAINSTORMING §4/QZ-12; REGOLAMENTO §§8 e 12 | Nuova meccanica | P1 | M | #12 |
| 14 | Salvataggio e duplicazione preset | BRAINSTORMING QZ-13 | UX/Nuova meccanica | P1 | M | #13 |
| 15 | Contratto comune delle domande | BRAINSTORMING §§4, 6, 12; REGOLAMENTO §9 | Fix tecnico | P1 | L | #10–11 |
| 16 | Scelta multipla sul nuovo contratto | REGOLAMENTO §9.1; AUDIT §3.1 | Nuova meccanica | P1 | M | #15, #6 |
| 17 | Vero/falso con profilo dedicato | REGOLAMENTO §9.7 | Nuova meccanica | P1 | S | #16 |
| 18 | Domanda fotografica | REGOLAMENTO §9.2; BRAINSTORMING §6 | Nuova meccanica | P1 | M | #15, gestione media |
| 19 | Domanda audio consolidata | AUDIT §2.4; REGOLAMENTO §9.3 | Nuova meccanica/UX | P1 | M | #9, #15 |
| 20 | Domanda video | REGOLAMENTO §9.4 | Nuova meccanica | P1 | L | #9, #15, preload |
| 21 | Categoria logica sui motori comuni | REGOLAMENTO §9.5 | Nuova meccanica | P1 | S | #16/#23/#24 |
| 22 | Motore di ordinamento mobile | REGOLAMENTO §9.6 e §10.4 | Nuova meccanica | P1 | L | #15 |
| 23 | Motore di stima numerica | REGOLAMENTO §§8.7 e 9.8; BRAINSTORMING §9 | Nuova meccanica | P1 | M | #15, scoring |
| 24 | Risposta testuale ibrida con alias e revisione | BRAINSTORMING domanda 105; REGOLAMENTO §§10.11–10.13 | Nuova meccanica | P1 | L | #15, ledger, Admin |
| 25 | Motore di scoring a profili e override | AUDIT §3.2; BRAINSTORMING §10; REGOLAMENTO §§3–6 e 16 | Nuova meccanica | P1 | L | #10–11 |
| 26 | Bonus configurabile per ordine delle corrette | BRAINSTORMING QZ-17; REGOLAMENTO §§3 e 16 | Nuova meccanica | P1 | M | #6, timestamp server, #25 |
| 27 | Penalità configurabile per posizione | BRAINSTORMING §10/QZ-18; REGOLAMENTO §§4–5 e 16 | Nuova meccanica | P1 | M | #25, classifica congelata |
| 28 | Bonus rimonta 0–8% configurabile | BRAINSTORMING QZ-18; REGOLAMENTO §§5.3 e 16 | Nuova meccanica | P1 | S | #27 |
| 29 | Profili Classico, Dinamico e Personalizzato | BRAINSTORMING §10; REGOLAMENTO §§3–6 | Nuova meccanica/UX | P1 | M | #25–28 |
| 30 | Modalità finale Azzera/Mantieni/Vantaggio | BRAINSTORMING §§4 e 19; REGOLAMENTO §§8 e 12 | Nuova meccanica | P1 | M | #25, session config |
| 31 | Finalisti in numero variabile | BRAINSTORMING domanda 100 | Nuova meccanica | P1 | M | Layout finale, spareggio |
| 32 | Regole modificabili live con effetto prospettico | BRAINSTORMING §§4 e 11; REGOLAMENTO §14.5 | Nuova meccanica/Fix tecnico | P1 | L | #11, registro eventi |
| 33 | Spareggio qualificazione: 3 domande + stima | BRAINSTORMING §9; REGOLAMENTO §§8.7 e 9.8 | Nuova meccanica | P1 | L | #23, #25 |
| 34 | Spareggio finale a oltranza | AUDIT #7; RIEPILOGO pareggio; BRAINSTORMING QZ-11 | Nuova meccanica | P1 | M | #33, finalisti variabili |
| 35 | Ingresso tardivo configurabile | AUDIT §3.3; RIEPILOGO; BRAINSTORMING QZ-03 | Nuova meccanica | P1 | M | Lobby, session config |
| 36 | Timer autorevole e sincronizzato | REGOLAMENTO §14.1; BRAINSTORMING QZ-04–QZ-05 | Fix tecnico/Nuova meccanica | P2 | L | #10–11, timestamp server |
| 37 | Pausa/riprendi e animazione congelata | BRAINSTORMING QZ-05/QZ-07 | Nuova meccanica/UX | P2 | M | #36 |
| 38 | ±5 secondi, chiudi, riapri e annulla | BRAINSTORMING §6/QZ-06; RIEPILOGO recupero errori | Nuova meccanica | P2 | M | #36, registro eventi |
| 39 | Politica definitiva/modificabile per risposta | REGOLAMENTO §14.3; BRAINSTORMING §§4 e 6 | Nuova meccanica | P2 | M | #6, #15 |
| 40 | Presenza, `onDisconnect` e riconnessione | AUDIT #3; RIEPILOGO; BRAINSTORMING §5 | Fix tecnico/UX | P2 | M | Identità persistente |
| 41 | Lobby con QR, Pronta e gestione squadre | BRAINSTORMING §5/QZ-02; REGOLAMENTO §8.1 | UX/Nuova meccanica | P2 | M | #35, #40 |
| 42 | Nuovo pannello di regia Admin | BRAINSTORMING §11 | UX | P2 | L | Timer, scoring, lobby |
| 43 | Registro eventi e undo minimo | BRAINSTORMING §11/QZ-14; RIEPILOGO | Fix tecnico/UX | P2 | L | #10–11, ledger |
| 44 | Modalità prova con squadre fittizie | BRAINSTORMING §12/QZ-15; RIEPILOGO Roadmap | UX/Fix tecnico | P2 | M | Progetto test, #12 |
| 45 | Validazione banca domande pre-start | BRAINSTORMING §12 | UX/Fix tecnico | P2 | M | #15, gestione media |
| 46 | Separare listener per ruolo e ramo | AUDIT §§2.2/2.4; RIEPILOGO performance | Fix tecnico | P3 | L | Nuovo modello dati |
| 47 | Reveal classifica automatico dal basso | BRAINSTORMING §7/QZ-08; REGOLAMENTO §7 | UX | P3 | M | Scoring consolidato |
| 48 | Animazioni cambio posizione/zona finale/podio | BRAINSTORMING QZ-09; REGOLAMENTO §7 | UX | P3 | M | #47 |
| 49 | Feedback post-domanda e mini-classifiche | REGOLAMENTO §7.1–§7.3 | UX | P3 | M | Scoring, reveal |
| 50 | Regole e rischio visibili ai giocatori | AUDIT #14; BRAINSTORMING principio 6; REGOLAMENTO §§14.5 e 15 | UX | P3 | Profili scoring |
| 51 | Tabelle Admin responsive | AUDIT #11; RIEPILOGO | UX | P3 | Nuovo pannello |
| 52 | Preload e fallback media | AUDIT §2.4; BRAINSTORMING §12 | Fix tecnico/UX | P3 | Gestione media |
| 53 | Estrarre blocchi Team/Display realmente condivisi | AUDIT #9; RIEPILOGO anti-riscrittura | Fix tecnico | P3 | Nuovo flusso stabile |
| 54 | Modalità spettatore Diretta protetta | BRAINSTORMING §8/QZ-10 | Nuova meccanica/UX | P4 | Finale, stati risposta |
| 55 | Pronostici e classifica pubblico | BRAINSTORMING §8 | Nuova meccanica | P4 | #54, isolamento punteggi |
| 56 | Riepilogo finale e rivincita | BRAINSTORMING §13; REGOLAMENTO §7 | UX | P4 | Ledger completo |
| 57 | Albo d’oro persistente | BRAINSTORMING domande 108/QZ-16 | Nuova meccanica | P4 | Schema storico |
| 58 | Autenticazione reale Admin/squadre | AUDIT #2; RIEPILOGO sicurezza | Fix tecnico | P4 differita* | L | Regole versionate |
| 59 | Photopuzzle | REGOLAMENTO §10.1 | Nuova meccanica | P5-A | L | Immagini, stati progressivi |
| 60 | Indovina chi | REGOLAMENTO §10.3 | Nuova meccanica | P5-A | L | Indizi progressivi |
| 61 | Sbaglia & Vinci | REGOLAMENTO §10.6 | Nuova meccanica | P5-A | M | Scelta multipla/preset |
| 62 | Music Box/Crazy Radio | REGOLAMENTO §10.13 | Nuova meccanica | P5-A | M | Audio consolidato |
| 63 | Memory | REGOLAMENTO §10.2 | Nuova meccanica | P5-B | XL | Griglia e serie sincronizzate |
| 64 | Catena di parole | REGOLAMENTO §10.5 | Nuova meccanica | P5-B | M | Testo libero/indizi |
| 65 | Numeri e cerchi | REGOLAMENTO §10.7 | Nuova meccanica | P5-B | L | Visuali a fasi |
| 66 | Alta o bassa | REGOLAMENTO §10.10 | Nuova meccanica | P5-B | M | Motore a serie |
| 67 | Ghigliottina | REGOLAMENTO §10.11 | Nuova meccanica | P5-B | M | Testo libero/indizi |
| 68 | Roulette | REGOLAMENTO §10.14 | Nuova meccanica | P5-B | M | Animazione + snapshot |
| 69 | Top 10 | REGOLAMENTO §10.4 | Nuova meccanica | P5-C | L | Ordinamento |
| 70 | Corsa dei cavalli | REGOLAMENTO §10.8 | Nuova meccanica | P5-C | XL | Motore corsa |
| 71 | Car Racing | REGOLAMENTO §10.9 | Nuova meccanica | P5-C | XL | Motore corsa |
| 72 | Frase misteriosa | REGOLAMENTO §10.12 | Nuova meccanica | P5-C | L | Reveal progressivo |
| 73 | Calci di rigore | REGOLAMENTO §10.15 | Nuova meccanica | P5-C | XL | Stato testa-a-testa |
| 74 | Cervelluzzle/Ruzzle | REGOLAMENTO §10.16 | Nuova meccanica | P5-C | XL | Dizionario e invii multipli |
| 75 | Poteri strategici opzionali | REGOLAMENTO §13; BRAINSTORMING P5 | Nuova meccanica | P5-C | L | Scoring stabile e collaudato |

\* L’autenticazione passa a P0 se le regole reali risultano globalmente permissive in un contesto non più limitato al gruppo fidato.

## 7. Roadmap consigliata

Le durate seguenti sono indicative per una sola persona nel tempo libero e devono essere lette come ordine e dimensione, non come scadenze rigide. Ogni fase deve lasciare disponibile una versione giocabile.

### Fase 0 — Mettere in sicurezza il terreno

**Durata indicativa:** 1 fine settimana.

1. Creare il secondo progetto Firebase.
2. Copiare soltanto dati di prova necessari.
3. Controllare ed esportare regole RTDB/Storage.
4. Definire una procedura semplice per distinguere test e produzione.

**Uscita dalla fase:** nessun test può resettare la produzione; le regole effettive sono note.

### Fase 1 — Stabilità della versione attuale

**Durata indicativa:** 1–2 fine settimana.

1. XSS e rendering sicuro.
2. Loading, errori e retry.
3. Esiti reali di join e risposta.
4. Transazione sulla risposta e blocco doppio tap.
5. Checkpoint dinamico.
6. Limiti e fallback audio.

**Uscita dalla fase:** una partita con il formato attuale sopravvive a rete lenta, doppio tap e input malevolo senza mostrare uno stato falso.

### Fase 2 — Nuovo modello di sessione e configurazione

**Durata indicativa:** 2–4 fine settimana.

1. Introdurre sessione, config versionata, runtime, istanze domanda, risposte, ledger ed eventi.
2. Migrare il flusso attuale senza aggiungere ancora tutte le nuove tipologie.
3. Costruire Sala pre-partita, Serata classica e Personalizzata.
4. Implementare modifiche live prospettiche e riepilogo start.

**Uscita dalla fase:** il gioco attuale funziona interamente sul nuovo stato e può cambiare manche, domande, finalisti e timer senza valori hardcoded.

### Fase 3 — Scoring dinamico

**Durata indicativa:** 2–3 fine settimana.

1. Profili Classico, Dinamico e Personalizzato.
2. Bonus per ordine delle corrette.
3. Penalità e rimonta per fasce congelate.
4. Override partita/manche/domanda.
5. Modalità finale Azzera/Mantieni/Vantaggio.
6. Display trasparente delle regole e test delle formule.

**Uscita dalla fase:** gli stessi dati producono sempre gli stessi punti; il leader rischia sensibilmente più dell’ultima squadra; nessun ricalcolo retroattivo avviene per errore.

### Fase 4 — Tutte le tipologie principali

**Durata indicativa:** 4–7 fine settimana, per incrementi verticali.

Ordine interno consigliato:

1. scelta multipla, vero/falso, immagini e audio;
2. stima numerica e spareggio;
3. ordinamento;
4. video;
5. testo libero, alias e revisione Admin;
6. logica come categoria trasversale;
7. editor, anteprima e controlli pre-start per tutti i tipi.

**Uscita dalla fase:** tutte le tipologie scelte sono creabili, provabili, giocabili, valutabili e annullabili senza interventi diretti sul database.

### Fase 5 — Regia live, lobby e recupero

**Durata indicativa:** 3–5 fine settimana.

1. Presenza e riconnessione.
2. QR, Pronta, ingresso tardivo e gestione squadre.
3. Timer autorevole, pausa, ±5, chiusura, riapertura e annullamento.
4. Pannello Admin riorganizzato.
5. Registro eventi e undo minimo.
6. Modalità prova completa.

**Uscita dalla fase:** l’admin vede sempre cosa sta succedendo, chi manca e quale azione viene dopo; una disconnessione non cancella la squadra.

### Fase 6 — Classifica, finale e pubblico

**Durata indicativa:** 2–4 fine settimana.

1. Reveal automatico dal basso e pari merito raggruppati.
2. Animazioni di posizione, qualificazione e podio.
3. Finalisti variabili e finale senza eliminazione.
4. Spareggio a oltranza.
5. Diretta protetta per gli eliminati.
6. Riepilogo, rivincita e albo d’oro essenziale.

**Uscita dalla fase:** qualificazione, finale e pareggi non richiedono scelte arbitrarie dell’admin; gli eliminati possono seguire senza suggerire risposte.

### Fase 7 — Ottimizzazione mirata

**Durata indicativa:** 1–3 fine settimana.

1. Separare listener e payload per ruolo.
2. Estrarre i componenti duplicati realmente toccati.
3. Rendere responsive il pannello Admin.
4. Misurare sincronizzazione, caricamento media e comportamento con il numero massimo realistico di squadre.
5. Valutare l’autenticazione reale in base all’uso effettivo.

### Fase 8 — Arcade, uno alla volta

Non sviluppare un framework generico per tutti gli arcade prima di averne realizzato uno. Scegliere un gioco P5-A, costruire una versione minima, provarlo durante una serata e misurare:

- comprensibilità senza lunga spiegazione;
- durata reale;
- peso sul punteggio totale;
- coinvolgimento di chi è indietro;
- lavoro necessario per creare i contenuti;
- affidabilità su telefoni diversi.

Solo dopo il test si decide se consolidare componenti condivisi per il secondo arcade.

## 8. Domande ancora aperte

Questi punti non impediscono di iniziare P0–P1, ma devono essere chiusi prima della funzione cui appartengono.

1. **Regole Firebase reali:** quali regole RTDB e Storage sono oggi attive? Se sono globalmente pubbliche, qual è il rischio accettabile prima di anticipare l’autenticazione?
2. **Limiti realistici:** quante squadre e quanti finalisti devono essere collaudati come massimo della prima release? La logica sarà variabile, ma il layout necessita di un obiettivo concreto.
3. **Tolleranza del timer:** quale scarto massimo fra dispositivi viene accettato dopo i test? Obiettivo tecnico iniziale proposto: entro circa 500 ms sul Display, senza usare il timer visuale per decidere l’accettazione server.
4. **Tabella definitiva del bonus d’ordine:** confermare o ritoccare il default `25/20/15/10/5%` dopo almeno due serate di prova.
5. **Fasce dinamiche:** confermare soglie `10/25/50/75%`, moltiplicatori `2,00–0,70` e bonus `0–8%` dopo aver osservato volatilità e percezione di equità.
6. **Vantaggio in finale:** definire la tabella effettiva da offrire quando l’admin attiva questa modalità; lo standard resta nessun vantaggio nella finale a eliminazione.
7. **Testo libero:** quali normalizzazioni devono essere sempre valide e quali errori ortografici possono soltanto essere suggeriti all’admin?
8. **Media:** limiti massimi, formati supportati e strategia di hosting dei video devono essere scelti in base ai dispositivi e alla connessione usati nelle serate.
9. **Albo d’oro:** decidere se conservare soltanto data, vincitore e punteggio oppure anche configurazione, partecipanti e statistiche dettagliate.
10. **Primo arcade:** scegliere il primo esperimento fra Photopuzzle, Indovina chi, Sbaglia & Vinci e Music Box; tutti gli altri restano backlog.
11. **Poteri strategici:** stabilire se il moltiplicatore di un Raddoppio debba applicarsi sia al premio sia alla penalità. Non va implementato prima dei playtest del profilo dinamico.
12. **Criterio per introdurre l’autenticazione:** definire un trigger concreto, per esempio link condiviso fuori dal gruppo, più admin, partite pubbliche o dati storici che non si vogliono esporre.

