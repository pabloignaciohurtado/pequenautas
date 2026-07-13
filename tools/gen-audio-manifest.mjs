#!/usr/bin/env node
/* Escanea audio/<lang>/*.mp3 y lista las claves cuyo clip existe en TODOS los idiomas.
   Uso:  node tools/gen-audio-manifest.mjs
   Copia el array impreso a AUDIO_MANIFEST.available en app.js. */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root  = join(dirname(fileURLToPath(import.meta.url)), '..');
const base  = join(root, 'audio');
const langs = ['es', 'en'];
const ext   = '.mp3';

function keysIn(lang){
  const dir = join(base, lang);
  if(!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter(f => f.endsWith(ext)).map(f => f.slice(0, -ext.length)));
}

const sets = langs.map(keysIn);
const ready = [...sets[0]].filter(k => sets.every(s => s.has(k))).sort();

console.log('Claves con clip en todos los idiomas:', ready.length);
console.log('\nPega esto en AUDIO_MANIFEST.available (app.js):\n    available: ' + JSON.stringify(ready));
