# Loghi

| File | Dove compare |
|---|---|
| `logo-cabinsurfers-games.webp` | Hub (`index.html`), in alto |
| `logo-quizzettone.webp` | Scheda Quizzettone nell'hub; schermate d'ingresso del Quizzettone |
| `logo-top10.webp` | Scheda Top Dieci nell'hub; schermate d'ingresso di Top Dieci |

Sono ricavati dagli originali PNG (1536×1024, circa 1,4 MB l'uno): ritagliati sul disegno, larghi 900 px, in WebP, circa 25 KB l'uno, così si caricano subito anche da telefono. Gli originali restano nella cronologia git (commit "Add files via upload").

Per sostituirne uno: carica il nuovo file con lo stesso nome, oppure un PNG qualsiasi e poi convertilo con
`convert originale.png -fuzz 12% -trim +repage -bordercolor "<colore sfondo>" -border 40 -resize '900x>' -quality 86 logo-xxx.webp`.
Se un file manca, al suo posto compare il nome scritto in testo, quindi l'app non si rompe.
