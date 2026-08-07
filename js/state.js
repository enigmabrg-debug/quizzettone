/* ================== DOMANDE ================== */
const Q1 = [
 {category:"Geografia", question:"Quale città è attraversata dal fiume Moldava?", options:["Praga","Budapest","Vienna","Cracovia"], correctIndex:0},
 {category:"Storia", question:"In quale anno cadde il Muro di Berlino?", options:["1987","1989","1991","1993"], correctIndex:1},
 {category:"Matematica", question:"Se un treno percorre 180 km in 2 ore e 15 minuti, qual è la sua velocità media?", options:["72 km/h","80 km/h","85 km/h","90 km/h"], correctIndex:1},
 {category:"Musica", question:"Che canzone è?", options:["Sere nere","Ti scatterò una foto","Non me lo so spiegare","Imbranato"], correctIndex:2, adminNote:"Tiziano Ferro"},
 {category:"Scienze", question:"Quale pianeta del Sistema Solare ha il giorno più lungo rispetto alla sua durata di rotazione?", options:["Marte","Venere","Saturno","Nettuno"], correctIndex:1},
 {category:"Cinema", question:"In quale film compare il personaggio di Tyler Durden?", options:["American Psycho","Fight Club","Trainspotting","Seven"], correctIndex:1},
 {category:"Sport", question:"Quale nazione ha vinto i Mondiali di calcio del 2010?", options:["Germania","Spagna","Argentina","Olanda"], correctIndex:1},
 {category:"Geografia", question:"Quale tra questi Paesi non confina con la Germania?", options:["Danimarca","Svizzera","Ungheria","Polonia"], correctIndex:2},
 {category:"Musica", question:"Che canzone è?", options:["Mr. Brightside","Sex on Fire","Use Somebody","Somebody Told Me"], correctIndex:1, adminNote:"Kings of Leon"},
 {category:"Serie TV", question:"Nella serie TV Breaking Bad, qual è il soprannome criminale di Walter White?", options:["Saul Goodman","Gustavo Fring","Heisenberg","El Camino"], correctIndex:2},
 {category:"Tecnologia", question:"Quale azienda ha creato il sistema operativo Android?", options:["Google","Apple","Microsoft","Samsung"], correctIndex:0},
 {category:"Storia", question:"Quale civiltà costruì Machu Picchu?", options:["Maya","Aztechi","Inca","Olmechi"], correctIndex:2},
 {category:"Scienze", question:"Quale elemento chimico ha simbolo Fe?", options:["Fluoro","Ferro","Francio","Fosforo"], correctIndex:1},
 {category:"Musica", question:"Che canzone è?", options:["A Sky Full of Stars","Viva la Vida","Paradise","Hymn for the Weekend"], correctIndex:2, adminNote:"Coldplay"},
 {category:"Videogiochi", question:"Quale personaggio dei videogiochi è il protagonista della saga The Legend of Zelda?", options:["Link","Zelda","Ganondorf","Epona"], correctIndex:0},
];
const Q2 = [
 {category:"Geografia", question:"Quale capitale europea si trova più a nord?", options:["Dublino","Copenaghen","Amsterdam","Berlino"], correctIndex:1},
 {category:"Storia", question:"Quale imperatore romano fece costruire il Colosseo?", options:["Augusto","Nerone","Vespasiano","Traiano"], correctIndex:2},
 {category:"Musica", question:"Che canzone è?", options:["Brividi","Soldi","Due vite","Zitti e buoni"], correctIndex:2, adminNote:"Marco Mengoni"},
 {category:"Matematica", question:"In matematica, quanto vale il 25% di 360?", options:["75","80","90","100"], correctIndex:2},
 {category:"Scienze", question:"Quale organo del corpo umano produce l'insulina?", options:["Fegato","Pancreas","Milza","Rene"], correctIndex:1},
 {category:"Cinema", question:"Quale film ha vinto l'Oscar come miglior film nel 2020?", options:["Joker","1917","Parasite","Once Upon a Time in Hollywood"], correctIndex:2},
 {category:"Sport", question:"Quale tennista spagnolo è famoso per il suo dominio sulla terra rossa?", options:["Carlos Alcaraz","Rafael Nadal","David Ferrer","Juan Carlos Ferrero"], correctIndex:1},
 {category:"Musica", question:"Che canzone è?", options:["Shape of You","Thinking Out Loud","Perfect","Photograph"], correctIndex:1, adminNote:"Ed Sheeran"},
 {category:"Geografia", question:"Quale tra questi laghi si trova in Italia?", options:["Lago Balaton","Lago di Bled","Lago Trasimeno","Lago Lemano"], correctIndex:2},
 {category:"Serie TV", question:"Nella serie TV Stranger Things, come si chiama la dimensione parallela oscura?", options:["Sottosopra","Zona d'Ombra","Mondo Nero","Oltreterra"], correctIndex:0},
 {category:"Tecnologia", question:"Quale social network è nato originariamente come app per condividere foto quadrate?", options:["TikTok","Instagram","Snapchat","Pinterest"], correctIndex:1},
 {category:"Scienze", question:"Quale tra questi animali è un mammifero?", options:["Squalo bianco","Delfino","Pinguino","Coccodrillo"], correctIndex:1},
 {category:"Musica", question:"Che canzone è?", options:["Certe notti","Gli ostacoli del cuore","Piccola stella senza cielo","Urlando contro il cielo"], correctIndex:1, adminNote:"Ligabue"},
 {category:"Sport", question:"Quale Paese ha ospitato le Olimpiadi estive del 2016?", options:["Cina","Brasile","Giappone","Regno Unito"], correctIndex:1},
 {category:"Cinema", question:"Quale tra questi personaggi appartiene all'universo Marvel?", options:["Aquaman","Flash","Doctor Strange","Green Lantern"], correctIndex:2},
];
const QF = [
 {category:"Geografia", question:"Quale Stato ha come capitale Canberra?", options:["Nuova Zelanda","Australia","Canada","Sudafrica"], correctIndex:1},
 {category:"Filosofia", question:"Quale filosofo greco fu maestro di Alessandro Magno?", options:["Socrate","Platone","Aristotele","Epicuro"], correctIndex:2},
 {category:"Matematica", question:"Una password è composta da 2 lettere seguite da 2 numeri. Se le lettere possibili sono 26 e i numeri possibili sono 10, quante combinazioni esistono?", options:["6.760","67.600","676.000","760.000"], correctIndex:1},
 {category:"Scienze", question:"Quale gas è più abbondante nell'atmosfera terrestre?", options:["Ossigeno","Azoto","Anidride carbonica","Argon"], correctIndex:1},
 {category:"Cinema", question:"Quale regista ha diretto Inception?", options:["Christopher Nolan","Martin Scorsese","David Fincher","Quentin Tarantino"], correctIndex:0},
 {category:"Sport", question:"In quale sport si assegna il Pallone d'Oro?", options:["Basket","Calcio","Rugby","Tennis"], correctIndex:1},
 {category:"Geografia", question:"Quale tra questi Paesi non fa parte della Scandinavia in senso stretto?", options:["Norvegia","Svezia","Danimarca","Finlandia"], correctIndex:3},
 {category:"Tecnologia", question:"Quale azienda produce la console PlayStation?", options:["Microsoft","Nintendo","Sony","Sega"], correctIndex:2},
 {category:"Serie TV", question:"Quale serie TV ha come protagonista Thomas Shelby?", options:["Peaky Blinders","The Crown","Vikings","Boardwalk Empire"], correctIndex:0},
 {category:"Storia", question:"Quale tra questi eventi è avvenuto per primo?", options:["Primo uomo sulla Luna","Caduta del Muro di Berlino","Nascita di Internet commerciale","Attentati dell'11 settembre 2001"], correctIndex:0},
];
const DEFAULT_SCORING = {correct:1, wrong:0, noAnswer:0};
const CATEGORIES =["Geografia","Storia","Matematica","Musica","Scienze","Cinema","Sport","Serie TV","Tecnologia","Videogiochi","Filosofia","Arte","Letteratura","Attualità e Società","Natura e Animali","Mitologia","Food e Bevande","Moda e Costume","Fumetti e Anime","Cartoni Animati e Disney","Curiosità e Record"];
/* PL-18 (item 15): contratto comune della domanda. */
const CONTENT_TYPES = ['testo','immagine','audio','video'];
const ANSWER_TYPES = ['scelta','vero_falso','ordinamento','numero','testo_libero'];
const ANSWER_POLICIES = ['definitiva','modificabile'];
const DIFFICULTIES = ['facile','media','difficile'];
/* Applicata in lettura (non richiede una migrazione manuale delle domande
   già salvate, incluse le seed Q1/Q2/QF sotto): oggi solo answerType:'scelta'
   ha davvero un motore di gioco (le altre 4 opzioni sono dichiarabili e
   validate dal question manager, ma non ancora giocabili — arriveranno con
   PL-19/20/21). presentation/sharedScreenRequirement sono i due campi
   riservati da PL-11 per un futuro motore di presentazione/schermo
   condiviso: qui diventano campi reali, modificabili dal question manager,
   ma nessun ramo di codice li legge ancora per cambiare comportamento
   (nessun nuovo motore in questo pacchetto). Nota: fonde 'q' PRIMA di
   applicare i default con '||', non uno spread the-defaults-poi-q — uno
   spread con q.campo===undefined sovrascriverebbe silenziosamente il
   default con undefined. */
function withQuestionDefaults(q){
  if(!q) return q;
  return {
    ...q,
    contentType: q.contentType || 'testo',
    answerType: q.answerType || 'scelta',
    tolerance: q.tolerance != null ? q.tolerance : null,
    answerPolicy: q.answerPolicy || 'definitiva',
    difficulty: q.difficulty || 'media',
    presentation: q.presentation || {mode: 'inherit'},
    sharedScreenRequirement: !!q.sharedScreenRequirement
  };
}
/* Le domande giocate in una partita vivono in state.gameQuestions (pescate dal
   mazzo Firebase all'avvio di ogni fase). Q1/Q2/QF restano solo come mazzo
   "di partenza" con cui popolare il database la prima volta che l'app parte
   a banca dati vuota (vedi ensureSeedQuestions). */
function getList(round){
  const gq = gameQuestions;
  if(!gq) return [];
  if(round==='final') return gq.final || [];
  if(round==='tiebreak') return gq.tiebreak ? [gq.tiebreak] : [];
  if(gq.rounds && gq.rounds[round]) return gq.rounds[round];
  return [];
}
function getQuestion(round, idx){ return withQuestionDefaults(getList(round)[idx]); }
function qkey(round, idx){ return round+'-'+idx; }
/* Tempo autorevole condiviso (PL-11): Date.now() del solo client admin non è
   affidabile se il suo orologio è sfasato. serverNow() lo corregge con
   l'offset misurato da Firebase su '.info/serverTimeOffset' (vedi
   startListening), così il countdown converge tra dispositivi anche con
   orologi diversi. Usata solo nei punti critici per il timer/i timestamp di
   risposta; il resto del codice (joinedAt, createdAt, audioCue, ecc.) resta
   su Date.now(), nessuna riscrittura generale. */
function serverNow(){ return Date.now() + serverTimeOffset; }

/* ================== APP STATE (locale) ================== */
let role = null;          // 'admin' | 'team'
let teamId = null;
let teamName = null;
let joined = false;
let listening = false;
let uiTickTimer = null;
let standingsAutoPlayTimer = null; // locale: guida "rivelazione automatica" solo dal lato admin che l'ha avviata
let pendingSubmitKey = null; // qkey della domanda per cui è in corso un invio risposta: blocca subito
                              // i pulsanti (PL-06), anche attraverso i re-render del tick ogni 250ms,
                              // finché la transazione non si risolve
let connected = true;     // stato connessione Firebase (.info/connected)
let bootStatus = 'connecting'; // 'connecting' | 'ready' | 'timeout': stato del primo caricamento,
                                // prima che arrivi il primissimo snapshot da Firebase (vedi FT-04)
let bootTimeoutTimer = null;
const BOOT_TIMEOUT_MS = 8000;
let serverTimeOffset = 0; // differenza (ms) tra l'orologio del server Firebase e quello di questa
                           // scheda, letta da '.info/serverTimeOffset' (PL-11): serverNow() la usa
                           // ovunque il conto alla rovescia deve restare autorevole anche con
                           // l'orologio locale sfasato.
let displayHeartbeatTimer = null; // battito di presenza per il ruolo 'display' (PL-11, item 9)

let state = null;         // stato di gioco condiviso
let gameQuestions = null; // domande estratte per questa partita (ramo separato, PL-09): {rounds, final, tiebreak}
let teams = {};           // id -> {id, name}
let answersByTeam = {};   // id -> {qkey: {optionIndex, ts}}
let overridesByTeam = {}; // id -> {qkey: points}
let questionBank = {};    // id -> domanda (persiste tra una partita e l'altra)
let presenceByTeam = {};  // id -> {connId: {connectedAt}} (dispositivi collegati in questo momento)
let presenceConnId = null; // id di connessione locale per questa scheda, stabile finché resta aperta
let showQuestionManager = false; // toggle locale (solo per questo admin), non condiviso
let showAdvancedSetup = false; // toggle locale: sezione "impostazioni avanzate" della Sala pre-partita
let scoringDefaults = DEFAULT_SCORING; // punteggio di default, persiste tra le partite
let showScoringSettings = false; // toggle locale (solo per questo admin), non condiviso
let soundEffects = {};    // id -> effetto sonoro (persiste tra una partita e l'altra)
let presets = {};         // id -> {id, name, config, createdAt}: preset di configurazione salvati (PL-12), persistono tra una partita e l'altra
let showEffectsManager = false; // toggle locale (solo per questo admin), non condiviso
let showHistoryLog = false; // toggle locale: pannello "storico azioni" nel pannello di regia
let showPartyDeckManager = false; // toggle locale: gestione mazzi Party (aggiungi/elimina carte)
let lastPlayedAudioNonce = null; // locale, mai su Firebase: evita di ri-suonare lo stesso cue
let audioUnlocked = false; // locale: se questa scheda ha già sbloccato l'autoplay audio

let partyDecks = {normale:[], extreme:[]}; // mazzi Modalità Party, letti da Firebase (mazzi/normale, mazzi/extreme)
let partyPopupSlot = null;        // locale, solo per questo admin: quale slot ('bonus'|'malus'|'surprise') ha il popup di pesca privata aperto
let partyManualListOpen = false;  // locale: se dentro il popup è aperta la lista di scelta manuale (deve sopravvivere ai re-render ogni 250ms)
let lastPartyCardSeen = {bonus:null, malus:null, surprise:null}; // locale, mai su Firebase: evita di ripetere l'animazione di reveal già vista

function defaultState(){
  return {
    gameName: 'Quizzettone',
    setupLocked: false,
    joinCode: null, // generato da ensureJoinCode() al primo caricamento admin, non qui: va lo stesso per tutti
    phase:'lobby', round:1, qIndex:0,
    // Timer sincronizzato: unica fonte di verità condivisa (non un'animazione
    // locale) -- 'status' pilota sia il conto alla rovescia sia la chiusura
    // automatica delle risposte, uguale per admin/display/squadre.
    timer: {status:'idle', startedAt:null, durationMs:20000, pausedRemainingMs:null, closeReason:null, closedBy:null},
    cancelledQuestions:[], // qkey delle domande annullate: non assegnano punti a nessuno
    // Storico minimo: 'last' è l'unico livello di "annulla ultima azione"
    // (snapshot del path prima della modifica); 'log' è solo per la
    // visualizzazione, non usato per il ripristino.
    history: {last:null, log:[]},
    checkpoint:null, checkpointMode:null,
    finalists:null, eliminated:null,
    tiebreak:null, winner:null, finalWinnerScoreSnapshot:null,
    standingsVisible:false, solutionRevealed:false, scoringOverrides:{}, standingsReveal:null,
    audioCue:null,
    gameId:null, // generato ad ogni avvio partita, usato come chiave in statsHistory/<gameId>
    testMode:false, // rehearsal pre-partita con squadre fittizie (isTest:true), mai attivo a config bloccata
    partyMode:'none', party:{bonus:null, malus:null, surprise:null},
    // Fondamenta per una futura modalità a schermo condiviso (PL-11, scope
    // ridotto da PROPOSTA_SCHERMO_CONDIVISO_completa.md): resolvedMode viene
    // risolto una sola volta da resolvePresentationMode() all'avvio partita
    // (adminStartGame), non ricalcolato a ogni render. fallbackActive è un
    // interruttore per-domanda ("Mostra domanda sui telefoni"), azzerato
    // ogni volta che si apre una nuova domanda.
    presentation: {resolvedMode:null, fallbackActive:false},
    // Regole di gioco: vivono nello stato Firebase della partita invece di essere
    // valori hardcoded nel codice. L'admin le imposta nella Sala pre-partita
    // prima dello start; alcuni campi (finalScoring, scoreCarryover, tiebreakRule,
    // answerVisibilityForEliminated) vengono già salvati qui ma il loro
    // comportamento differenziato viene applicato nelle fasi successive.
    config: {
      version: 0, // incrementato a ogni adminSaveSetup riuscito (PL-10): un contatore di
                  // versione grezzo, non ancora usato per invalidare nulla da solo.
      rounds: 2,
      questionsPerRound: [15, 15],
      finalistCount: 2,
      finalQuestionCount: 10,
      tiebreakCandidateCount: 5,
      questionDurationMs: 20000,
      timerStartMode: 'auto', // 'auto' | 'manual': parte da solo o l'host lo avvia a comando
      scoring: {correct:1, wrong:0, noAnswer:0},
      finalScoring: null, // null = usa 'scoring' anche in finale
      scoreCarryover: 'reset', // 'reset' | 'keep' | 'convert' (PL-16: letto davvero da totalScore())
      // PL-16: credito iniziale per 'convert', in percentuale di
      // config.scoring.correct, per posizione di qualificazione (1ª, 2ª,
      // 3ª, ...); oltre l'ultima voce, 0%. Scala suggerita dal piano §4.3
      // (+30%/+20%/+10% per le prime tre posizioni); non ancora modificabile
      // dall'admin in Sala pre-partita (solo il default), coerente con lo
      // stesso scope "tabella riservata" già scelto per dynamicScoring in PL-13.
      finalistBonusTable: [30, 20, 10],
      tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
      lateJoin: {policy:'until_round1_end'}, // 'always' | 'until_round1_end' | 'blocked_after_start'
      checkpointMinQuestions: 4,
      blockDuplicateQuestions: true,
      answerVisibilityForEliminated: 'after_reveal', // 'secret' | 'after_reveal' | 'live'
      // Bonus velocità: esplicito e annunciato alle squadre (mai una
      // correzione silenziosa), scala linearmente da maxBonus a 0 entro
      // windowMs dall'apertura della domanda; si applica solo se la risposta
      // è corretta ed è calcolato una sola volta al momento dell'invio.
      speedBonus: {enabled:false, maxBonus:0, windowMs:0},
      // 'team_devices' (oggi, default) | 'shared_screen' | 'hybrid' (PL-11):
      // governa solo se lo sblocco delle risposte è immediato o manuale
      // (vedi resolvePresentationMode/answerUnlockPolicyFor); nessuna vista
      // Display dedicata è costruita in questo pacchetto.
      displayMode: 'team_devices',
      // PL-13 (motore di scoring a profili): solo plumbing in questo
      // pacchetto, per decisione esplicita presa durante l'esecuzione (vedi
      // PROGRESS_LOG.md). 'classico' è l'UNICO profilo che il codice legge
      // davvero oggi (pointsForAnswer/scoringFor invariati per qualunque
      // valore di scoringProfile): selezionare 'dinamico'/'personalizzato'
      // NON cambia ancora il punteggio calcolato. dynamicScoring porta i
      // valori di default dichiarati da Piano_modifiche_Quizzettone.md §4.2
      // (tabella bonus d'ordine, fasce di penalità/rimonta), riservati per
      // PL-14 (bonus ordine) e PL-15 (penalità adattiva + rimonta), che li
      // leggeranno davvero.
      scoringProfile: 'classico', // 'classico' | 'dinamico' | 'personalizzato'
      dynamicScoring: {
        // % di bonus per le prime N risposte corrette, in ordine di arrivo
        // (PL-14); dalla posizione successiva alla lunghezza dell'array, 0%.
        orderBonusPercents: [25, 20, 15, 10, 5],
        // aliquota di errore sul valore base (config.scoring.correct),
        // moltiplicata per errorMultiplier della fascia (PL-15).
        wrongPenaltyRate: 0.20,
        // fasce di classifica congelata prima dell'apertura della domanda
        // (PL-15): maxPercentile è il limite superiore (inclusivo) della
        // fascia, in percentuale di squadre partendo dalla testa classifica.
        penaltyBands: [
          {maxPercentile:10, errorMultiplier:2.00, comebackBonusPercent:0},
          {maxPercentile:25, errorMultiplier:1.75, comebackBonusPercent:0},
          {maxPercentile:50, errorMultiplier:1.40, comebackBonusPercent:2},
          {maxPercentile:75, errorMultiplier:1.10, comebackBonusPercent:5},
          {maxPercentile:100, errorMultiplier:0.70, comebackBonusPercent:8}
        ]
      }
    }
  };
}

/* Unico punto di retrocompatibilità: qualunque stato letto da Firebase (anche
   uno vecchio, salvato prima che esistesse 'config', o una partita in corso
   quando questo codice viene distribuito) viene fuso con i default correnti
   invece di rompersi per un campo mancante. Party Mode viaggia già dentro
   'state' da prima e viene preservata dallo spread additivo qui sotto. */
function withDefaults(raw){
  const base = defaultState();
  if(!raw) return base;
  const merged = {...base, ...raw};
  merged.config = {...base.config, ...(raw.config||{})};
  merged.config.scoring = {...base.config.scoring, ...((raw.config||{}).scoring||{})};
  merged.config.tiebreakRule = {...base.config.tiebreakRule, ...((raw.config||{}).tiebreakRule||{})};
  merged.config.lateJoin = {...base.config.lateJoin, ...((raw.config||{}).lateJoin||{})};
  merged.config.dynamicScoring = {...base.config.dynamicScoring, ...((raw.config||{}).dynamicScoring||{})};
  merged.party = {...base.party, ...(raw.party||{})};
  merged.timer = {...base.timer, ...(raw.timer||{})};
  merged.history = {...base.history, ...(raw.history||{})};
  merged.presentation = {...base.presentation, ...(raw.presentation||{})};
  // Migrazione del vecchio timer piatto (questionStartedAt/timerDuration) verso state.timer
  if(raw.questionStartedAt && !raw.timer){
    merged.timer = {status:'running', startedAt:raw.questionStartedAt, durationMs:raw.timerDuration||20000, pausedRemainingMs:null, closeReason:null, closedBy:null};
  }
  return merged;
}

/* Stesso spirito di withDefaults, ma per il ramo separato questionInstances
   (PL-09, era il campo state.gameQuestions): normalizza la vecchia forma
   {round1, round2} verso {rounds:{1,2,...}}. Usata sia dal listener sia
   dalla migrazione one-shot dei dati piatti. */
function withGameQuestionsDefaults(raw){
  if(!raw) return null;
  if((raw.round1 || raw.round2) && !raw.rounds){
    return {
      rounds: {1: raw.round1||[], 2: raw.round2||[]},
      final: raw.final||null,
      tiebreak: raw.tiebreak||null
    };
  }
  return raw;
}

/* Un solo listener realtime su tutto il nodo del gioco, al posto del polling
   ogni 1.1s: Firebase applica gli aggiornamenti in locale in modo pressoché
   istantaneo, anche per le scritture fatte da questo stesso client. */
function startListening(){
  if(listening) return;
  listening = true;
  // Se il primo snapshot non arriva, non deve restare una schermata bianca:
  // mostriamo subito uno stato "connessione in corso" e, se entro
  // BOOT_TIMEOUT_MS non è ancora arrivato nulla, uno stato di errore con
  // un comando di retry esplicito (vedi anche il callback di errore sotto).
  if(!state){
    bootStatus = 'connecting';
    render();
    bootTimeoutTimer = setTimeout(()=>{
      if(!state){ bootStatus = 'timeout'; render(); }
    }, BOOT_TIMEOUT_MS);
  }
  db.ref(DB_ROOT).on('value', snap=>{
    if(bootTimeoutTimer){ clearTimeout(bootTimeoutTimer); bootTimeoutTimer = null; }
    bootStatus = 'ready';
    const all = snap.val() || {};
    // Rami reali sotto sessions/current/... (PL-09), niente più smistamento
    // per prefisso stringa su un unico nodo piatto. questionBank/soundEffects
    // sono già chiavate per id (addQuestion/addEffect scrivono su
    // questionBankPath(id)/soundEffectPath(id) con entry.id===id), quindi non
    // serve più ricostruirle a mano leggendo entry.id da ogni valore.
    const session = (all.sessions && all.sessions[SESSION_ID]) || {};
    teams = session.teams || {};
    answersByTeam = session.answers || {};
    overridesByTeam = session.scoreLedger || {};
    presenceByTeam = session.presence || {};
    // PL-18: applica il contratto comune in lettura, così le domande
    // salvate prima di questo pacchetto restano valide senza migrazione.
    const rawQuestionBank = all.questionBank || {};
    questionBank = {};
    Object.keys(rawQuestionBank).forEach(id=>{ questionBank[id] = withQuestionDefaults(rawQuestionBank[id]); });
    soundEffects = all.soundEffects || {};
    presets = all.presets || {};
    scoringDefaults = all.scoringDefaults || DEFAULT_SCORING;
    state = withDefaults(session.state);
    gameQuestions = withGameQuestionsDefaults(session.questionInstances);
    partyDecks = {
      normale: (all.mazzi && all.mazzi.normale) || [],
      extreme: (all.mazzi && all.mazzi.extreme) || []
    };
    // La migrazione va fatta (e completata) PRIMA di ensureSeedQuestions/
    // ensureJoinCode: quelle due decidono cosa scrivere in base a 'state'/
    // 'questionBank' locali, che su QUESTO snapshot possono ancora essere i
    // default pre-migrazione (session.state non esiste ancora finché
    // l'update() della migrazione non ha fatto arrivare un nuovo snapshot).
    // Se la migrazione ha davvero spostato qualcosa, si salta il resto di
    // questo giro: il prossimo snapshot (innescato dallo stesso update())
    // arriverà con i dati già a posto e le funzioni ensure* gireranno su
    // valori corretti invece che su placeholder appena azzerati.
    if(role==='admin'){
      migrateFlatStateToSessions(all).then(migrated=>{
        if(!migrated){ ensureSeedQuestions(); ensureSeedPartyDecks(); ensureJoinCode(); }
      });
      ensureOrderBonusComputed();
    }
    render();
  }, err=>{
    console.error('listener fallito', err);
    if(bootTimeoutTimer){ clearTimeout(bootTimeoutTimer); bootTimeoutTimer = null; }
    if(!state){ bootStatus = 'timeout'; render(); }
  });
  db.ref('.info/connected').on('value', snap=>{
    connected = snap.val() === true;
    // Va riarmata a ogni riconnessione (non una sola volta al boot): onDisconnect()
    // è valido solo per la connessione WebSocket corrente, quindi dopo ogni caduta
    // e ripresa della rete va registrato di nuovo, altrimenti l'uscita non verrebbe
    // più rilevata la volta successiva.
    if(connected && role==='team' && teamId) armPresence(teamId);
    if(connected && role==='display') armDisplayPresence();
    render();
  });
  db.ref('.info/serverTimeOffset').on('value', snap=>{
    serverTimeOffset = snap.val() || 0;
  });
  startUiTick();
}
function stopListening(){
  db.ref(DB_ROOT).off('value');
  db.ref('.info/connected').off('value');
  db.ref('.info/serverTimeOffset').off('value');
  if(role==='display') disarmDisplayPresence();
  listening = false;
  if(uiTickTimer){ clearInterval(uiTickTimer); uiTickTimer = null; }
  if(bootTimeoutTimer){ clearTimeout(bootTimeoutTimer); bootTimeoutTimer = null; }
}
/* Comando "Riprova" mostrato da renderBootScreen() quando il primo snapshot
   non arriva entro BOOT_TIMEOUT_MS: riparte da zero il listener invece di
   lasciare l'utente bloccato su una schermata di errore senza via d'uscita. */
function retryBoot(){
  stopListening();
  bootStatus = 'connecting';
  startListening();
}
/* Migrazione one-shot dal vecchio nodo piatto (chiavi a prefisso stringa
   direttamente sotto DB_ROOT) al nuovo schema a rami sotto sessions/current/
   (PL-09). Guardata come ensureSeedQuestions/ensureJoinCode: gira una sola
   volta per sessione del browser e solo lato Admin. Se non trova nulla di
   vecchio da migrare (database nuovo, o già migrato) non fa nulla. Tutte le
   scritture E cancellazioni avvengono in un solo update() atomico, così non
   può mai restare un ibrido a metà tra vecchio e nuovo schema. */
const LEGACY_PREFIXES = ['teaminfo:', 'answers:', 'overrides:', 'teamNames:', 'question:', 'effect:'];
function hasLegacyFlatData(all){
  // 'state' da solo non basta come segnale: Firebase pota silenziosamente un
  // valore {} (un caso reale, non solo teorico -- una partita mai avviata
  // può aver lasciato solo domande in banca e nessuno stato vero), quindi un
  // database può avere chiavi legacy da migrare anche senza 'state'.
  if(all.state) return true;
  return Object.keys(all).some(k => LEGACY_PREFIXES.some(p => k.startsWith(p)));
}
let migrationAttempted = false;
async function migrateFlatStateToSessions(all){
  if(migrationAttempted) return false;
  migrationAttempted = true;
  if(all.sessions && all.sessions[SESSION_ID] && all.sessions[SESSION_ID].state) return false; // già migrato
  if(!hasLegacyFlatData(all)) return false; // database nuovo/vuoto, niente da migrare
  const updates = {};
  const legacyState = {...(all.state||{})};
  const legacyGameQuestions = legacyState.gameQuestions;
  delete legacyState.gameQuestions;
  updates[statePath()] = legacyState;
  updates[questionInstancesPath()] = withGameQuestionsDefaults(legacyGameQuestions) || null;
  if(all.presence) updates[sessionPath('presence')] = all.presence;
  Object.keys(all).forEach(k=>{
    if(k.startsWith('teaminfo:')) updates[teamPath(k.slice('teaminfo:'.length))] = all[k];
    else if(k.startsWith('answers:')) updates[answersPath(k.slice('answers:'.length))] = all[k];
    else if(k.startsWith('overrides:')) updates[scoreLedgerPath(k.slice('overrides:'.length))] = all[k];
    else if(k.startsWith('teamNames:')) updates[teamNamePath(k.slice('teamNames:'.length))] = all[k];
    else if(k.startsWith('question:')) updates[questionBankPath(k.slice('question:'.length))] = all[k];
    else if(k.startsWith('effect:')) updates[soundEffectPath(k.slice('effect:'.length))] = all[k];
  });
  // Le vecchie chiavi vengono azzerate nella STESSA update(): mai un momento
  // in cui esistono sia la copia vecchia sia quella nuova (a parte durante
  // l'applicazione atomica lato server, che update() garantisce indivisibile).
  updates['state'] = null;
  updates['presence'] = null;
  Object.keys(all).forEach(k=>{
    if(k.startsWith('teaminfo:')||k.startsWith('answers:')||k.startsWith('overrides:')||k.startsWith('teamNames:')||k.startsWith('question:')||k.startsWith('effect:')) updates[k] = null;
  });
  await db.ref(DB_ROOT).update(updates);
  return true;
}
/* Presenza online/offline per squadra: ogni scheda registra una propria
   connessione sotto presence/<teamId>/<connId>, con onDisconnect().remove()
   affinché sparisca automaticamente se la scheda si chiude o perde la rete.
   "Online" = almeno una connessione presente; "dispositivi collegati" = quante. */
function armPresence(teamId){
  presenceConnId = presenceConnId || ('conn_' + Math.random().toString(36).slice(2,10));
  const connRef = db.ref(DB_ROOT + '/' + presencePath(teamId, presenceConnId));
  connRef.onDisconnect().remove();
  connRef.set({connectedAt: firebase.database.ServerValue.TIMESTAMP});
}
function disarmPresence(teamId){
  if(!presenceConnId) return;
  db.ref(DB_ROOT + '/' + presencePath(teamId, presenceConnId)).remove();
}
function isTeamOnline(id){ return !!(presenceByTeam[id] && Object.keys(presenceByTeam[id]).length>0); }
function teamDeviceCount(id){ return presenceByTeam[id] ? Object.keys(presenceByTeam[id]).length : 0; }
/* PL-11 (item 9): stesso pattern di armPresence/disarmPresence sopra, ma per
   un futuro ruolo Display, su presencePath('display', connId). In più tiene
   un battito periodico (lastSeenAt), non solo connectedAt: una vista Display
   futura potrà distinguere "connesso ma bloccato" da "davvero vivo". Nessuna
   UI di questo pacchetto legge questi dati: solo la scrittura è costruita
   qui, verificata dai test leggendo direttamente il ramo Firebase. */
function armDisplayPresence(){
  presenceConnId = presenceConnId || ('conn_' + Math.random().toString(36).slice(2,10));
  const connRef = db.ref(DB_ROOT + '/' + presencePath('display', presenceConnId));
  connRef.onDisconnect().remove();
  const beat = ()=> connRef.set({connected:true, lastSeenAt: firebase.database.ServerValue.TIMESTAMP});
  beat();
  if(displayHeartbeatTimer) clearInterval(displayHeartbeatTimer);
  displayHeartbeatTimer = setInterval(beat, 2500);
}
function disarmDisplayPresence(){
  if(displayHeartbeatTimer){ clearInterval(displayHeartbeatTimer); displayHeartbeatTimer = null; }
  if(!presenceConnId) return;
  db.ref(DB_ROOT + '/' + presencePath('display', presenceConnId)).remove();
}

/* Codice breve per entrare in partita: generato una sola volta (dal primo
   admin che carica la pagina) e poi condiviso da tutti tramite lo stato
   Firebase, così resta stabile invece di cambiare a ogni ricarica. */
function generateJoinCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O/1/I, si confondono facilmente
  let code = '';
  for(let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
let joinCodeEnsureAttempted = false;
async function ensureJoinCode(){
  if(joinCodeEnsureAttempted) return;
  joinCodeEnsureAttempted = true;
  if(state && state.joinCode) return;
  await safeSet(statePath(), {...state, joinCode: generateJoinCode()}, true);
}
function startUiTick(){
  if(uiTickTimer) return;
  uiTickTimer = setInterval(()=>{
    if(!state || state.phase!=='question') return;
    // Qualunque scheda aperta (non solo quella dell'admin) partecipa alla
    // chiusura a scadenza: closeAnswersTransactional è la stessa transazione
    // idempotente usata dal pulsante manuale, quindi più schede che la
    // rilevano nello stesso istante non producono chiusure duplicate.
    if(state.timer && state.timer.status==='running' && timeRemaining()<=0){
      closeAnswersTransactional('expired');
    }
    // Modalità prova: solo il client admin pilota le risposte delle squadre
    // fittizie (le squadre vere rispondono da sole dalla propria scheda).
    if(role==='admin' && state.testMode && state.timer && state.timer.status==='running'){
      simulateTestTeamAnswers();
    }
    render();
  }, 250);
}
async function refresh(){ render(); }

/* ================== LOGICA PUNTEGGI ================== */
/* Punteggio effettivo da congelare nell'istanza al momento dell'apertura
   (PL-10): stessa risoluzione config.finalScoring/config.scoring/
   scoringDefaults di sempre, ma calcolata UNA VOLTA, quando la domanda
   diventa quella corrente, non ogni volta che qualcuno guarda il punteggio.
   'cfg' è opzionale: adminStartGame la passa esplicitamente perché in quel
   punto lo 'state' locale non riflette ancora la config appena scelta. */
function computeEffectiveScoringForOpen(round, cfg){
  cfg = cfg || (state && state.config);
  if(round==='final' && cfg && cfg.finalScoring) return cfg.finalScoring;
  return (cfg && cfg.scoring) || scoringDefaults || DEFAULT_SCORING;
}
/* Ritorna una copia di gameQuestions con 'fields' fuso sulla domanda
   round/idx (tiebreak/final/manche). Pura (nessuna scrittura Firebase qui):
   il chiamante in actions.js decide quando e come persisterla. Fattorizzata
   da PL-10 (era specifica dello scoringSnapshot) per essere riusata anche
   dai timestamp di presentazione di PL-11 (presentedAt/inputUnlockedAt/
   timerStartedAt), stesso identico bisogno: scrivere campi sull'istanza
   della domanda corrente senza toccare teams/answers. */
function applyQuestionInstanceFields(gq, round, idx, fields){
  if(round==='tiebreak'){
    return {...gq, tiebreak: gq.tiebreak ? {...gq.tiebreak, ...fields} : gq.tiebreak};
  }
  if(round==='final'){
    const final = [...(gq.final||[])];
    if(final[idx]) final[idx] = {...final[idx], ...fields};
    return {...gq, final};
  }
  const rounds = {...(gq.rounds||{})};
  const list = [...(rounds[round]||[])];
  if(list[idx]) list[idx] = {...list[idx], ...fields};
  rounds[round] = list;
  return {...gq, rounds};
}
function withScoringSnapshotApplied(gq, round, idx, snapshot){
  return applyQuestionInstanceFields(gq, round, idx, {scoringSnapshot: snapshot});
}
/* PL-11 (item 3): presentedAt/inputUnlockedAt/timerStartedAt sono tre
   momenti distinti invece di un solo "timer partito", scritti sull'istanza
   della domanda corrente (non su state.timer, che resta l'unica fonte di
   verità per il conto alla rovescia live/pausa/ripresa, invariato). */
function withPresentationTimestampsApplied(gq, round, idx, fields){
  return applyQuestionInstanceFields(gq, round, idx, fields);
}
/* PL-11 (item 4): risolve UNA VOLTA sola, all'avvio partita, la modalità di
   presentazione effettiva a partire da config.displayMode. Scritta su
   state.presentation.resolvedMode da adminStartGame e mai più ricalcolata
   nel corso della stessa partita (niente rivalutazione continua a ogni
   render). */
function resolvePresentationMode(cfg){
  return (cfg && cfg.displayMode) || 'team_devices';
}
/* PL-11 (item 5): due sole politiche di sblocco risposte. 'immediate' è il
   comportamento di sempre (lo sblocco coincide con la partenza del timer,
   che sia automatica o manuale via config.timerStartMode); 'manual' è nuova,
   default per shared_screen/hybrid: la domanda si apre bloccata finché
   l'admin non preme esplicitamente "Apri risposte". */
function answerUnlockPolicyFor(resolvedMode){
  return resolvedMode==='team_devices' ? 'immediate' : 'manual';
}
/* Il punteggio "di default" (senza override esplicito) ora viene letto
   dallo snapshot congelato nell'istanza della domanda, non più dalla config
   corrente: cambiare la config a partita in corso non deve poter ricalcolare
   domande già aperte. L'override esplicito per singola domanda
   (adminSetQuestionScoring) resta intenzionalmente sopra allo snapshot,
   perché è proprio lo strumento con cui l'admin corregge un punteggio dopo
   il fatto. Il fallback alla config live resta solo per compatibilità con
   domande aperte prima di questo pacchetto (nessuno snapshot salvato). */
function scoringFor(round, idx){
  const key = qkey(round, idx);
  const override = state && state.scoringOverrides && state.scoringOverrides[key];
  if(override) return override;
  const q = getQuestion(round, idx);
  if(q && q.scoringSnapshot) return q.scoringSnapshot;
  const cfg = state && state.config;
  if(round==='final' && cfg && cfg.finalScoring) return cfg.finalScoring;
  return (cfg && cfg.scoring) || scoringDefaults || DEFAULT_SCORING;
}
/* PL-14/PL-15: il profilo 'dinamico'/'personalizzato' sostituisce il bonus
   velocità lineare (submit-time, profilo classico) con:
   - un bonus per ORDINE di arrivo tra le sole risposte corrette, letto da
     orderBonusAssignments (PL-14, calcolato alla chiusura da
     ensureOrderBonusComputed, non al submit: richiede di conoscere tutte
     le risposte);
   - una penalità/adattiva bonus rimonta basata sulla fascia di classifica
     congelata all'apertura della domanda, letta da leaderboardBands
     (PL-15, computeFrozenLeaderboardBands, scritta dagli stessi punti che
     aprono la domanda — vedi openQuestionWithSnapshot in js/actions.js).
   Serve quindi anche il teamId, che il profilo classico non usa (il suo
   bonus arriva già calcolato dentro 'speedBonus', persistito sulla
   risposta stessa). */
function pointsForAnswer(round, idx, optionIndex, speedBonus, teamId){
  const q = getQuestion(round, idx);
  if(!q) return 0;
  const sc = scoringFor(round, idx);
  const profile = state && state.config && state.config.scoringProfile;
  const dynamic = profile && profile!=='classico';
  const band = dynamic && q.leaderboardBands && teamId ? q.leaderboardBands[teamId] : null;
  if(optionIndex !== q.correctIndex){
    // PL-15: penalità adattiva sostituisce interamente sc.wrong (non si
    // sommano) per i profili dinamico/personalizzato, quando la fascia
    // congelata all'apertura è disponibile per questa squadra; altrimenti
    // (fascia non ancora calcolata, o squadra non attiva a quel momento)
    // resta il malus fisso di sempre.
    if(band){
      const rate = (state.config.dynamicScoring && state.config.dynamicScoring.wrongPenaltyRate) || 0;
      return -Math.round(sc.correct * rate * band.errorMultiplier);
    }
    return sc.wrong;
  }
  if(dynamic){
    const orderBonusPercent = (q.orderBonusAssignments && teamId && q.orderBonusAssignments[teamId]) || 0;
    const comebackBonusPercent = band ? band.comebackBonusPercent : 0;
    return sc.correct
      + Math.round(sc.correct * orderBonusPercent / 100)
      + Math.round(sc.correct * comebackBonusPercent / 100);
  }
  return sc.correct + (speedBonus||0);
}
/* Il bonus velocità va calcolato una sola volta, al momento dell'invio della
   risposta (vedi teamSubmitAnswer), e poi persistito dentro la risposta
   stessa: calcolarlo più tardi confrontando ts con state.timer.startedAt
   darebbe un risultato sbagliato per qualunque domanda diversa da quella
   corrente, perché state.timer.startedAt nel frattempo è già cambiato.
   PL-14: si applica solo al profilo 'classico' — 'dinamico'/'personalizzato'
   usano il bonus d'ordine calcolato alla chiusura (vedi pointsForAnswer). */
function computeSpeedBonusAtSubmission(ts){
  const profile = state && state.config && state.config.scoringProfile;
  if(profile && profile!=='classico') return 0;
  const sb = state && state.config && state.config.speedBonus;
  if(!sb || !sb.enabled) return 0;
  const startedAt = state.timer && state.timer.startedAt;
  if(!startedAt) return 0;
  const elapsed = ts - startedAt;
  const windowMs = sb.windowMs || 0;
  if(windowMs<=0 || elapsed<0 || elapsed>=windowMs) return 0;
  return Math.round(sb.maxBonus * (1 - elapsed/windowMs));
}
/* PL-14: bonus per ordine di arrivo tra le SOLE risposte corrette a questa
   domanda, usando il timestamp server-autorevole (ts, PL-11) di ciascuna.
   Pari-merito a timestamp identico ricevono lo stesso bonus e la
   numerazione prosegue competitiva (due prime a pari tempo sono seguite
   dalla terza posizione, non dalla seconda) — coerente con la tabella del
   piano §4.2. Pura: nessuna scrittura Firebase qui, la fa il chiamante
   (ensureOrderBonusComputed). */
function computeOrderBonusAssignments(round, idx){
  const q = getQuestion(round, idx);
  if(!q) return {};
  const key = qkey(round, idx);
  const table = (state && state.config && state.config.dynamicScoring && state.config.dynamicScoring.orderBonusPercents) || [];
  const correctAnswers = Object.keys(answersByTeam)
    .map(id => ({id, ans: answersByTeam[id] && answersByTeam[id][key]}))
    .filter(x => x.ans && x.ans.optionIndex === q.correctIndex)
    .sort((a,b) => a.ans.ts - b.ans.ts);
  const assignments = {};
  let rank = 0, lastTs = null;
  correctAnswers.forEach((entry, i)=>{
    if(lastTs === null || entry.ans.ts !== lastTs){ rank = i; lastTs = entry.ans.ts; }
    assignments[entry.id] = table[rank] || 0;
  });
  return assignments;
}
/* PL-14: side effect admin-gated, stesso stile di ensureJoinCode/
   ensureSeedQuestions — gira ogni volta che arriva uno snapshot con la
   domanda corrente chiusa, ma scrive una volta sola per partita+domanda
   (dedup su gameId+qkey: qkey da solo si ripeterebbe identico a ogni
   rivincita/reset, dove invece va ricalcolato per la nuova partita). Solo
   per i profili che usano davvero il bonus d'ordine. */
let orderBonusEnsureAttempted = {};
async function ensureOrderBonusComputed(){
  if(!state || state.phase !== 'closed' || !state.gameId) return;
  const profile = state.config && state.config.scoringProfile;
  if(!profile || profile==='classico') return;
  const round = state.round, idx = state.qIndex;
  const dedupKey = state.gameId + ':' + qkey(round, idx);
  if(orderBonusEnsureAttempted[dedupKey]) return;
  const q = getQuestion(round, idx);
  if(!q) return;
  if(q.orderBonusAssignments){ orderBonusEnsureAttempted[dedupKey] = true; return; }
  orderBonusEnsureAttempted[dedupKey] = true;
  const assignments = computeOrderBonusAssignments(round, idx);
  const newGameQuestions = applyQuestionInstanceFields(gameQuestions, round, idx, {orderBonusAssignments: assignments});
  await db.ref(DB_ROOT + '/' + questionInstancesPath()).set(newGameQuestions);
}
function teamPointsForQuestion(id, round, idx){
  const key = qkey(round, idx);
  if(state && state.cancelledQuestions && state.cancelledQuestions.includes(key)) return 0;
  const ov = overridesByTeam[id] && overridesByTeam[id][key];
  if(ov !== undefined && ov !== null) return ov;
  const ans = answersByTeam[id] && answersByTeam[id][key];
  if(!ans) return scoringFor(round, idx).noAnswer;
  return pointsForAnswer(round, idx, ans.optionIndex, ans.speedBonus, id);
}
function roundScore(id, round){
  const list = getList(round);
  let sum = 0;
  for(let i=0;i<list.length;i++) sum += teamPointsForQuestion(id, round, i);
  return sum;
}
function qualificationScore(id){
  const rounds = (state && state.config && state.config.rounds) || 2;
  let sum = 0;
  for(let r=1;r<=rounds;r++) sum += roundScore(id, r);
  return sum;
}
/* PL-16: scoreCarryover era configurabile in Sala pre-partita ma non veniva
   mai letto da nessuna funzione di scoring — il comportamento era sempre
   equivalente a 'keep'. Si applica SOLO alle squadre finaliste (state.
   finalists), e solo quando lo sono già diventate: prima che i finalisti
   siano rivelati, state.finalists è null e questa funzione si comporta
   esattamente come prima (qualificationScore + roundScore('final'), quel
   secondo termine è comunque 0 finché la finale non è iniziata). */
function totalScore(id){
  const isFinalist = !!(state && state.finalists && state.finalists.includes(id));
  if(isFinalist){
    const carryover = (state.config && state.config.scoreCarryover) || 'keep';
    const finalPart = roundScore(id, 'final');
    if(carryover==='reset') return finalPart;
    if(carryover==='convert'){
      const rank = state.finalists.indexOf(id); // 0-based: già ordinato per qualificationScore da adminRevealFinalists
      const table = (state.config && state.config.finalistBonusTable) || [];
      const percent = table[rank] || 0;
      const sc = (state.config && state.config.scoring) || DEFAULT_SCORING;
      const credit = Math.round((sc.correct||0) * percent / 100);
      return credit + finalPart;
    }
  }
  return qualificationScore(id) + roundScore(id,'final');
}
/* PL-15: fascia di rischio/rimonta in base alla POSIZIONE consolidata
   (totalScore, la stessa classifica già mostrata nel pannello di regia) tra
   le squadre attive per il round, congelata al momento dell'apertura della
   domanda — non ricalcolata più tardi, anche se il punteggio delle altre
   squadre cambia nel frattempo mentre si risponde (coerente con lo
   scoringSnapshot di PL-10, stesso principio). 'ids' è l'elenco delle
   squadre attive per il round, passato dal chiamante (che ha accesso ad
   activeTeamsForRound, in js/render.js): tenerlo come parametro invece di
   richiamarlo da qui mantiene questa funzione pura e testabile in
   isolamento, senza dipendere da js/render.js essendo caricato. Pura:
   nessuna scrittura Firebase qui, la fa il chiamante (vedi
   openQuestionWithSnapshot in js/actions.js). */
function computeFrozenLeaderboardBands(ids){
  const bands = (state && state.config && state.config.dynamicScoring && state.config.dynamicScoring.penaltyBands) || [];
  if(!ids || !ids.length || !bands.length) return {};
  const ranked = [...ids].map(id=>({id, score: totalScore(id)})).sort((a,b)=>b.score-a.score);
  const n = ranked.length;
  const result = {};
  // Numerazione competitiva sul punteggio, stesso principio di
  // computeOrderBonusAssignments: squadre a pari punti condividono la
  // stessa posizione (e quindi la stessa fascia), non vengono divise in
  // ordine arbitrario. Rilevante soprattutto a inizio partita, quando più
  // squadre possono essere ancora a pari merito a 0 punti.
  let rank = 0, lastScore = null;
  ranked.forEach((entry, i)=>{
    if(lastScore === null || entry.score !== lastScore){ rank = i; lastScore = entry.score; }
    const percentile = ((rank+1) / n) * 100; // 1° posto = percentile più basso (fascia di testa)
    const band = bands.find(b => percentile <= b.maxPercentile) || bands[bands.length-1];
    result[entry.id] = {errorMultiplier: band.errorMultiplier, comebackBonusPercent: band.comebackBonusPercent};
  });
  return result;
}

/* Spareggio: 'prima_corretta' e 'corretta_veloce' collassano nello stesso
   calcolo con una sola domanda di spareggio (chi risponde correttamente per
   primo È anche il più veloce tra i corretti). Per 'a_oltranza'/'numerica', o
   se nessuno risponde correttamente, non c'è un vincitore automatico: resta
   un caso ambiguo su cui interviene l'admin (il pulsante di assegnazione
   manuale è sempre disponibile per ogni candidato). */
function computeTiebreakAutoWinner(){
  const tb = state && state.tiebreak;
  if(!tb || !tb.question || !tb.candidates) return null;
  const rule = tb.forFinal
    ? (state.config && state.config.tiebreakRule && state.config.tiebreakRule.final)
    : (state.config && state.config.tiebreakRule && state.config.tiebreakRule.qualification);
  if(rule!=='prima_corretta' && rule!=='corretta_veloce') return null;
  const key = qkey('tiebreak', tb.qIndex);
  const correctIndex = tb.question.correctIndex;
  const answeredCorrectly = tb.candidates
    .map(id=>({id, ans: answersByTeam[id] && answersByTeam[id][key]}))
    .filter(c=>c.ans && c.ans.optionIndex===correctIndex)
    .sort((a,b)=>a.ans.ts-b.ans.ts);
  return answeredCorrectly.length ? answeredCorrectly[0].id : null;
}

/* Checklist pre-partita: scansione di sola lettura del mazzo di domande,
   confrontato con le regole scelte nella Sala pre-partita, per far notare
   all'admin i problemi PRIMA di avviare (non blocca lo start, è solo un
   avviso: l'admin resta libero di procedere comunque). */
function computePreGameChecklist(){
  const issues = [];
  const questions = Object.values(questionBank);
  const invalid = questions.filter(q=>!q.options || q.options.length<4 || q.options.some(o=>!o || !String(o).trim()) || typeof q.correctIndex!=='number' || q.correctIndex<0 || q.correctIndex>3);
  if(invalid.length) issues.push({type:'invalid', detail:`${invalid.length} domande senza risposta corretta valida o con opzioni vuote`});

  // Confronta testo+opzioni, non il solo testo: alcune domande riusano
  // volutamente lo stesso prompt (es. round "che canzone è?" con opzioni
  // diverse ogni volta), quindi non sono duplicati veri.
  const seen = {};
  questions.forEach(q=>{
    const norm = (q.question||'').trim().toLowerCase() + '|' + (q.options||[]).map(o=>(o||'').trim().toLowerCase()).join('|');
    if((q.question||'').trim()) seen[norm] = (seen[norm]||0) + 1;
  });
  const duplicateGroups = Object.values(seen).filter(c=>c>1).length;
  if(duplicateGroups) issues.push({type:'duplicates', detail:`${duplicateGroups} testi di domanda duplicati nel mazzo`});

  const emptyCategories = CATEGORIES.filter(cat=>!questions.some(q=>q.category===cat && q.pool==='manche'));
  if(emptyCategories.length) issues.push({type:'empty_categories', detail:`Categorie senza domande manche: ${emptyCategories.join(', ')}`});

  const cfg = (state && state.config) || defaultState().config;
  const mancheNeeded = cfg.questionsPerRound.reduce((a,b)=>a+b, 0);
  const mancheAvailable = questions.filter(q=>q.pool==='manche').length;
  if(mancheAvailable < mancheNeeded) issues.push({type:'insufficient_manche', detail:`Servono ${mancheNeeded} domande manche, disponibili ${mancheAvailable}`});

  const finaleNeeded = cfg.finalQuestionCount + cfg.tiebreakCandidateCount;
  const finaleAvailable = questions.filter(q=>q.pool==='finale').length;
  if(finaleAvailable < finaleNeeded) issues.push({type:'insufficient_finale', detail:`Servono almeno ${finaleNeeded} domande finale (comprese quelle di riserva per lo spareggio), disponibili ${finaleAvailable}`});

  return issues;
}

/* Squadre fittizie (Modalità prova) sempre escluse dalle statistiche reali. */
function realTeamIds(){
  return Object.keys(teams).filter(id=>!(teams[id] && teams[id].isTest));
}

/* Statistiche finali: snapshot di sola lettura calcolato a fine partita
   (podio, % corrette, domanda più facile/difficile, squadra più veloce,
   miglior rimonta), persistito in statsHistory/<gameId> così sopravvive a un
   reset o a una rivincita. "Squadra più veloce" confronta i timestamp di
   risposta tra squadre sulla STESSA domanda (mai un tempo assoluto dall'apertura,
   che per domande passate non è più ricostruibile in modo affidabile - vedi
   nota su computeSpeedBonusAtSubmission). */
function computeFinalStats(){
  const ids = realTeamIds();
  if(!ids.length) return null;
  const rounds = [];
  for(let r=1; r<=((state.config && state.config.rounds)||0); r++) rounds.push(r);
  if(state.finalists && state.finalists.length) rounds.push('final');

  let totalAnswered = 0, totalCorrect = 0;
  const perQuestion = [];
  const teamDelaySum = {}, teamDelayCount = {};
  ids.forEach(id=>{ teamDelaySum[id]=0; teamDelayCount[id]=0; });

  rounds.forEach(round=>{
    const list = getList(round);
    const roundTeams = round==='final' ? (state.finalists||[]).filter(id=>ids.includes(id)) : ids;
    list.forEach((q, idx)=>{
      const key = qkey(round, idx);
      if(state.cancelledQuestions && state.cancelledQuestions.includes(key)) return;
      let correctCount=0, answeredCount=0, minTs=null;
      const correctTsById = {};
      roundTeams.forEach(id=>{
        const ans = answersByTeam[id] && answersByTeam[id][key];
        if(!ans) return;
        answeredCount++;
        if(ans.optionIndex===q.correctIndex){
          correctCount++;
          correctTsById[id] = ans.ts;
          if(minTs===null || ans.ts<minTs) minTs = ans.ts;
        }
      });
      totalAnswered += answeredCount;
      totalCorrect += correctCount;
      if(answeredCount>0) perQuestion.push({round, idx, category:q.category, question:q.question, correctCount, answeredCount, rate: correctCount/answeredCount});
      if(minTs!==null){
        Object.keys(correctTsById).forEach(id=>{
          teamDelaySum[id] += (correctTsById[id]-minTs);
          teamDelayCount[id] += 1;
        });
      }
    });
  });

  const podium = ids.map(id=>({id, name:teams[id].name, score:totalScore(id)}))
    .sort((a,b)=>b.score-a.score).slice(0,3);

  const accuracy = totalAnswered>0 ? Math.round((totalCorrect/totalAnswered)*100) : null;

  let hardestQuestion=null, easiestQuestion=null;
  perQuestion.forEach(pq=>{
    if(!hardestQuestion || pq.rate<hardestQuestion.rate) hardestQuestion=pq;
    if(!easiestQuestion || pq.rate>easiestQuestion.rate) easiestQuestion=pq;
  });

  let fastestTeam=null;
  ids.forEach(id=>{
    if(teamDelayCount[id]>0){
      const avgDelayMs = Math.round(teamDelaySum[id]/teamDelayCount[id]);
      if(!fastestTeam || avgDelayMs<fastestTeam.avgDelayMs) fastestTeam = {id, name:teams[id].name, avgDelayMs};
    }
  });

  let bestComeback=null;
  if(state.finalists && state.finalists.length){
    const qualRanked = ids.map(id=>({id, score:qualificationScore(id)})).sort((a,b)=>b.score-a.score);
    const finalRanked = ids.map(id=>({id, score:totalScore(id)})).sort((a,b)=>b.score-a.score);
    const qualRank = {}; qualRanked.forEach((r,i)=>{ qualRank[r.id]=i+1; });
    const finalRank = {}; finalRanked.forEach((r,i)=>{ finalRank[r.id]=i+1; });
    state.finalists.filter(id=>ids.includes(id)).forEach(id=>{
      const improvement = qualRank[id]-finalRank[id]; // positivo = salito in classifica rispetto alla qualificazione
      if(improvement>0 && (!bestComeback || improvement>bestComeback.improvement)){
        bestComeback = {id, name:teams[id].name, improvement, fromRank:qualRank[id], toRank:finalRank[id]};
      }
    });
  }

  return {generatedAt:Date.now(), podium, accuracy, totalAnswered, totalCorrect, hardestQuestion, easiestQuestion, fastestTeam, bestComeback};
}

/* ================== BANCA DOMANDE (Firebase, persiste tra le partite) ================== */
function newQuestionId(){ return 'q_' + Math.random().toString(36).slice(2,10); }

async function addQuestion(q){
  const id = newQuestionId();
  const entry = withQuestionDefaults({
    id, pool:q.pool, category:q.category, question:q.question, options:q.options, correctIndex:q.correctIndex,
    adminNote:q.adminNote||null, audioUrl:q.audioUrl||null, lastUsedAt:null,
    contentType:q.contentType, answerType:q.answerType, tolerance:q.tolerance,
    answerPolicy:q.answerPolicy, difficulty:q.difficulty
  });
  await safeSet(questionBankPath(id), entry, true);
  return id;
}
async function deleteQuestion(id){ await safeDelete(questionBankPath(id), true); }

function parseBulkQuestions(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const parsed = [], errors = [];
  lines.forEach((line, i)=>{
    const parts = line.split('|').map(p=>p.trim());
    if(parts.length<7){ errors.push('Riga '+(i+1)+': mancano dei campi (servono almeno 7 valori separati da "|")'); return; }
    const [pool, category, question, o1,o2,o3,o4, correctRaw, note, audioUrl] = parts;
    if(pool!=='manche' && pool!=='finale'){ errors.push('Riga '+(i+1)+': il pool deve essere "manche" o "finale"'); return; }
    const correct = parseInt(correctRaw, 10);
    if(!correct || correct<1 || correct>4){ errors.push('Riga '+(i+1)+': la colonna della risposta corretta deve essere 1, 2, 3 o 4'); return; }
    if(!category || !question || !o1 || !o2 || !o3 || !o4){ errors.push('Riga '+(i+1)+': un campo obbligatorio è vuoto'); return; }
    parsed.push({pool, category, question, options:[o1,o2,o3,o4], correctIndex:correct-1, adminNote: note || null, audioUrl: audioUrl || null});
  });
  return {parsed, errors};
}
async function bulkAddQuestions(list){
  const updates = {};
  list.forEach(q=>{
    const id = newQuestionId();
    updates[questionBankPath(id)] = withQuestionDefaults({id, pool:q.pool, category:q.category, question:q.question, options:q.options, correctIndex:q.correctIndex, adminNote:q.adminNote, audioUrl:q.audioUrl||null, lastUsedAt:null});
  });
  await db.ref(DB_ROOT).update(updates);
}

/* ================== EFFETTI SONORI (Firebase, persistono tra le partite) ================== */
function newEffectId(){ return 'fx_' + Math.random().toString(36).slice(2,10); }
async function addEffect(name, url){
  const id = newEffectId();
  await safeSet(soundEffectPath(id), {id, name, url, createdAt:Date.now()}, true);
  return id;
}
async function deleteEffect(id){ await safeDelete(soundEffectPath(id), true); }

/* La prima volta che un admin si collega a banca dati vuota, la popoliamo con
   le domande "storiche" (quelle che prima erano fisse nel codice), così il
   gioco resta uguale a prima finché non se ne aggiungono di nuove. */
let seedAttempted = false;
async function ensureSeedQuestions(){
  if(seedAttempted) return;
  seedAttempted = true;
  const existing = await safeList(questionBankPath(), true);
  if(existing.length>0) return;
  const updates = {};
  const seed = (list, pool)=> list.forEach(q=>{
    const id = newQuestionId();
    updates[questionBankPath(id)] = withQuestionDefaults({id, pool, category:q.category, question:q.question, options:q.options, correctIndex:q.correctIndex, adminNote:q.adminNote||null, audioUrl:null, lastUsedAt:null});
  });
  seed(Q1, 'manche'); seed(Q2, 'manche'); seed(QF, 'finale');
  await db.ref(DB_ROOT).update(updates);
}

/* ================== MODALITÀ PARTY (Firebase: quizzettone/mazzi/normale, quizzettone/mazzi/extreme) ==================
   Due mazzi di carte indipendenti dal gioco delle domande. Ogni carta ha un
   testo e un tipo informativo (bonus/malus/generica); il tipo non filtra la
   pesca, serve solo come indicazione per chi la legge ad alta voce. */
function newCardId(){ return 'card_' + Math.random().toString(36).slice(2,10); }
const PARTY_DECK_NORMALE_SEED = [
  {testo:"Bevi un sorso (bonus: scegli chi beve)", tipo:"bonus"},
  {testo:"Alzati e balla 10 secondi", tipo:"generica"},
  {testo:"Canta il ritornello di una canzone a scelta", tipo:"generica"}
];
const PARTY_DECK_EXTREME_SEED = [
  {testo:"Verità o obbligo: rispondi a una domanda scomoda o fai un giro di shot", tipo:"malus"},
  {testo:"Passa il turno: scegli un altro giocatore che deve fare una prova al posto tuo", tipo:"generica"}
];
let partySeedAttempted = false;
async function ensureSeedPartyDecks(){
  if(partySeedAttempted) return;
  partySeedAttempted = true;
  const snap = await db.ref(DB_ROOT + '/mazzi').once('value');
  const existing = snap.val();
  if(existing && ((existing.normale && existing.normale.length) || (existing.extreme && existing.extreme.length))) return;
  const withIds = list => list.map(c=>({id:newCardId(), testo:c.testo, tipo:c.tipo}));
  await db.ref(DB_ROOT + '/mazzi').set({
    normale: withIds(PARTY_DECK_NORMALE_SEED),
    extreme: withIds(PARTY_DECK_EXTREME_SEED)
  });
}
function getPartyMode(){ return (state && state.partyMode) || 'none'; }
function activePartyDeck(){
  const mode = getPartyMode();
  if(mode==='normale') return partyDecks.normale || [];
  if(mode==='extreme') return partyDecks.extreme || [];
  return [];
}
function drawRandomPartyCard(excludeId){
  const deck = activePartyDeck();
  const pool = excludeId ? deck.filter(c=>c.id!==excludeId) : deck;
  if(!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

/* Pesca "count" domande da un pool, ruotando tra le categorie presenti e
   preferendo sempre quelle usate da più tempo (o mai usate). Se il mazzo ha
   meno domande di quelle richieste, restituisce solo quelle disponibili
   invece di ripeterne qualcuna nella stessa partita. */
function drawQuestionsForGame(pool, count, excludeIds){
  excludeIds = excludeIds || [];
  const candidates = Object.values(questionBank).filter(q=>q.pool===pool && !excludeIds.includes(q.id));
  const byCategory = {};
  candidates.forEach(q=>{ (byCategory[q.category] = byCategory[q.category] || []).push(q); });
  Object.values(byCategory).forEach(arr=> arr.sort((a,b)=> (a.lastUsedAt||0) - (b.lastUsedAt||0)) );
  const categories = Object.keys(byCategory).sort(()=>Math.random()-0.5);
  const picked = [], pickedIds = new Set();
  let progress = true;
  while(picked.length<count && progress){
    progress = false;
    for(const cat of categories){
      if(picked.length>=count) break;
      const next = byCategory[cat].find(q=>!pickedIds.has(q.id));
      if(next){ picked.push(next); pickedIds.add(next.id); progress = true; }
    }
  }
  return picked.sort(()=>Math.random()-0.5);
}
async function markQuestionsUsed(questions){
  if(!questions.length) return;
  const updates = {};
  const now = Date.now();
  questions.forEach(q=>{ updates[questionBankPath(q.id)+'/lastUsedAt'] = now; });
  await db.ref(DB_ROOT).update(updates);
}

/* Se la domanda ha un audio associato, genera un "cue" con un nonce nuovo:
   admin e Display lo notano tramite playPendingAudioCueIfAny() e lo suonano. */
function audioCueForQuestion(q){
  if(!q || !q.audioUrl) return null;
  return {url:q.audioUrl, kind:'question', label:q.category, action:'play', startAt:0, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)};
}

/* PL-13: apertura minima per i test unitari sulle funzioni pure di scoring
   (tests/unit/scoring.spec.js). Questo file resta uno script non-modulo
   caricato via <script> in quizzettone.html: 'module' non esiste mai in
   browser, quindi questo blocco non gira e non cambia nulla lì. In Node
   (require() di questo file) espone le funzioni pure e due setter di sola
   comodità per i test, così i test possono preparare lo stato locale
   (altrimenti privato al modulo) senza dover passare da Firebase. */
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    defaultState, withDefaults, withGameQuestionsDefaults,
    qkey, getQuestion, getList,
    computeEffectiveScoringForOpen, withScoringSnapshotApplied, applyQuestionInstanceFields,
    scoringFor, pointsForAnswer, computeSpeedBonusAtSubmission,
    computeOrderBonusAssignments, teamPointsForQuestion,
    computeFrozenLeaderboardBands, totalScore, qualificationScore, roundScore,
    withQuestionDefaults, CONTENT_TYPES, ANSWER_TYPES, ANSWER_POLICIES, DIFFICULTIES,
    resolvePresentationMode, answerUnlockPolicyFor,
    __setTestState: (s)=>{ state = s; },
    __setTestGameQuestions: (gq)=>{ gameQuestions = gq; },
    __setTestScoringDefaults: (sd)=>{ scoringDefaults = sd; },
    __setTestAnswersByTeam: (a)=>{ answersByTeam = a; },
    __setTestOverridesByTeam: (o)=>{ overridesByTeam = o; }
  };
}
