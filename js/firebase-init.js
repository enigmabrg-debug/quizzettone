/* ================== STORAGE HELPERS (Firebase Realtime Database) ==================
   Qui sotto sostituiamo "window.storage" (che funziona solo dentro Claude.ai)
   con Firebase, che funziona da qualunque hosting, incluso GitHub Pages.

   *** DEVI INCOLLARE QUI LA TUA CONFIGURAZIONE FIREBASE ***
   La trovi nella console Firebase seguendo la guida che ti ho scritto in chat.
*/
const firebaseConfig = {
  apiKey: "AIzaSyAjJ6LLpzw-5jAhqaCzhkJaL4p5aTuRo7Q",
  authDomain: "quizzettone-49543.firebaseapp.com",
  databaseURL: "https://quizzettone-49543-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quizzettone-49543",
  storageBucket: "quizzettone-49543.firebasestorage.app",
  messagingSenderId: "503932476992",
  appId: "1:503932476992:web:2b14ecd90cd6a2a2f609a5"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();
if(new URLSearchParams(location.search).get('emulator') === '1'){
  db.useEmulator('127.0.0.1', 9000);
}
const DB_ROOT = 'quizzettone'; // tutti i dati del gioco vivono sotto questo "nodo" del database

/* Gli orologi dei telefoni sono spesso sfasati di secondi: timer, chiusura a
   scadenza, bonus velocità e spareggi confrontano timestamp scritti da
   dispositivi diversi, quindi usano tutti l'ora del server Firebase. */
let serverTimeOffset = 0;
db.ref('.info/serverTimeOffset').on('value', snap=>{ serverTimeOffset = snap.val() || 0; });
function serverNow(){ return Date.now() + serverTimeOffset; }

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
async function uploadAudioFile(file, folder){
  if(file.size > MAX_AUDIO_BYTES) throw new Error('file troppo grande (max 10 MB)');
  if(file.type && !file.type.startsWith('audio/')) throw new Error('il file non è un audio');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = 'quizzettone-audio/' + folder + '/' + Date.now() + '_' + safeName;
  const ref = storage.ref(path);
  await ref.put(file);
  return await ref.getDownloadURL();
}

async function safeGet(key, shared){
  try{
    const snap = await db.ref(DB_ROOT + '/' + key).once('value');
    const val = snap.val();
    return (val === null || val === undefined) ? null : val;
  } catch(e){ console.error('storage get failed', key, e); return null; }
}
async function safeSet(key, value, shared){
  try{ await db.ref(DB_ROOT + '/' + key).set(value); return true; }
  catch(e){ console.error('storage set failed', key, e); return false; }
}
async function safeDelete(key, shared){
  try{ await db.ref(DB_ROOT + '/' + key).remove(); }catch(e){}
}
async function safeList(prefix, shared){
  try{
    const snap = await db.ref(DB_ROOT).once('value');
    const all = snap.val() || {};
    return Object.keys(all).filter(k => k.startsWith(prefix));
  } catch(e){ console.error('storage list failed', prefix, e); return []; }
}
