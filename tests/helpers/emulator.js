// Wipes the local RTDB emulator's quizzettone data between tests, so each
// test starts from a clean slate without depending on the app's own
// (separately tested) reset functionality.
const DB_ROOT = 'quizzettone';
const EMULATOR_NAMESPACE = 'quizzettone-49543-default-rtdb';

async function resetDatabase(request) {
  const url = `http://127.0.0.1:9000/${DB_ROOT}.json?ns=${EMULATOR_NAMESPACE}`;
  const res = await request.delete(url);
  if (!res.ok()) {
    throw new Error(`Failed to reset emulator database: ${res.status()} ${await res.text()}`);
  }
}

module.exports = { resetDatabase, DB_ROOT, EMULATOR_NAMESPACE };
