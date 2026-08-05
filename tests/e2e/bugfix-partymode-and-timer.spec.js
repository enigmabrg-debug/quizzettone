// Regression tests for user-reported bugs after the Fase 1-3 merge:
// 1) Party Mode cards were only ever revealed on the Display screen, never
//    on team devices, and there was no UI to add custom cards to a deck.
// 2) "Avvio timer: Manuale" was buried inside the collapsed "Impostazioni
//    avanzate" section, so admins who never opened it got the default
//    (auto-start) behavior without realizing a choice existed.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('a revealed Party Mode card shows on the team screen too, not just Display', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(500);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Party');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Party' })).toBeVisible();

  await admin.click('#btnPartyNormale');
  await admin.click('#btnStart');
  await expect(admin.locator('.qmeta').first()).toBeVisible();

  await admin.click('#btnMarkBonus');
  await admin.click('[data-party-confirm="bonus"]');
  await admin.click('[data-party-reveal="bonus"]');

  await expect(team.locator('.party-card')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('admin can add and delete custom Party Mode cards from the deck manager', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.click('#btnTogglePartyDeckManager');
  await admin.selectOption('#pdmDeck', 'normale');
  await admin.selectOption('#pdmTipo', 'bonus');
  await admin.fill('#pdmTesto', 'Carta di prova aggiunta da test');
  await admin.click('#btnAddPartyCard');

  await expect(admin.locator('text=Carta di prova aggiunta da test')).toBeVisible();

  const row = admin.locator('.row', { hasText: 'Carta di prova aggiunta da test' });
  admin.once('dialog', d => d.accept());
  await row.locator('[data-delete-party-card]').click();

  await expect(admin.locator('text=Carta di prova aggiunta da test')).toHaveCount(0);

  await adminCtx.close();
});

test('"Avvio timer" is visible in the essential setup section without opening advanced settings', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  // Visible WITHOUT clicking "Impostazioni avanzate" first.
  await expect(admin.locator('#setupTimerStartMode')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '1');
  await admin.selectOption('#setupTimerStartMode', 'manual');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(500);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Manuale');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Manuale' })).toBeVisible();

  await admin.click('#btnStart');
  // Manual mode: the question is open but the timer must NOT be running yet.
  await expect(admin.locator('#btnStartTimer')).toBeVisible();
  await expect(admin.locator('.pill', { hasText: 'In attesa di avvio' })).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});
