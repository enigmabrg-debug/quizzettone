# Inventario pronto

1000 domande quiz e 100 classifiche Top Dieci, importabili dal gestore domande
(Regia → Gestisci domande → 📦 Importa inventario). L'import aggiunge solo quello
che manca: si può ripetere senza creare doppioni.

## Domande — `domande-*.txt`

Un file per categoria. La prima riga è `# Categoria` (lo stesso nome delle
categorie dell'app), poi una domanda per riga:

    livello|Domanda|Risposta giusta|Errata|Errata|Errata

- `f` facile, `m` media → pool **manche**
- `d` difficile → pool **finale**

La risposta giusta si scrive sempre per prima: l'ordine con cui compare in gioco
viene mescolato dallo script (sempre uguale da un build all'altro).

## Classifiche — `top10-*.txt`

    ## Titolo | manche/finale | Categoria | fonte
    Nome / alternativa / alternativa = dato

Dieci righe per classifica, dalla 1ª alla 10ª posizione. Le alternative sono
altri modi accettati di scrivere la voce; il dato viene mostrato sul tabellone.
Le classifiche sono solo su dati oggettivi (misure, date, ordini ufficiali).

## Rigenerare il JSON

Dopo ogni modifica ai file di testo:

    node scripts/build-inventario.js

I test (`npm run test:unit`) falliscono se `data/inventario.json` non è
aggiornato, se una domanda non ha 4 risposte diverse o se una classifica non ha
10 voci distinte riconoscibili.
