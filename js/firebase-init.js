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

const MAX_AUDIO_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB: file più grandi rallentano troppo un caricamento da telefono in serata

async function uploadAudioFile(file, folder){
  // Validato qui, non nell'attributo accept="audio/*" dell'<input>: quello è
  // solo un suggerimento per il selettore di file del sistema operativo, non
  // impedisce di scegliere un file diverso o troppo grande.
  if(!file.type || !file.type.startsWith('audio/')){
    throw new Error('Il file deve essere un audio (tipo rilevato: ' + (file.type || 'sconosciuto') + ').');
  }
  if(file.size > MAX_AUDIO_FILE_SIZE_BYTES){
    throw new Error('File troppo grande (' + Math.round(file.size/1024/1024) + 'MB): il limite è ' + Math.round(MAX_AUDIO_FILE_SIZE_BYTES/1024/1024) + 'MB.');
  }
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
