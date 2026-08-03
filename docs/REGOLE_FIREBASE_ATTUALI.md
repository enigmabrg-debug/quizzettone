# Regole Firebase attuali (progetto di produzione `quizzettone-49543`)

> Verificate direttamente in Firebase Console il 3 agosto 2026. Le regole sono versionate senza modifiche in `firebase.rtdb.rules.json` e `firebase.storage.rules` nella root del progetto.

## ⚠️ Sintesi del rischio

- **Realtime Database globalmente pubblico in lettura e scrittura.** Chiunque conosca l'URL del database può leggere o modificare qualunque dato — squadre, punteggi, domande, stato della partita — senza passare dall'app e senza alcuna autenticazione.
- **Storage aperto in lettura/scrittura, ma limitato al path `quizzettone-audio`.** Non è l'intero bucket a essere pubblico: solo quel percorso specifico, che però è completamente accessibile a chiunque ne conosca l'URL.
- **Nessuna delle due regole richiede autenticazione, un token, o un controllo di provenienza (`request.auth`, referrer, PIN).** Il PIN Admin dell'app è un ostacolo lato client, non una vera barriera: chi accede direttamente a Firebase lo bypassa del tutto.

## Regole RTDB

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Percorso interessato: l'intero database (`/`), quindi ogni ramo — squadre, risposte, stato di gioco, banca domande, effetti sonori — è leggibile e scrivibile da chiunque abbia l'URL `databaseURL` presente in `index.html`.

## Regole Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /quizzettone-audio/{allPaths=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

Percorso interessato: solo `quizzettone-audio/**`. Qualsiasi altro path del bucket non è coperto da questa regola esplicita (il comportamento di default di Firebase Storage per i path non corrispondenti è negare l'accesso, ma questo non è stato verificato direttamente in questa sessione).

## Valutazione del rischio nel contesto d'uso

Ho confermato che il link della partita viene condiviso solo con il gruppo ristretto di amici presenti alle serate, non pubblicamente. Per questo motivo, come da piano (sezione 2.4), l'autenticazione reale resta pianificata per la Fase 2 e non diventa un prerequisito bloccante urgente.

Resta però un rischio residuo da tenere presente: chiunque intercetti o trovi l'URL — per condivisione accidentale, log, cronologia browser condivisa, o semplice tentativo casuale sul dominio Firebase — ha accesso completo in lettura e scrittura a tutti i dati della partita, senza lasciare traccia distinguibile da un utente legittimo. Se in futuro il link dovesse circolare fuori dal gruppo fidato (partite pubbliche, più admin, dati storici da proteggere), questo è il trigger per anticipare l'autenticazione da Fase 2 a prerequisito P0, come già previsto dal piano.
