// PL-08: uploadAudioFile() must reject files that are the wrong type or too
// large *before* touching Storage, with a clear message at the same upload
// button the admin just used -- covers both call sites (question bank audio,
// sound effects).
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const OVERSIZED_BYTES = 9 * 1024 * 1024; // just over the 8MB limit

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

async function loginAdmin(page) {
  await page.goto(BASE + '&role=admin');
  await page.fill('#adminPinInput', '2468');
  await page.click('#btnPinConfirm');
  await expect(page.locator('#setupGameName')).toBeVisible();
}

test('question audio upload: wrong file type is rejected with a clear message', async ({ page }) => {
  await loginAdmin(page);
  await page.click('#btnToggleQuestionManager');
  await page.fill('#qmQuestion', 'Domanda di prova');
  await page.fill('#qmOpt0', 'A');
  await page.fill('#qmOpt1', 'B');
  await page.fill('#qmOpt2', 'C');
  await page.fill('#qmOpt3', 'D');
  await page.setInputFiles('#qmAudioFile', {
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('non è un audio'),
  });
  await page.click('#btnAddQuestion');
  await expect(page.locator('#qmAddMsg')).toContainText('deve essere un audio');
});

test('question audio upload: oversized file is rejected with a clear message', async ({ page }) => {
  await loginAdmin(page);
  await page.click('#btnToggleQuestionManager');
  await page.fill('#qmQuestion', 'Domanda di prova 2');
  await page.fill('#qmOpt0', 'A');
  await page.fill('#qmOpt1', 'B');
  await page.fill('#qmOpt2', 'C');
  await page.fill('#qmOpt3', 'D');
  await page.setInputFiles('#qmAudioFile', {
    name: 'big.mp3',
    mimeType: 'audio/mpeg',
    buffer: Buffer.alloc(OVERSIZED_BYTES),
  });
  await page.click('#btnAddQuestion');
  await expect(page.locator('#qmAddMsg')).toContainText('troppo grande');
});

test('sound effect upload: wrong file type is rejected with a clear message', async ({ page }) => {
  await loginAdmin(page);
  await page.click('#btnToggleEffects');
  await page.fill('#fxName', 'Applausi');
  await page.setInputFiles('#fxFile', {
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('non è un audio'),
  });
  await page.click('#btnUploadEffect');
  await expect(page.locator('#fxUploadMsg')).toContainText('deve essere un audio');
});
