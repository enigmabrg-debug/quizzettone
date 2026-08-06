# Log di avanzamento — esecuzione PL-01 → PL-33

> Una riga per pacchetto. Stato: fatto / in corso / bloccato / saltato.
> Riferimento tecnico: `PIANO_IMPLEMENTAZIONE_CONSOLIDATO.md` (aggiornato in corso d'opera per la
> fusione UX fase 5/6, vedi nota sotto).
> Audit di partenza: `STATO_IMPLEMENTAZIONE_QUIZZETTONE.md`.

## Nota di ripresa

Un turno precedente aveva già iniziato PL-01, ma le modifiche non erano state committate prima che il
container si resettasse: il lavoro è andato perso. Questa esecuzione riparte da zero da PL-01 (questo
file non esisteva più sul filesystem all'avvio di questo turno).

## Verifica preliminare (Passo 0)

- **FT-01** (ambiente di prova separato): nel codice/git log non esiste alcun dialog di reset a due
  passaggi né una checklist di backup collegata ad `adminResetGame` (verificato con
  `git log --oneline --all` e grep su "backup", "checklist", "due passaggi", "two-step" — nessun
  risultato in entrambi i turni in cui è stato verificato). Punto di decisione **aperto**: verrà
  richiesta conferma esplicita immediatamente prima del pacchetto PL-05.
- **FT-02**: nessuna azione in questa sessione. Copre **PL-04**, saltato.
- **FT-09** (PL-09): richiede conferma esplicita prima di iniziarlo, in Fase 2.

## Nota fusione UX fase 5/6

Da `AGGIORNAMENTO_PIANO_UX_fase5.md` (allegato dall'utente): a fine PL-24, PL-25/PL-27/PL-28/PL-30/
PL-32 del piano originale vengono sostituiti da **PL-25-UX**, **PL-27-UX**, **PL-30-UX**.
`PIANO_IMPLEMENTAZIONE_CONSOLIDATO.md` verrà aggiornato di conseguenza prima di eseguirli.

## Log pacchetti

| ID | Titolo | Stato | Commit | Note/deviazioni |
|---|---|---|---|---|
| PL-04 | Verificare/versionare regole Firebase | saltato | — | Copre FT-02: "nessuna azione in questa sessione" per decisione esplicita dell'utente (Passo 0). |
| PL-01 | Chiudere l'XSS residuo | fatto | 185581f | Aggiunto helper `teamNameHtml()` in js/render.js e sostituite tutte le interpolazioni dirette di nome squadra non escapate (rankRows, renderTeam, lobby Admin, tabelle Admin, blocchi spareggio/finale). Test mirati (phase1-lobby, smoke) + nuovo tests/e2e/phase1-xss.spec.js tutti verdi. |
| PL-02 | Loading, timeout, errore, retry all'avvio | fatto | a97a80b | Aggiunti `bootStatus`/`retryBoot()` in js/state.js (timeout 8s su `startListening`) e `renderBootScreen()` in js/render.js, richiamata da `render()` quando `!state` invece di lasciare la pagina bianca. Nuovo test tests/e2e/phase1-boot-recovery.spec.js (simula rete offline via `context.setOffline`, verifica loading→timeout→retry funzionante). Non toccato quizzettone.html: tutta la logica sta in state.js/render.js, non serve nulla nello script di boot. Suite completa non rieseguita (interrotta in background per evitare conflitti sull'emulatore condiviso); rieseguiti invece i test mirati più ampi (lobby, smoke, timer, xss) oltre a quello nuovo — tutti verdi. |
| PL-03 | Gestire gli esiti reali delle operazioni Firebase | fatto | b9c6048 | Aggiunto `showErrorBanner()` in js/render.js. `withUndo` ora ritorna esito e mostra errore+retry se `safeSet` fallisce (copre indirettamente `adminAdjustPoints`, che delega tutto a `withUndo`). Controllato esplicitamente il ritorno di `safeSet` in `adminStartGame`, `adminSaveSetup`, `adminResetGame`, `teamJoin`, `teamSubmitAnswer`: su fallimento non si avanza più lo stato locale (es. `teamJoin` non assegna più `teamId`/`teamName` prima di sapere se la scrittura è riuscita). Fuori scope (non toccato, come da elenco file del pacchetto): le `safeDelete` (silenziose per disegno) e i `db.ref(...).update()` diretti altrove nel codice. Test nuovo tests/e2e/phase1-write-errors.spec.js: simula un fallimento reale di `.set()` via monkey-patch di `db.ref` (non tramite regole Firebase, per non toccare FT-02) su join/risposta/reset, verifica banner+retry funzionante per tutti e tre. Suite mirata (lobby, smoke, xss, undo, boot-recovery) tutta verde. |
