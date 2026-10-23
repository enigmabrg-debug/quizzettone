// PL-19 (consolidamento audio): un errore REALE di caricamento del file
// (non il blocco autoplay, già gestito prima di questo pacchetto) viene
// segnalato su Firebase dall'admin e mostrato alle squadre, che non
// riproducono l'audio in prima persona ma ne vedono lo stato prima di
// rispondere — invece di restare in attesa di un audio che non arriva mai.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('una domanda con audio non disponibile mostra un avviso esplicito alla squadra', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  // Interruzione deterministica della richiesta invece di affidarsi al
  // comportamento reale della rete per un dominio inesistente: sotto la
  // suite completa, con l'ambiente dietro un proxy in uscita, un vero
  // fallimento DNS può arrivare con tempi non prevedibili (osservato in
  // pratica: verde in isolamento, a volte in timeout dentro la suite
  // intera) — route().abort() fallisce la richiesta all'istante, sempre.
  await admin.route('**/non-esiste.mp3', route => route.abort());
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.evaluate(async () => {
    // Le domande seed hanno più voci con lo stesso testo generico "Che
    // canzone è?" (una per artista, distinte solo da adminNote): un filtro
    // di pulizia basato sul TESTO le avrebbe lasciate tutte, rischiando di
    // far pescare quella sbagliata al posto della nostra. Si tiene invece
    // l'ID esatto ritornato da addQuestion, l'unico identificatore
    // davvero univoco.
    const keepId = await addQuestion({
      pool: 'manche', category: 'Musica', question: 'Che canzone è (test audio non disponibile)?',
      options: ['A','B','C','D'], correctIndex: 0,
      audioUrl: 'https://example.invalid/non-esiste.mp3'
    });
    const bank = await db.ref(DB_ROOT + '/' + questionBankPath()).once('value');
    const updates = {};
    Object.values(bank.val() || {}).forEach(q => {
      if (q.id !== keepId) updates[questionBankPath(q.id)] = null;
    });
    await db.ref(DB_ROOT).update(updates);
  });

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Audio');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Audio' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  // La squadra vede sempre uno stato per l'audio della domanda (non lo
  // riproduce in prima persona, ma ne segue lo stato): all'apertura "in
  // riproduzione" (PL-11 fa partire il cue da solo), poi — la richiesta è
  // interrotta sopra — l'elemento <audio> dell'admin genera un onerror
  // reale, che l'admin segnala su Firebase (reportAudioLoadFailure): la
  // squadra lo vede aggiornarsi tramite il listener realtime, senza
  // ricaricare la pagina. Lo stato iniziale "in riproduzione" può già
  // essere stato sostituito prima di questa verifica (route().abort() è
  // pressoché istantaneo): si asserisce solo l'esito finale.
  await expect(team.locator('.pill', { hasText: 'Audio non disponibile' })).toBeVisible({ timeout: 10_000 });

  await adminCtx.close();
  await teamCtx.close();
});
