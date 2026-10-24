#!/usr/bin/env node
/* Genera data/inventario.json dai file di testo in data/inventario/.

   domande-*.txt  → "# Categoria" in testa, poi una riga per domanda:
                    livello|Domanda|Giusta|Errata|Errata|Errata
                    (livello: f = facile, m = media, d = difficile; le
                    difficili finiscono nel pool della finale)
   top10-*.txt    → "## Titolo | pool | Categoria | fonte" seguito da 10 righe
                    "Nome / alternativa / alternativa = dato"

   Gli id sono un hash del testo, così rigenerare il file non cambia gli id e
   l'import nel gestore domande non crea doppioni. Anche l'ordine delle
   risposte è deterministico (mescolato con lo stesso hash).

   Uso: node scripts/build-inventario.js [--check]
   --check non scrive nulla: fallisce se il JSON non è aggiornato. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'inventario');
const OUT = path.join(ROOT, 'data', 'inventario.json');
const LEVELS = {f:'facile', m:'media', d:'difficile'};

const hash = s => crypto.createHash('sha1').update(s).digest('hex');

// Mescolamento deterministico: Fisher-Yates guidato dai byte dell'hash.
function seededShuffle(arr, seed){
  const a = [...arr];
  const bytes = Buffer.from(hash(seed), 'hex');
  for(let i=a.length-1; i>0; i--){
    const j = bytes[i % bytes.length] % (i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fail(file, line, msg){
  throw new Error(path.basename(file) + (line ? ':'+line : '') + ' — ' + msg);
}

function parseQuestionFile(file){
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let category = null;
  const out = [];
  lines.forEach((raw, i)=>{
    const line = raw.trim();
    if(!line) return;
    if(line.startsWith('#')){
      if(!category) category = line.replace(/^#+/, '').trim();
      return;
    }
    if(!category) fail(file, i+1, 'manca la riga "# Categoria" in testa');
    const parts = line.split('|').map(p=>p.trim());
    if(parts.length!==6) fail(file, i+1, 'servono 6 campi separati da |, trovati '+parts.length);
    const [lvl, question, ...answers] = parts;
    if(!LEVELS[lvl]) fail(file, i+1, 'livello "'+lvl+'" non valido (f/m/d)');
    const correct = answers[0];
    const options = seededShuffle(answers, question);
    out.push({
      id: 'inv_' + hash('q|'+question).slice(0, 12),
      pool: lvl==='d' ? 'finale' : 'manche',
      category, difficulty: LEVELS[lvl], answerType: 'scelta',
      question, options, correctIndex: options.indexOf(correct)
    });
  });
  return out;
}

function parseTop10File(file){
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = [];
  let cur = null;
  lines.forEach((raw, i)=>{
    const line = raw.trim();
    if(!line) return;
    if(line.startsWith('## ')){
      const [title, pool, category, source] = line.slice(3).split('|').map(p=>p.trim());
      if(!title || !pool || !category) fail(file, i+1, 'intestazione incompleta (## Titolo | pool | Categoria | fonte)');
      if(pool!=='manche' && pool!=='finale') fail(file, i+1, 'pool "'+pool+'" non valido');
      cur = {line:i+1, title, pool, category, source: source || null, items: []};
      out.push(cur);
      return;
    }
    if(line.startsWith('#')) return;
    if(!cur) fail(file, i+1, 'voce fuori da una classifica');
    const eq = line.indexOf('=');
    const names = (eq>=0 ? line.slice(0, eq) : line).split('/').map(x=>x.trim()).filter(Boolean);
    const value = eq>=0 ? line.slice(eq+1).trim() : '';
    if(!names.length) fail(file, i+1, 'voce senza nome');
    cur.items.push({name: names[0], alts: names.slice(1), value: value || null});
  });
  return out.map(t=>({
    id: 'inv_' + hash('t|'+t.title).slice(0, 12),
    pool: t.pool, category: t.category, answerType: 'top10', title: t.title,
    source: t.source, items: t.items, _file: path.basename(file), _line: t.line
  }));
}

function build(){
  const files = fs.readdirSync(SRC).sort();
  const questions = files.filter(f=>/^domande-.*\.txt$/.test(f)).flatMap(f=>parseQuestionFile(path.join(SRC, f)));
  const top10 = files.filter(f=>/^top10-.*\.txt$/.test(f)).flatMap(f=>parseTop10File(path.join(SRC, f)));
  top10.forEach(t=>{
    if(t.items.length!==10) fail(t._file, t._line, '"'+t.title+'" ha '+t.items.length+' voci invece di 10');
    delete t._file; delete t._line;
  });
  return {version: 1, questions, top10};
}

if(require.main === module){
  const json = JSON.stringify(build(), null, 1) + '\n';
  if(process.argv.includes('--check')){
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if(current !== json){ console.error('data/inventario.json non è aggiornato: esegui node scripts/build-inventario.js'); process.exit(1); }
    console.log('data/inventario.json aggiornato.');
  } else {
    fs.writeFileSync(OUT, json);
    const data = JSON.parse(json);
    console.log(data.questions.length+' domande, '+data.top10.length+' classifiche → '+path.relative(ROOT, OUT));
  }
}
module.exports = {build, seededShuffle};
