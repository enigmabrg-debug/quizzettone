// PL-06: teamSubmitAnswer() uses a transaction() on answers:<teamId>/<key>
// instead of read-then-write, so a genuine race (not just a same-tab double
// click, already blocked client-side by the immediate button disable) can
// never produce two different recorded answers for the same team/question.
const { test, expect } = require('@playwright/test');
const { resetDatabase } = require('../helpers/emulator');

const BASE = '/quizzettone.html?emulator=1';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('two concurrent submits for the same team/question (e.g. two open tabs) record exactly one answer', async ({ browser }) => {
  test.setTimeout(30_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Doppia Tab');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Doppia Tab' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  await expect(team.locator('.opt').first()).toBeVisible();

  // Two tabs of the same team would both run in the *same* teamId context,
  // just as two independent calls to teamSubmitAnswer() below do -- what
  // actually decides the outcome is the transaction() on the server, not
  // which browser tab issued the call. Racing the two calls directly is a
  // more deterministic way to exercise that server-side guarantee than
  // choreographing two real UI clicks across two tabs.
  const [ok1, ok2] = await team.evaluate(() => Promise.all([
    teamSubmitAnswer(state.round, state.qIndex, 0),
    teamSubmitAnswer(state.round, state.qIndex, 1),
  ]));
  // Neither call is treated as a failure: the loser just finds the answer
  // already there and no-ops, it doesn't surface an error banner.
  expect(ok1).toBe(true);
  expect(ok2).toBe(true);
  await expect(team.locator('#errorBannerOverlay')).toHaveCount(0);

  const savedAnswer = await team.evaluate(() => {
    const key = qkey(state.round, state.qIndex);
    return answersByTeam[teamId] && answersByTeam[teamId][key];
  });
  expect(savedAnswer).toBeTruthy();
  expect([0, 1]).toContain(savedAnswer.optionIndex);

  // Exactly one recorded answer, matching whichever call actually won.
  await expect(team.locator('.opt.selected')).toHaveCount(1);
  await expect(team.locator(`.opt[data-idx="${savedAnswer.optionIndex}"]`)).toHaveClass(/selected/);
  await expect(admin.locator('text=✓ 1 ricevute')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});

test('the buttons lock immediately on click and stay locked through the pending submit', async ({ browser }) => {
  test.setTimeout(30_000);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(BASE + '&role=admin');
  await admin.fill('#adminPinInput', '2468');
  await admin.click('#btnPinConfirm');

  const teamCtx = await browser.newContext();
  const team = await teamCtx.newPage();
  await team.goto(BASE);
  await team.click('#btnTeam');
  await team.fill('#teamNameInput', 'Squadra Click Rapidi');
  await team.click('#btnJoin');
  await expect(admin.locator('.team-tag', { hasText: 'Squadra Click Rapidi' })).toBeVisible();

  await admin.click('#btnStart');
  await admin.click('#startSummaryConfirm');
  const firstOption = team.locator('.opt[data-idx="0"]');
  await expect(firstOption).toBeVisible();

  await firstOption.click();
  // Right after the click, before the write is confirmed, every option must
  // already be disabled -- not just the one that was clicked.
  await expect(team.locator('.status-banner')).toContainText(/Invio in corso|Risposta inviata/);
  for (const idx of [0, 1, 2, 3]) {
    await expect(team.locator(`.opt[data-idx="${idx}"]`)).toBeDisabled();
  }
  await expect(team.locator('.status-banner.sent')).toBeVisible();

  await adminCtx.close();
  await teamCtx.close();
});
