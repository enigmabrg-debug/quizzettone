# PROPOSTA SCHERMO CONDIVISO — COMPLETA

> Documento di riferimento fornito dall'utente. Il pacchetto PL-11 (vedi `PIANO_IMPLEMENTAZIONE_CONSOLIDATO.md`) ne aveva realizzato un sottoinsieme ridotto; il resto è stato realizzato il 2026-10-23. In fondo al documento c'è la sezione **Stato dell'implementazione**, che indica dove vive ogni punto nel codice e dove l'implementazione si discosta dal testo.

## Obiettivo

Progettare per il Quizzettone una modalità di gioco strutturale che distingua tra:

- **partita senza schermo condiviso**, in cui ogni squadra legge e risponde interamente dal proprio dispositivo;
- **partita con schermo condiviso**, in cui il contenuto comune vive sul Display e il telefono della squadra funziona soprattutto come controller personale;
- **partita ibrida**, in cui la modalità può variare in base alla singola domanda o al singolo minigioco.

La funzione deve essere progettata in modo riutilizzabile e stabile, perché diventerà la base per future tipologie di domanda e minigiochi:

- vero/falso;
- foto;
- video;
- ordinamento;
- stima numerica;
- testo libero;
- giochi visivi;
- buzzer;
- controller interattivi;
- minigiochi obbligatoriamente basati sul Display.

La presenza dello schermo condiviso non deve essere trattata come un semplice interruttore grafico. Deve diventare una **capacità strutturale della sessione di gioco**.

---

# 1. Decisione progettuale principale

La modalità deve essere configurata a livello di partita, ma ogni domanda o minigioco deve poterla modificare o imporre.

La gerarchia corretta è:

```text
Configurazione della partita
        ↓
Preferenza della singola domanda
        ↓
Requisiti tecnici del tipo di attività
        ↓
Fallback deciso dall’admin
```

Questo consente di avere, per esempio:

- una partita prevalentemente con schermo condiviso;
- alcune domande leggibili completamente sui telefoni;
- un minigioco che richiede obbligatoriamente il Display;
- un fallback di emergenza sui telefoni;
- una modalità mista senza modificare ogni volta l’intero sistema.

---

# 2. Le tre modalità della partita

Nel pannello pre-partita devono essere disponibili tre modalità.

```javascript
displayMode: "team_devices"
displayMode: "shared_screen"
displayMode: "hybrid"
```

## 2.1 `team_devices`

Modalità senza schermo condiviso.

Ogni squadra vede sul proprio dispositivo:

- categoria;
- testo della domanda;
- eventuali media compatibili;
- timer;
- opzioni o controlli di risposta.

Il Display può comunque essere aperto, ma resta facoltativo e può mostrare:

- titolo della manche;
- avanzamento;
- timer;
- classifica;
- animazioni;
- contenuti non essenziali.

Nessuna attività deve diventare ingiocabile se il Display non è presente, a meno che quella specifica attività non dichiari esplicitamente di richiederlo.

## 2.2 `shared_screen`

Modalità con schermo condiviso.

Il Display diventa la fonte principale del contenuto comune.

La squadra vede sul proprio dispositivo:

- stato della domanda;
- timer, se previsto;
- controlli di risposta;
- conferma dell’invio;
- eventuali informazioni personali.

Di norma non vede:

- testo completo della domanda;
- immagini;
- video;
- spiegazioni;
- contenuti comuni.

## 2.3 `hybrid`

È la modalità più flessibile e consigliata come base futura.

La singola attività decide come essere presentata.

Esempio:

- domanda normale: schermo condiviso;
- domanda musicale: schermo condiviso;
- domanda personale: telefono;
- minigioco fotografico: Display obbligatorio;
- domanda in fallback: contenuto completo sui telefoni.

---

# 3. Schema dati della configurazione partita

La configurazione di sessione deve essere separata dallo stato operativo della domanda corrente.

```javascript
function defaultState(){
  return {
    phase: "lobby",
    round: 1,
    qIndex: 0,

    sessionConfig: {
      displayMode: "hybrid",

      sharedScreen: {
        expected: true,
        answerUnlockPolicy: "manual",
        defaultReadingDelayMs: 5000,
        showTimerOnTeams: true,
        emergencyFallbackEnabled: true,
        autoFallbackOnDisconnect: false,
        spectatorContentMode: "always_full"
      }
    },

    presentation: {
      activityId: null,
      resolvedMode: null,
      displayStatus: "idle",
      inputStatus: "locked",
      presentedAt: null,
      inputUnlockedAt: null,
      timerStartedAt: null,
      fallbackActive: false,
      fallbackReason: null,
      revision: 0
    },

    questionStartedAt: null,
    timerDuration: 20000,

    // resto dello stato...
  };
}
```

## `sessionConfig`

Contiene le scelte stabili della partita.

## `presentation`

Contiene lo stato operativo dell’attività corrente:

- dove viene mostrato il contenuto;
- se le risposte sono bloccate;
- se il timer è partito;
- se è attivo un fallback;
- quale revisione è in corso.

---

# 4. Schema dati della singola domanda

Il modello della domanda deve essere esteso per distinguere contenuto, risposta e presentazione.

```javascript
{
  id: "q_abc123",
  type: "multiple_choice",

  pool: "manche",
  category: "Geografia",

  content: {
    question: "Quale città è attraversata dal fiume Moldava?",
    media: null
  },

  response: {
    type: "single_choice",
    options: ["Praga", "Budapest", "Vienna", "Cracovia"],
    correctIndex: 0
  },

  presentation: {
    mode: "inherit",
    sharedScreenRequirement: "optional",
    teamContentVisibility: "auto",
    inputUnlockPolicy: "inherit",
    readingDelayMs: null,
    teamTimerVisibility: "inherit"
  },

  adminNote: null,
  audio: null,
  lastUsedAt: null
}
```

---

# 5. Proprietà di presentazione della domanda

## 5.1 `presentation.mode`

Valori:

```text
inherit
team_devices
shared_screen
```

### `inherit`

Usa la modalità configurata per la partita.

### `team_devices`

Forza la visualizzazione completa sui dispositivi.

### `shared_screen`

Preferisce lo schermo condiviso.

## 5.2 `sharedScreenRequirement`

Valori:

```text
none
optional
required
```

### `none`

L’attività non usa lo schermo condiviso come elemento necessario.

### `optional`

Può funzionare con o senza Display.

### `required`

Non può iniziare senza un Display compatibile e pronto, salvo una variante alternativa prevista esplicitamente dal minigioco.

## 5.3 `teamContentVisibility`

Valori:

```text
auto
full
answers_only
controller_only
hidden
```

### `auto`

Il sistema decide in base alla modalità risolta.

### `full`

Mostra contenuto e controlli completi.

### `answers_only`

Mostra solo opzioni o controlli di risposta.

### `controller_only`

Il telefono funziona come controller:

- joystick;
- buzzer;
- slider;
- pulsante;
- selettore;
- input specifico.

### `hidden`

Il telefono mostra soltanto uno stato informativo.

---

# 6. Modalità risolta

Il sistema deve calcolare una modalità effettiva per ogni attività.

Non bisogna lasciare che ogni client decida autonomamente.

```javascript
function resolvePresentationMode(activity, sessionConfig, displayHealth){
  const requirement =
    activity.presentation?.sharedScreenRequirement || "optional";

  const override =
    activity.presentation?.mode || "inherit";

  if(requirement === "required"){
    return displayHealth.ready
      ? "shared_screen"
      : "blocked";
  }

  if(override === "team_devices"){
    return "team_devices";
  }

  if(override === "shared_screen"){
    return displayHealth.ready
      ? "shared_screen"
      : "team_devices";
  }

  if(sessionConfig.displayMode === "team_devices"){
    return "team_devices";
  }

  if(sessionConfig.displayMode === "shared_screen"){
    return displayHealth.ready
      ? "shared_screen"
      : "team_devices";
  }

  return displayHealth.ready
    ? "shared_screen"
    : "team_devices";
}
```

Il risultato deve essere salvato in:

```javascript
state.presentation.resolvedMode
```

Tutti i dispositivi devono leggere lo stesso valore.

---

# 7. Separare presentazione, sblocco risposte e timer

Nel sistema attuale la domanda viene mostrata, il timer parte e i pulsanti diventano utilizzabili nello stesso momento.

Questi eventi devono essere separati.

```text
PREPARAZIONE
→ PRESENTAZIONE
→ LETTURA
→ INPUT APERTO
→ RISPOSTE CHIUSE
→ RIVELAZIONE
```

Possibili stati:

```javascript
activityPhase: "preparing"
activityPhase: "presenting"
activityPhase: "reading"
activityPhase: "answering"
activityPhase: "closed"
activityPhase: "revealed"
```

Oppure, mantenendo la macrofase `question`:

```javascript
state.phase = "question";

state.presentation.displayStatus = "visible";
state.presentation.inputStatus = "locked";
```

Poi:

```javascript
state.presentation.inputStatus = "open";
state.presentation.timerStartedAt = Date.now();
```

Il timer deve partire quando si aprono le risposte, non quando compare la domanda.

---

# 8. Politiche di sblocco delle risposte

Valori:

```text
immediate
manual
delayed
after_media
```

## 8.1 `immediate`

La domanda appare e le risposte si attivano subito.

Adatto a:

- domande rapidissime;
- partite informali;
- vero/falso semplici;
- modalità senza schermo.

## 8.2 `manual`

La domanda appare sul Display.

Le squadre vedono:

> Guarda lo schermo condiviso  
> Le risposte verranno aperte tra poco.

L’admin legge e poi preme:

> Apri risposte e avvia timer

Questa deve essere la modalità predefinita con schermo condiviso.

## 8.3 `delayed`

Le risposte si aprono automaticamente dopo un ritardo configurabile.

```javascript
readingDelayMs: 6000
```

L’admin deve poter:

- aprire prima;
- aggiungere tempo di lettura;
- annullare l’apertura automatica.

## 8.4 `after_media`

Le risposte si aprono:

- alla fine di un video;
- alla fine di una clip audio;
- dopo un’animazione;
- dopo un evento specifico del minigioco.

---

# 9. Flusso consigliato con schermo condiviso

## Fase 1: preparazione privata

L’admin vede la prossima attività.

Le squadre vedono:

> Prossima domanda in arrivo.

Il Display mostra una schermata neutra.

## Fase 2: mostra domanda

L’admin preme:

> Mostra domanda

Il sistema salva:

```javascript
presentation: {
  resolvedMode: "shared_screen",
  displayStatus: "visible",
  inputStatus: "locked",
  presentedAt: Date.now(),
  inputUnlockedAt: null,
  timerStartedAt: null
}
```

Il Display mostra:

- categoria;
- domanda;
- media;
- eventuali opzioni;
- timer non ancora avviato.

I Team mostrano:

- categoria opzionale;
- messaggio “Guarda lo schermo”;
- pulsanti ancora nascosti o disabilitati.

## Fase 3: lettura

L’admin legge e può:

- aprire le risposte;
- ritardare l’apertura;
- riprodurre media;
- annullare la domanda.

## Fase 4: apertura risposte

L’admin preme:

> Apri risposte e avvia timer

Il sistema:

```javascript
inputStatus = "open";
inputUnlockedAt = Date.now();
timerStartedAt = Date.now();
```

I Team mostrano i controlli attivi.

Il Display avvia il timer.

## Fase 5: chiusura

Allo zero o con comando manuale:

```javascript
inputStatus = "closed";
```

I pulsanti vengono disabilitati.

## Fase 6: soluzione

Il Display mostra la risposta corretta.

I telefoni possono mostrare:

- esito personale;
- risposta selezionata;
- punti ottenuti;
- oppure nessun dettaglio, in base alla configurazione.

---

# 10. Flusso senza schermo condiviso

In modalità `team_devices`, il telefono mostra tutto.

Flusso:

```text
Mostra domanda
→ contenuto visibile sui telefoni
→ apertura risposte
→ timer
```

Anche in questa modalità la separazione tecnica deve restare valida:

- domanda visibile;
- input aperto;
- timer attivo.

Questo consente all’admin di leggere prima e aprire le risposte in un secondo momento.

---

# 11. Comportamento della vista Admin

L’admin deve conoscere sempre:

- modalità configurata;
- modalità risolta;
- stato del Display;
- stato dell’input;
- stato del timer;
- eventuale fallback.

Esempio:

```text
Modalità domanda
Schermo condiviso

Display
Connesso · Audio attivo · Sincronizzato

Domanda
Visibile sul Display

Risposte
Bloccate

[Apri risposte e avvia timer]
```

Comandi necessari:

- Mostra domanda;
- Apri risposte;
- Ritarda apertura;
- Chiudi risposte;
- Mostra contenuto anche sui telefoni;
- Ripristina modalità schermo;
- Pausa;
- Annulla domanda.

Se una domanda richiede il Display e questo non è pronto:

```text
Questa attività richiede uno schermo condiviso.

[Attendi riconnessione]
[Salta attività]
[Usa variante alternativa]
```

---

# 12. Comportamento della vista Display

In modalità condivisa il Display è la fonte principale del contenuto.

Deve mostrare:

- domanda;
- opzioni, quando opportuno;
- immagini;
- video;
- timer;
- stato della raccolta;
- soluzione;
- classifiche;
- minigiochi.

Deve inoltre comunicare il proprio stato a Firebase.

```javascript
displayPresence: {
  clientId: "display_xyz",
  connected: true,
  ready: true,
  lastSeenAt: 1786020000000,
  capabilities: {
    audio: true,
    video: true,
    fullscreen: true
  }
}
```

Non basta sapere che esiste un client Display.

Bisogna sapere se:

- è connesso;
- riceve aggiornamenti;
- ha attivato l’audio;
- supporta il contenuto;
- ha caricato i media;
- è sincronizzato con la revisione corrente.

---

# 13. Comportamento della vista Team

Il rendering deve dipendere da:

```javascript
state.presentation.resolvedMode
state.presentation.inputStatus
question.presentation.teamContentVisibility
```

## Con schermo condiviso e input bloccato

Mostra:

```text
MANCHE 1 · DOMANDA 4

Guarda lo schermo condiviso

Le risposte non sono ancora aperte.
```

Le opzioni dovrebbero restare nascoste fino all’apertura.

## Con schermo condiviso e input aperto

Mostra:

```text
Scegli la risposta

[A]
[B]
[C]
[D]

18 secondi
```

## Testo sui pulsanti

Configurazione possibile:

```text
Solo lettere
Lettere + testo
```

### Solo lettere

Più coerente con una vera modalità condivisa.

### Lettere + testo

Più accessibile e sicura.

La scelta dovrebbe essere configurabile.

---

# 14. Timer

Il timer deve essere governato da tre momenti distinti:

```javascript
presentedAt
inputUnlockedAt
timerStartedAt
```

La nuova funzione:

```javascript
function timeRemaining(){
  if(!state?.presentation?.timerStartedAt) {
    return state.timerDuration;
  }

  const elapsed =
    Date.now() - state.presentation.timerStartedAt;

  return Math.max(
    0,
    state.timerDuration - elapsed
  );
}
```

Prima dell’apertura:

```javascript
timerStartedAt = null
```

Il timer non deve scorrere.

## Visibilità timer sui telefoni

Valori:

```text
visible
hidden
progress_only
```

Raccomandazione:

- senza schermo: timer completo;
- con schermo: timer visibile sia sul Display sia sui telefoni;
- minigiochi immersivi: opzionalmente nascosto sui telefoni.

---

# 15. Gestione della disconnessione del Display

## Caso A: Display non connesso prima della domanda

Se la modalità è `optional`:

- la domanda viene risolta su `team_devices`;
- l’admin riceve un avviso;
- la partita continua.

Se è `required`:

- l’attività non parte;
- l’admin deve riconnettere il Display, saltare o scegliere una variante.

## Caso B: Display si disconnette durante la lettura

Le risposte restano bloccate.

L’admin vede:

> Display disconnesso. Le risposte sono ancora chiuse.

Azioni:

- Attendi;
- Mostra domanda sui telefoni;
- Salta;
- Riprova Display.

Fallback:

```javascript
presentation.resolvedMode = "team_devices";
presentation.fallbackActive = true;
presentation.fallbackReason = "display_disconnect";
presentation.revision += 1;
```

## Caso C: Display si disconnette mentre il timer è attivo

Per attività compatibili:

- il timer continua;
- i pulsanti restano attivi;
- la domanda completa appare sui telefoni;
- l’admin riceve un avviso.

Per attività `required`:

- pausa;
- annullamento;
- variante alternativa;
- scelta manuale dell’admin.

---

# 16. Fallback manuale

L’admin deve avere sempre disponibile:

> Mostra contenuto sui telefoni

Il comando modifica solo l’attività corrente.

```javascript
presentation.fallbackActive = true;
presentation.resolvedMode = "team_devices";
```

Alla domanda successiva la modalità viene ricalcolata.

---

# 17. Fallback automatico

Non deve essere attivo di default.

```javascript
autoFallbackOnDisconnect: false
```

Possibile periodo di tolleranza:

```javascript
autoFallbackGraceMs: 5000
```

Il sistema mostra un avviso e lascia decidere l’admin.

L’unico fallback automatico consigliabile è prima dell’avvio di un’attività opzionale.

---

# 18. Heartbeat del Display

Il Display aggiorna periodicamente:

```javascript
displayPresence/{displayId}
```

Ogni 2–3 secondi:

```javascript
{
  role: "display",
  ready: true,
  lastSeenAt: firebase.database.ServerValue.TIMESTAMP,
  currentRevision: 42,
  audioUnlocked: true,
  mediaReady: true
}
```

Il Display viene considerato disponibile se:

```javascript
Date.now() - lastSeenAt < 7000
```

Usare `ServerValue.TIMESTAMP`.

Possibile gestione con:

```javascript
db.ref(path).onDisconnect().update({
  ready: false,
  disconnectedAt: firebase.database.ServerValue.TIMESTAMP
});
```

---

# 19. Conferma di ricezione della domanda

Ogni presentazione deve avere:

```javascript
presentation.revision
```

Quando l’admin mostra una domanda:

```javascript
revision += 1;
```

Il Display, dopo il rendering e il caricamento dei media, scrive:

```javascript
displayPresence.currentRevision = revision;
displayPresence.mediaReady = true;
```

L’admin vede:

```text
Display sincronizzato ✓
```

oppure:

```text
Display sta caricando il video…
```

Per video o minigiochi obbligatori, il pulsante di apertura risposte può restare disabilitato finché `mediaReady` non è vero.

---

# 20. Modalità spettatore

Gli spettatori devono avere uno stato esplicito.

```javascript
participantStatus: "active"
participantStatus: "eliminated"
participantStatus: "spectator"
```

## Senza schermo condiviso

Gli spettatori devono vedere:

- domanda completa;
- opzioni;
- timer;
- risposte dei finalisti, quando previsto;
- soluzione.

Non possono rispondere.

## Con schermo condiviso

Possono vedere:

- stato della finale;
- risposte live;
- punteggi;
- informazioni supplementari.

Configurazione:

```javascript
spectatorContentMode: "follow_session"
spectatorContentMode: "always_full"
```

Per il Quizzettone si consiglia:

```text
always_full
```

---

# 21. Principio generale per i minigiochi futuri

Ogni attività deve dichiarare le proprie capacità.

```javascript
const ACTIVITY_TYPES = {
  multiple_choice: {
    sharedScreenRequirement: "optional",
    supportedPresentationModes: [
      "team_devices",
      "shared_screen"
    ],
    teamController: "choice_buttons",
    fallbackStrategy: "show_full_content"
  },

  true_false: {
    sharedScreenRequirement: "optional",
    supportedPresentationModes: [
      "team_devices",
      "shared_screen"
    ],
    teamController: "true_false_buttons",
    fallbackStrategy: "show_full_content"
  },

  image_guess: {
    sharedScreenRequirement: "optional",
    supportedPresentationModes: [
      "team_devices",
      "shared_screen"
    ],
    teamController: "choice_buttons",
    fallbackStrategy: "show_media_on_teams"
  },

  shared_video_reaction: {
    sharedScreenRequirement: "required",
    supportedPresentationModes: [
      "shared_screen"
    ],
    teamController: "buzzer",
    fallbackStrategy: "none"
  },

  live_buzzer: {
    sharedScreenRequirement: "required",
    supportedPresentationModes: [
      "shared_screen"
    ],
    teamController: "buzzer",
    fallbackStrategy: "pause_or_skip"
  }
};
```

Ogni minigioco deve dichiarare almeno:

```javascript
{
  sharedScreenRequirement,
  supportedPresentationModes,
  teamController,
  contentDistribution,
  inputUnlockPolicy,
  timerPolicy,
  fallbackStrategy,
  spectatorPolicy
}
```

---

# 22. Contratto completo di un’attività

```javascript
{
  type: "image_guess",

  capabilities: {
    requiresSharedScreen: false,
    supportsTeamDevices: true,
    supportsSharedScreen: true,
    supportsSpectators: true,
    supportsEmergencyFallback: true
  },

  presentation: {
    defaultMode: "inherit",
    teamContentVisibility: "answers_only",
    displayContentVisibility: "full",
    spectatorContentVisibility: "full"
  },

  lifecycle: {
    unlockPolicy: "manual",
    timerPolicy: "on_input_open",
    closePolicy: "timer_or_manual",
    revealPolicy: "admin"
  },

  fallback: {
    strategy: "show_full_content_on_teams",
    preserveTimer: true,
    requiresAdminConfirmation: true
  }
}
```

Il sistema generale gestisce:

- presentazione;
- connessione;
- sblocco;
- timer;
- fallback;
- spettatori.

Il minigioco gestisce:

- contenuto;
- controller;
- validazione;
- punteggio.

---

# 23. Applicazione alle future tipologie

## Vero/falso

### Con Display

Display:

- testo;
- media;
- timer.

Telefono:

- Vero;
- Falso.

### Senza Display

Telefono:

- testo;
- media;
- Vero;
- Falso;
- timer.

## Foto

### Con Display

Display:

- immagine grande;
- eventuale zoom o rivelazione progressiva.

Telefono:

- lettere;
- testo opzionale.

### Senza Display

Telefono:

- immagine;
- risposte;
- timer.

## Video

Possibili modalità:

- compatibile con entrambi;
- obbligatorio sul Display.

Per video condiviso:

```javascript
inputUnlockPolicy: "after_media"
```

Le risposte si aprono quando il Display invia:

```javascript
mediaStatus: "ended"
```

oppure quando decide l’admin.

## Ordinamento

Telefono:

- elementi trascinabili;
- conferma ordine.

Display:

- domanda;
- contenuto comune.

Questo dimostra che “con schermo” non significa sempre “solo lettere”, ma significa:

> il contenuto comune vive sul Display, l’interazione personale vive sul telefono.

## Stima numerica

Display:

- domanda;
- dati;
- media.

Telefono:

- tastiera numerica;
- slider;
- conferma.

## Testo libero

Display:

- domanda.

Telefono:

- campo di testo;
- invio;
- stato moderazione.

---

# 24. Modifiche necessarie nel codice

## A. Separare il rendering Team e Display

Creare:

```javascript
renderTeamActivity()
renderDisplayActivity()
renderAdminActivityControl()
```

Componenti condivisi:

```javascript
renderQuestionText()
renderQuestionMedia()
renderAnswerOptions()
renderTimer()
renderInputController()
```

## B. Sostituire `questionStartedAt`

Introdurre:

```javascript
presentedAt
inputUnlockedAt
timerStartedAt
```

`questionStartedAt` può restare temporaneamente per compatibilità.

## C. Modificare `teamSubmitAnswer()`

Aggiungere controlli:

```javascript
if(state.presentation.inputStatus !== "open") return;
if(timeRemaining() <= 0) return;
```

La validazione dovrebbe essere rinforzata anche nelle Firebase Rules o in logica server-side futura.

## D. Inserire una revisione attività

Ogni risposta:

```javascript
{
  activityId,
  revision,
  optionIndex,
  ts
}
```

Questo impedisce di salvare una risposta sulla domanda sbagliata dopo aggiornamenti ritardati.

---

# 25. Identificatore dell’attività corrente

```javascript
currentActivity: {
  instanceId: "activity_1786023456789_ab12",
  contentId: "q_abc123",
  type: "multiple_choice",
  round: 1,
  index: 4
}
```

Le risposte diventano:

```text
answers/{teamId}/{instanceId}
```

Questo è più robusto di una chiave basata soltanto su round e indice.

---

# 26. Configurazione admin pre-partita

## Esperienza di visualizzazione

### Dove verranno mostrate le domande?

- Sui telefoni;
- Sullo schermo condiviso;
- Modalità mista.

## Apertura risposte

- Immediatamente;
- Manualmente;
- Dopo ritardo.

Possibili ritardi:

```text
3 / 5 / 8 / 10 secondi
```

## Timer sui telefoni

- Visibile;
- Nascosto;
- Solo barra.

## Emergenza Display

- Consenti fallback;
- Chiedi sempre conferma;
- Blocca attività incompatibili.

## Spettatori

- Segui modalità partita;
- Mostra sempre contenuto completo.

---

# 27. Controlli admin durante la domanda

## Prima della domanda

```text
[Mostra domanda]
```

## Domanda visibile, risposte bloccate

```text
Domanda visibile sul Display
Risposte chiuse

[Apri risposte e avvia timer]
[Mostra anche sui telefoni]
```

## Timer attivo

```text
Risposte aperte
8/10 ricevute
14 secondi

[Pausa timer]
[+5 secondi]
[Chiudi risposte]
```

## Display perso

```text
Display disconnesso

[Mostra domanda sui telefoni]
[Pausa domanda]
[Continua senza modifica]
```

---

# 28. Regole definitive

## Regola 1

La partita ha una modalità predefinita, ma la singola attività può sovrascriverla.

## Regola 2

Ogni attività dichiara se lo schermo è:

- non necessario;
- opzionale;
- obbligatorio.

## Regola 3

Mostrare la domanda, aprire le risposte e avviare il timer sono eventi distinti.

## Regola 4

Con schermo condiviso, l’apertura manuale delle risposte è il comportamento predefinito.

## Regola 5

Il timer parte quando viene aperto l’input.

## Regola 6

Il Display dichiara connessione, capacità, revisione ricevuta e stato dei media.

## Regola 7

Il fallback modifica soltanto l’attività corrente.

## Regola 8

Un’attività obbligatoria per Display non viene convertita automaticamente senza una strategia di fallback esplicita.

## Regola 9

Gli spettatori eliminati possono vedere il contenuto completo.

## Regola 10

Ogni futuro minigioco implementa lo stesso contratto.

---

# 29. Struttura finale consigliata

```javascript
state = {
  sessionConfig: {
    displayMode: "hybrid",
    sharedScreen: {
      answerUnlockPolicy: "manual",
      defaultReadingDelayMs: 5000,
      showTimerOnTeams: true,
      emergencyFallbackEnabled: true,
      autoFallbackOnDisconnect: false,
      spectatorContentMode: "always_full"
    }
  },

  currentActivity: {
    instanceId: "activity_x",
    contentId: "q_x",
    type: "multiple_choice",
    round: 1,
    index: 0
  },

  presentation: {
    resolvedMode: "shared_screen",
    requirement: "optional",
    displayStatus: "visible",
    inputStatus: "locked",
    presentedAt: 0,
    inputUnlockedAt: null,
    timerStartedAt: null,
    fallbackActive: false,
    fallbackReason: null,
    revision: 12
  }
};
```

---

# Conclusione

La distinzione tra partita con o senza schermo condiviso deve diventare una base architetturale del Quizzettone.

Il principio centrale è:

> Lo schermo condiviso definisce dove vive il contenuto comune. Il dispositivo della squadra rimane il controller personale.

Questa impostazione permette di:

- mantenere compatibilità con il funzionamento attuale;
- supportare partite senza proiettore;
- creare una vera esperienza da game show;
- introdurre attività obbligatoriamente basate sul Display;
- gestire fallback e guasti;
- supportare spettatori;
- aggiungere nuove tipologie di domanda;
- evitare riscritture future della stessa logica.

---

# Stato dell'implementazione (2026-10-23)

Tutti i punti sono realizzati. Le differenze rispetto al testo sono indicate con **≠**.

| § | Dove nel codice | Note |
|---|---|---|
| 1, 6 Gerarchia e modalità risolta | `resolvePresentationMode(q, cfg, displayReady)` in `js/state.js`; `presentationForOpen()` in `js/actions.js` | Calcolata a ogni apertura di domanda e salvata in `state.presentation` (`resolvedMode`, `source`, `requirement`) |
| 2 Tre modalità | Sala pre-partita, `config.displayMode` | ≠ "mista" e "schermo condiviso" si risolvono allo stesso modo, come nel codice del §6. Con "schermo condiviso" la regia mostra in più lo stato del Display |
| 3 Configurazione e stato | `config.sharedScreen` (`DEFAULT_SHARED_SCREEN`), `state.presentation`, `state.currentActivity` | ≠ Il nome resta `config` (non `sessionConfig`), per non migrare le partite salvate. Lo stato dell'input si ricava dal timer con `inputStatus()`: non è un campo separato, così non può andare fuori sincronia |
| 4, 5 Campi della domanda | `normalizeQuestionPresentation`, `normalizeRequirement`; gestore domande, sezione "Presentazione" | ≠ Contenuto e risposta restano nei campi di sempre (`question`, `options`, …), senza riscrivere il mazzo. Il vecchio booleano `sharedScreenRequirement:true` vale `required` |
| 7, 9, 10 Preparazione → presentazione → input → timer | `displayStatus:'preparing'/'visible'`; azioni `adminShowQuestion`, `adminStartTimerManually` | Con lo schermo la domanda nasce privata ("Mostra domanda"). Senza schermo si comporta come prima |
| 8 Politiche di sblocco | `resolveUnlockPolicy()`; `openAnswersIfDue()` (transazione, da qualunque client); `checkAfterMediaUnlock()` | `immediate`, `manual`, `delayed` (+5 s / "Apri a mano"), `after_media` (fine dell'audio segnalata dal Display). ≠ Non esiste ancora un lettore video: `after_media` vale per l'audio |
| 11, 27 Regia | `renderPresentationPanel()` in `js/render.js` | Modalità e sua origine, Display, domanda, risposte; i comandi cambiano con la fase |
| 12, 18, 19 Display: battito, revisione, media | `armDisplayPresence`, `reportDisplayStatus`, `reportDisplaySync` | Battito ogni 3 s su `sessions/current/displayHealth`; `lastSeenAt` con il tempo del server; "pronto" se il battito ha meno di 7 s. Il listener riconosce quando cambia solo questo ramo e non ridisegna le pagine (era il problema del finding #7 dell'audit). Il Display conferma la revisione e se immagini e audio sono caricati. Per le attività obbligatorie "Apri risposte" aspetta i media (c'è "Apri comunque") |
| 13 Vista squadra | `renderTeamQuestion` | "Prossima domanda in arrivo", "Guarda lo schermo condiviso" (con il conto alla rovescia della lettura), poi solo i pulsanti. Configurabili: lettere + testo o solo lettere; timer visibile, a barra o nascosto |
| 14 Timer | `presentedAt` / `inputUnlockedAt` / `timerStartedAt` sull'istanza | Il timer parte solo all'apertura delle risposte |
| 15, 17 Disconnessione | `checkDisplayLoss()`, avvisi in regia | Caso A: un'attività facoltativa va sui telefoni e la regia riceve un avviso; un'attività obbligatoria si ferma con "Attendi riconnessione / Salta / Variante sui telefoni". Casi B e C: avviso con i comandi. Con "Consenti il passaggio automatico" si passa ai telefoni dopo la tolleranza, mai per le attività obbligatorie (regola 8) |
| 16 Fallback manuale | `adminActivateTeamFallback`, `adminRestoreSharedScreen` | Vale solo per l'attività corrente |
| 20 Spettatori | `renderSpectatorFinal` | "Sempre completo" (default) o "segui la partita" |
| 21, 22 Contratto delle attività | `ACTIVITY_TYPES`, `activityTypeFor`, `activityContract` | Scelta, Vero/Falso, Foto e Top Dieci sono giocabili; Ordinamento, Numero, Testo libero, Reazione video e Buzzer sono dichiarati (`playable:false`) per i minigiochi futuri |
| 24C-D, 25 Controlli d'invio e identità | `teamSubmitAnswer`, `filterStaleAnswers` | Si risponde solo con l'input aperto, con tempo rimasto e per l'attività che era sullo schermo. ≠ La chiave delle risposte resta `round-indice` (punteggi e statistiche invariati): ogni risposta porta `instanceId` e `revision`, e una risposta con un `instanceId` diverso da quello della domanda (spareggio rigiocato, rivincita, aggiornamento arrivato in ritardo) viene ignorata |
| 26 Opzioni pre-partita | `renderSharedScreenSetup()` | Apertura risposte, tempo di lettura 3/5/8/10 s, timer e pulsanti sui telefoni, emergenza Display, spettatori, preparazione privata |

**Top Dieci.** Ha un ciclo di vita suo (`ownLifecycle`): turni e tabellone. Il telefono serve per scrivere, quindi mostra sempre il tabellone, con o senza schermo.

**Test.**
- `tests/e2e/phase2-shared-screen-presentation.spec.js`: flusso completo con il Display; senza Display; fallback e ripristino; apertura dopo la lettura; solo lettere e barra; attività obbligatoria e variante; disconnessione con passaggio automatico; battito; domande scartate.
- `tests/unit/shared-screen.spec.js`: risoluzione, requisiti, politiche, contratto, risposte di un'altra apertura, pescata delle già giocate.

