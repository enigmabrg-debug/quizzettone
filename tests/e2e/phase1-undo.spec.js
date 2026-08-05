// Verifies the event history / undo mechanism and the confirmation modal
// for high-impact actions: adjusting a team's points can be undone with a
// single click, undo is single-level (a second click does nothing once
// there's nothing left to undo), and removing a team requires confirming
// through the modal rather than acting immediately.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('undo restores points after a manual adjustment, and only once', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Undo');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Team Undo' })).toBeVisible();

  await admin.click('#btnStart');
  await expect(admin.locator('.qmeta').first()).toBeVisible();

  // No undo button before any undoable action has happened yet.
  await expect(admin.locator('#btnUndoLast')).toHaveCount(0);

  // The per-team point-adjust buttons only appear once answers are closed.
  await admin.click('#btnCloseNow');

  const pointsCell = admin.locator('tr', { hasText: 'Team Undo' }).locator('td').nth(3);
  const before = (await pointsCell.innerText()).trim();

  await admin.locator('tr', { hasText: 'Team Undo' }).locator('[data-adjust]').first().click();
  await expect(pointsCell).not.toHaveText(before);
  const afterAdjust = (await pointsCell.innerText()).trim();

  await expect(admin.locator('#btnUndoLast')).toBeVisible();
  await admin.click('#btnUndoLast');
  await expect(pointsCell).toHaveText(before);

  // Single-level: the undo button disappears once there's nothing left to undo.
  await expect(admin.locator('#btnUndoLast')).toHaveCount(0);
  expect(afterAdjust).not.toBe(before);

  await adminCtx.close();
  await teamCtx.close();
});

test('removing a team requires confirming through the modal', async ({ browser }) => {
  test.setTimeout(60_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Team Rimosso');
  await team.click('#btnJoin');
  const teamRow = admin.locator('.team-tag', { hasText: 'Team Rimosso' });
  await expect(teamRow).toBeVisible();

  await teamRow.locator('[data-remove-team]').click();
  await expect(admin.locator('#confirmModalOverlay')).toBeVisible();

  // Cancel: team must still be there.
  await admin.click('#confirmModalNo');
  await expect(admin.locator('#confirmModalOverlay')).toHaveCount(0);
  await expect(teamRow).toBeVisible();

  // Confirm: team is actually removed, and the removal itself is undoable.
  await teamRow.locator('[data-remove-team]').click();
  await admin.click('#confirmModalYes');
  await expect(admin.locator('.team-tag', { hasText: 'Team Rimosso' })).toHaveCount(0);

  await admin.click('#btnUndoLast');
  await expect(admin.locator('.team-tag', { hasText: 'Team Rimosso' })).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('reset requires confirming through the modal, not the native browser dialog', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  let nativeDialogSeen = false;
  admin.on('dialog', async (dialog) => { nativeDialogSeen = true; await dialog.dismiss(); });

  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  await admin.click('#btnReset');
  await expect(admin.locator('#confirmModalOverlay')).toBeVisible();
  expect(nativeDialogSeen).toBe(false);

  await admin.click('#confirmModalNo');
  await expect(admin.locator('#confirmModalOverlay')).toHaveCount(0);

  await adminCtx.close();
});
