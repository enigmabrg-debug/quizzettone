// PL-19 (domanda fotografica): caricamento immagine con lo stesso pattern
// di uploadAudioFile (PL-08), anteprima in fase di creazione, visualizzata
// su Team/Admin (Display riusa renderTeamQuestion), fallback testuale se il
// file non carica.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('caricare un\'immagine mostra un\'anteprima locale prima ancora del salvataggio', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('#btnToggleQuestionManager');
  await expect(page.locator('#qmImageWrap')).toBeHidden();
  await page.selectOption('#qmContentType', 'immagine');
  await expect(page.locator('#qmImageWrap')).toBeVisible();

  await page.setInputFiles('#qmImageFile', {
    name: 'test.png',
    mimeType: 'image/png',
    // 1x1 PNG trasparente valido
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('#qmImagePreview')).toBeVisible();
});

test('un file non-immagine è rifiutato con un messaggio chiaro', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();

  await page.click('#btnToggleQuestionManager');
  await page.fill('#qmQuestion', 'Domanda con file sbagliato');
  await page.fill('#qmOpt0', 'A');
  await page.fill('#qmOpt1', 'B');
  await page.fill('#qmOpt2', 'C');
  await page.fill('#qmOpt3', 'D');
  await page.selectOption('#qmContentType', 'immagine');
  await page.setInputFiles('#qmImageFile', {
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('non è un\'immagine'),
  });
  await page.click('#btnAddQuestion');
  await expect(page.locator('#qmAddMsg')).toContainText('deve essere un\'immagine');
});

test('una domanda con immagine mostra un fallback se il file non è disponibile', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  // Seed diretto: un URL immagine che non risolve (404), per esercitare il
  // fallback senza dover passare da un vero upload su Storage.
  await admin.evaluate(async () => {
    // Si tiene l'ID esatto ritornato da addQuestion, non il testo: più
    // robusto in generale se in futuro un'altra domanda seed dovesse usare
    // lo stesso prompt (già successo con "Che canzone è?" nelle seed
    // musicali — vedi phase4-audio-consolidation.spec.js).
    const keepId = await addQuestion({
      pool: 'manche', category: 'Geografia', question: 'Che monumento è questo?',
      options: ['Colosseo','Torre Eiffel','Big Ben','Statua della Libertà'], correctIndex: 0,
      contentType: 'immagine', imageUrl: 'https://example.invalid/non-esiste.jpg'
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
  await team.fill('#teamNameInput', 'Squadra Foto');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Foto' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(admin.locator('.qmeta').first()).toContainText('Domanda 1/1');

  // L'onerror nasconde l'<img> rotta e mostra il paragrafo di fallback: solo
  // quest'ultimo deve restare visibile a caricamento fallito concluso.
  await expect(team.locator('.question-image-wrap p', { hasText: 'Immagine non disponibile' })).toBeVisible();
  await expect(team.locator('.question-image-wrap img')).toBeHidden();

  await adminCtx.close();
  await teamCtx.close();
});
