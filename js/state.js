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
/* Le domande giocate in una partita vivono in state.gameQuestions (pescate dal
   mazzo Firebase all'avvio di ogni fase). Q1/Q2/QF restano solo come mazzo
   "di partenza" con cui popolare il database la prima volta che l'app parte
   a banca dati vuota (vedi ensureSeedQuestions). */
function getList(round){
  const gq = state && state.gameQuestions;
  if(!gq) return [];
  if(round==='final') return gq.final || [];
  if(round==='tiebreak') return gq.tiebreak ? [gq.tiebreak] : [];
  if(gq.rounds && gq.rounds[round]) return gq.rounds[round];
  return [];
}
function getQuestion(round, idx){ return getList(round)[idx]; }
function qkey(round, idx){ return round+'-'+idx; }

/* ================== APP STATE (locale) ================== */
let role = null;          // 'admin' | 'team'
let teamId = null;
let teamName = null;
let joined = false;
let listening = false;
let uiTickTimer = null;
let connected = true;     // stato connessione Firebase (.info/connected)

let state = null;         // stato di gioco condiviso
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
let showEffectsManager = false; // toggle locale (solo per questo admin), non condiviso
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
    standingsVisible:false, gameQuestions:null, solutionRevealed:false, scoringOverrides:{}, standingsReveal:null,
    audioCue:null,
    partyMode:'none', party:{bonus:null, malus:null, surprise:null},
    // Regole di gioco: vivono nello stato Firebase della partita invece di essere
    // valori hardcoded nel codice. L'admin le imposta nella Sala pre-partita
    // prima dello start; alcuni campi (finalScoring, scoreCarryover, tiebreakRule,
    // answerVisibilityForEliminated) vengono già salvati qui ma il loro
    // comportamento differenziato viene applicato nelle fasi successive.
    config: {
      rounds: 2,
      questionsPerRound: [15, 15],
      finalistCount: 2,
      finalQuestionCount: 10,
      tiebreakCandidateCount: 5,
      questionDurationMs: 20000,
      timerStartMode: 'auto', // 'auto' | 'manual': parte da solo o l'host lo avvia a comando
      scoring: {correct:1, wrong:0, noAnswer:0},
      finalScoring: null, // null = usa 'scoring' anche in finale
      scoreCarryover: 'reset', // 'reset' | 'keep' | 'convert'
      tiebreakRule: {qualification:'prima_corretta', final:'oltranza'},
      lateJoin: {policy:'until_round1_end'}, // 'always' | 'until_round1_end' | 'blocked_after_start'
      checkpointMinQuestions: 4,
      blockDuplicateQuestions: true,
      answerVisibilityForEliminated: 'after_reveal' // 'secret' | 'after_reveal' | 'live'
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
  merged.party = {...base.party, ...(raw.party||{})};
  merged.timer = {...base.timer, ...(raw.timer||{})};
  merged.history = {...base.history, ...(raw.history||{})};
  // Migrazione della vecchia forma {round1, round2} verso {rounds:{1,2,...}}
  if(raw.gameQuestions && (raw.gameQuestions.round1 || raw.gameQuestions.round2) && !raw.gameQuestions.rounds){
    merged.gameQuestions = {
      rounds: {1: raw.gameQuestions.round1||[], 2: raw.gameQuestions.round2||[]},
      final: raw.gameQuestions.final||null,
      tiebreak: raw.gameQuestions.tiebreak||null
    };
  }
  // Migrazione del vecchio timer piatto (questionStartedAt/timerDuration) verso state.timer
  if(raw.questionStartedAt && !raw.timer){
    merged.timer = {status:'running', startedAt:raw.questionStartedAt, durationMs:raw.timerDuration||20000, pausedRemainingMs:null, closeReason:null, closedBy:null};
  }
  return merged;
}

/* Un solo listener realtime su tutto il nodo del gioco, al posto del polling
   ogni 1.1s: Firebase applica gli aggiornamenti in locale in modo pressoché
   istantaneo, anche per le scritture fatte da questo stesso client. */
function startListening(){
  if(listening) return;
  listening = true;
  db.ref(DB_ROOT).on('value', snap=>{
    const all = snap.val() || {};
    const newTeams = {}, newAnswers = {}, newOverrides = {}, newQuestionBank = {}, newEffects = {};
    Object.keys(all).forEach(k=>{
      if(k.startsWith('teaminfo:')){ if(all[k]) newTeams[all[k].id] = all[k]; }
      else if(k.startsWith('answers:')){ newAnswers[k.slice('answers:'.length)] = all[k] || {}; }
      else if(k.startsWith('overrides:')){ newOverrides[k.slice('overrides:'.length)] = all[k] || {}; }
      else if(k.startsWith('question:')){ if(all[k]) newQuestionBank[all[k].id] = all[k]; }
      else if(k.startsWith('effect:')){ if(all[k]) newEffects[all[k].id] = all[k]; }
    });
    teams = newTeams;
    answersByTeam = newAnswers;
    overridesByTeam = newOverrides;
    questionBank = newQuestionBank;
    soundEffects = newEffects;
    presenceByTeam = all.presence || {};
    scoringDefaults = all.scoringDefaults || DEFAULT_SCORING;
    state = withDefaults(all.state);
    partyDecks = {
      normale: (all.mazzi && all.mazzi.normale) || [],
      extreme: (all.mazzi && all.mazzi.extreme) || []
    };
    if(role==='admin'){ ensureSeedQuestions(); ensureSeedPartyDecks(); ensureJoinCode(); }
    render();
  }, err=>{ console.error('listener fallito', err); });
  db.ref('.info/connected').on('value', snap=>{
    connected = snap.val() === true;
    // Va riarmata a ogni riconnessione (non una sola volta al boot): onDisconnect()
    // è valido solo per la connessione WebSocket corrente, quindi dopo ogni caduta
    // e ripresa della rete va registrato di nuovo, altrimenti l'uscita non verrebbe
    // più rilevata la volta successiva.
    if(connected && role==='team' && teamId) armPresence(teamId);
    render();
  });
  startUiTick();
}
function stopListening(){
  db.ref(DB_ROOT).off('value');
  db.ref('.info/connected').off('value');
  listening = false;
  if(uiTickTimer){ clearInterval(uiTickTimer); uiTickTimer = null; }
}
/* Presenza online/offline per squadra: ogni scheda registra una propria
   connessione sotto presence/<teamId>/<connId>, con onDisconnect().remove()
   affinché sparisca automaticamente se la scheda si chiude o perde la rete.
   "Online" = almeno una connessione presente; "dispositivi collegati" = quante. */
function armPresence(teamId){
  presenceConnId = presenceConnId || ('conn_' + Math.random().toString(36).slice(2,10));
  const connRef = db.ref(DB_ROOT + '/presence/' + teamId + '/' + presenceConnId);
  connRef.onDisconnect().remove();
  connRef.set({connectedAt: firebase.database.ServerValue.TIMESTAMP});
}
function disarmPresence(teamId){
  if(!presenceConnId) return;
  db.ref(DB_ROOT + '/presence/' + teamId + '/' + presenceConnId).remove();
}
function isTeamOnline(id){ return !!(presenceByTeam[id] && Object.keys(presenceByTeam[id]).length>0); }
function teamDeviceCount(id){ return presenceByTeam[id] ? Object.keys(presenceByTeam[id]).length : 0; }

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
  await safeSet('state', {...state, joinCode: generateJoinCode()}, true);
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
    render();
  }, 250);
}
async function refresh(){ render(); }

/* ================== LOGICA PUNTEGGI ================== */
function scoringFor(round, idx){
  const key = qkey(round, idx);
  const override = state && state.scoringOverrides && state.scoringOverrides[key];
  if(override) return override;
  const cfg = state && state.config;
  if(round==='final' && cfg && cfg.finalScoring) return cfg.finalScoring;
  return (cfg && cfg.scoring) || scoringDefaults || DEFAULT_SCORING;
}
function pointsForAnswer(round, idx, optionIndex){
  const q = getQuestion(round, idx);
  if(!q) return 0;
  const sc = scoringFor(round, idx);
  return optionIndex === q.correctIndex ? sc.correct : sc.wrong;
}
function teamPointsForQuestion(id, round, idx){
  const key = qkey(round, idx);
  if(state && state.cancelledQuestions && state.cancelledQuestions.includes(key)) return 0;
  const ov = overridesByTeam[id] && overridesByTeam[id][key];
  if(ov !== undefined && ov !== null) return ov;
  const ans = answersByTeam[id] && answersByTeam[id][key];
  if(!ans) return scoringFor(round, idx).noAnswer;
  return pointsForAnswer(round, idx, ans.optionIndex);
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
function totalScore(id){ return qualificationScore(id) + roundScore(id,'final'); }

/* ================== BANCA DOMANDE (Firebase, persiste tra le partite) ================== */
function newQuestionId(){ return 'q_' + Math.random().toString(36).slice(2,10); }

async function addQuestion(q){
  const id = newQuestionId();
  const entry = {id, pool:q.pool, category:q.category, question:q.question, options:q.options, correctIndex:q.correctIndex, adminNote:q.adminNote||null, audioUrl:q.audioUrl||null, lastUsedAt:null};
  await safeSet('question:'+id, entry, true);
  return id;
}
async function deleteQuestion(id){ await safeDelete('question:'+id, true); }

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
    updates['question:'+id] = {id, pool:q.pool, category:q.category, question:q.question, options:q.options, correctIndex:q.correctIndex, adminNote:q.adminNote, audioUrl:q.audioUrl||null, lastUsedAt:null};
  });
  await db.ref(DB_ROOT).update(updates);
}

/* ================== EFFETTI SONORI (Firebase, persistono tra le partite) ================== */
function newEffectId(){ return 'fx_' + Math.random().toString(36).slice(2,10); }
async function addEffect(name, url){
  const id = newEffectId();
  await safeSet('effect:'+id, {id, name, url, createdAt:Date.now()}, true);
  return id;
}
async function deleteEffect(id){ await safeDelete('effect:'+id, true); }

/* La prima volta che un admin si collega a banca dati vuota, la popoliamo con
   le domande "storiche" (quelle che prima erano fisse nel codice), così il
   gioco resta uguale a prima finché non se ne aggiungono di nuove. */
let seedAttempted = false;
async function ensureSeedQuestions(){
  if(seedAttempted) return;
  seedAttempted = true;
  const existing = await safeList('question:', true);
  if(existing.length>0) return;
  const updates = {};
  const seed = (list, pool)=> list.forEach(q=>{
    const id = newQuestionId();
    updates['question:'+id] = {id, pool, category:q.category, question:q.question, options:q.options, correctIndex:q.correctIndex, adminNote:q.adminNote||null, audioUrl:null, lastUsedAt:null};
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
  questions.forEach(q=>{ updates['question:'+q.id+'/lastUsedAt'] = now; });
  await db.ref(DB_ROOT).update(updates);
}

/* Se la domanda ha un audio associato, genera un "cue" con un nonce nuovo:
   admin e Display lo notano tramite playPendingAudioCueIfAny() e lo suonano. */
function audioCueForQuestion(q){
  if(!q || !q.audioUrl) return null;
  return {url:q.audioUrl, kind:'question', label:q.category, action:'play', startAt:0, triggeredAt:Date.now(), nonce:Math.random().toString(36).slice(2)};
}
