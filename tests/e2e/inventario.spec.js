// Inventario pronto: il pulsante del gestore domande carica
// data/inventario.json nel mazzo una volta sola, senza doppioni.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';
const NS = 'ns=quizzettone-49543-default-rtdb';
const ROOT_URL = `http://127.0.0.1:9000/quizzettone.json?${NS}`;
const BANK_URL = `http://127.0.0.1:9000/quizzettone/questionBank.json?${NS}`;

test.beforeEach(async ({ request }) => { await resetDatabase(request); });

test('Inventario: importing adds 1000 questions and 100 rankings once, keeping hand-written ones', async ({ browser, request }) => {
  const mine = {id:'mine', pool:'manche', category:'Geografia', answerType:'scelta', question:'Domanda mia?',
    options:['a','b','c','d'], correctIndex:0, adminNote:null, audioUrl:null, lastUsedAt:null};
  const res = await request.put(ROOT_URL, { data: {
    sessions: { current: { state: { gameName:'Prova', setupLocked:false, phase:'lobby', round:1, qIndex:0 } } },
    questionBank: { mine },
  } });
  expect(res.ok()).toBeTruthy();
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await admin.click('#btnToggleQuestionManager');
  await admin.click('#btnImportInventory');
  await expect(admin.locator('#qmInventoryMsg')).toContainText('Aggiunte 1000 domande e 100 classifiche', { timeout: 20000 });
  const bank = await (await request.get(BANK_URL)).json();
  const all = Object.values(bank);
  // Più le 8 classifiche di partenza, caricate da sole a mazzo senza Top Dieci.
  expect(all.length).toBe(1109);
  expect(bank.mine.question).toBe('Domanda mia?');
  expect(all.filter(q => q.answerType === 'top10').length).toBe(108);
  expect(all.filter(q => q.pool === 'finale' && q.answerType !== 'top10').every(q => q.difficulty === 'difficile')).toBeTruthy();
  await admin.click('#btnImportInventory');
  await expect(admin.locator('#qmInventoryMsg')).toContainText("Hai già tutto l'inventario");
  expect(Object.keys(await (await request.get(BANK_URL)).json()).length).toBe(1109);
});
