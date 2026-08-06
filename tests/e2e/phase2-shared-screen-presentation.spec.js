// PL-11 (scope allargato, versione ridotta di PROPOSTA_SCHERMO_CONDIVISO):
// verifica la separazione in tre momenti (presentedAt/inputUnlockedAt/
// timerStartedAt) e il nuovo displayMode 'shared_screen', che tiene le
// risposte bloccate finché l'admin non preme esplicitamente "Apri
// risposte", più il fallback manuale per-domanda e l'heartbeat di presenza
// per un futuro ruolo Display. La modalità 'team_devices' (default) resta
// coperta dai test già esistenti in phase1-timer.spec.js: qui si esercita
// solo ciò che cambia.
const { test, expect } = require('@playwright/test');
const { resetDatabase, readPath } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('shared_screen: le risposte restano bloccate finché l\'admin non le apre, poi sblocco e timer partono insieme', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '2');
  await admin.selectOption('#setupDisplayMode', 'shared_screen');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Schermo');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Schermo' })).toBeVisible();

  await admin.click('#btnStart');

  // La domanda è aperta ma non ancora sbloccata: la squadra non vede le
  // opzioni, solo il rimando allo schermo condiviso.
  await expect(team.locator('.status-banner', { hasText: 'Guarda lo schermo condiviso' })).toBeVisible();
  await expect(team.locator('.opt')).toHaveCount(0);

  // L'admin vede "Apri risposte" (non "Avvia timer") più il fallback.
  await expect(admin.locator('#btnStartTimer')).toHaveText('🔓 Apri risposte');
  await expect(admin.locator('#btnActivateTeamFallback')).toBeVisible();

  await admin.click('#btnStartTimer');

  // Sblocco: la squadra vede ora le opzioni abilitate e il timer parte.
  await expect(team.locator('.opt').first()).toBeEnabled();
  await expect(team.locator('.timer-num')).toBeVisible();

  // I tre timestamp sono stati scritti sull'istanza della domanda, con
  // sblocco e timer coincidenti (item 3/5 del piano).
  const q = await admin.evaluate(() => getQuestion(1, 0));
  expect(q.presentedAt).toBeTruthy();
  expect(q.inputUnlockedAt).toBeTruthy();
  expect(q.timerStartedAt).toBeTruthy();
  expect(q.inputUnlockedAt).toBe(q.timerStartedAt);
  expect(q.presentedAt).toBeLessThanOrEqual(q.inputUnlockedAt);

  await adminCtx.close();
  await teamCtx.close();
});

test('shared_screen: il fallback "Mostra domanda sui telefoni" mostra la domanda sul telefono senza sbloccare da solo l\'input', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');
  await expect(admin.locator('#setupGameName')).toBeVisible();

  await admin.fill('#setupRounds', '1');
  await admin.fill('#setupQuestionsPerRound', '2');
  await admin.selectOption('#setupDisplayMode', 'shared_screen');
  await admin.click('#btnSaveSetup');
  await admin.waitForTimeout(400);

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Fallback');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Fallback' })).toBeVisible();

  await admin.click('#btnStart');
  await expect(team.locator('.status-banner', { hasText: 'Guarda lo schermo condiviso' })).toBeVisible();

  await admin.click('#btnActivateTeamFallback');

  // Ora la domanda è visibile sul telefono, ma il timer/input restano
  // bloccati finché l'admin non preme comunque "Apri risposte": stesso
  // banner "in attesa" già usato dalla modalità team_devices con avvio
  // manuale del timer.
  await expect(team.locator('.qtext')).toBeVisible();
  await expect(team.locator('.opt').first()).toBeVisible();
  await expect(team.locator('.opt').first()).toBeDisabled();
  await expect(team.locator('.status-banner', { hasText: "In attesa che l'host avvii il timer" })).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('presenza Display: heartbeat connected/lastSeenAt scritto alla connessione e rimosso alla disconnessione', async ({ browser, request }) => {
  test.setTimeout(30_000);
  const displayCtx = await browser.newContext();
  const display = await displayCtx.newPage();
  await display.goto(BASE + '&role=display');
  await display.waitForTimeout(500);

  const presence = await readPath(request, 'sessions/current/presence/display');
  expect(presence).toBeTruthy();
  const entries = Object.values(presence);
  expect(entries.length).toBe(1);
  expect(entries[0].connected).toBe(true);
  expect(entries[0].lastSeenAt).toBeTruthy();

  await displayCtx.close();
  await new Promise(r => setTimeout(r, 1000)); // dà tempo a onDisconnect() di propagarsi lato emulatore

  const presenceAfter = await readPath(request, 'sessions/current/presence/display');
  expect(presenceAfter).toBeFalsy();
});
