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

// Writes arbitrary data directly under DB_ROOT via the emulator's REST API,
// bypassing the app entirely -- used to seed a pre-PL-09 flat database shape
// so the one-shot migration (migrateFlatStateToSessions) can be exercised
// end-to-end.
async function seedFlatData(request, data) {
  const url = `http://127.0.0.1:9000/${DB_ROOT}.json?ns=${EMULATOR_NAMESPACE}`;
  const res = await request.put(url, { data });
  if (!res.ok()) {
    throw new Error(`Failed to seed emulator database: ${res.status()} ${await res.text()}`);
  }
}

// Reads a single path directly from the emulator via REST, for assertions
// that need to check raw Firebase data rather than what the app renders.
async function readPath(request, path) {
  const url = `http://127.0.0.1:9000/${DB_ROOT}/${path}.json?ns=${EMULATOR_NAMESPACE}`;
  const res = await request.get(url);
  if (!res.ok()) {
    throw new Error(`Failed to read ${path}: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

module.exports = { resetDatabase, seedFlatData, readPath, DB_ROOT, EMULATOR_NAMESPACE };
