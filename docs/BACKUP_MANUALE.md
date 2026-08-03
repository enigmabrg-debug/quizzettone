# Backup manuale prima di test o reset

Checklist rapida da seguire prima di ogni prova o reset della partita, in assenza di un ambiente Firebase separato (vedi nota FT-01 in `docs/PIANO_MODIFICHE_QUIZZETTONE.md`).

1. Apri la [Firebase Console](https://console.firebase.google.com) e seleziona il progetto `quizzettone-49543`.
2. Vai su **Realtime Database → Dati**, clicca sull'icona dei tre puntini (⋮) in alto sulla riga del nodo radice e scegli **Esporta JSON**.
3. Salva il file scaricato in un posto sicuro, con un nome che riporti data e ora (es. `backup-quizzettone-2026-08-03.json`).
4. Solo dopo aver salvato il backup, procedi con test, prove o con il bottone "Reset partita" nel pannello Admin.

In caso di errore durante un test dal vivo, il file esportato permette di ricostruire manualmente i dati importandolo di nuovo da **Realtime Database → Dati → ⋮ → Importa JSON**.
