#!/usr/bin/env node
// Exportiert EIN Applet aus der Lernzentrale als eigenständige Seite.
//
//   node tools/export.mjs <lernzentrale.html> <key> <fach> [titel-fuer-kachel]
//
// - <lernzentrale.html>: gespeicherte HTML der Lernzentrale (Artifact read)
// - <key>: Schlüssel des Applets in der ANIM-Engine, z. B. lorentz
// - <fach>: Ordner unter applets/, z. B. optik
//
// Ergebnis: applets/<fach>/<key>.html. Die Engine wird übernommen, alle anderen
// Applets (D.<anderer key>) werden entfernt. Schriften und KaTeX kommen vom CDN.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const acorn = require('acorn');

const [src, key, fach] = process.argv.slice(2);
if (!src || !key || !fach) {
  console.error('Aufruf: node tools/export.mjs <lernzentrale.html> <key> <fach>');
  process.exit(1);
}
const html = fs.readFileSync(src, 'utf8');

// 1) CSS: alle <style>-Blöcke, ohne eingebettete Schriften (sehr lange Zeilen / @font-face)
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
const css = styles.join('\n').split('\n')
  .filter(l => l.length < 4000 && !/^\s*@font-face/.test(l))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// 2) JS: den Script-Block mit der ANIM-Engine finden
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engine = scripts.find(s => /const ANIM=\(\(\)=>\{/.test(s));
if (!engine) throw new Error('ANIM-Engine nicht gefunden');

// 3) Alle anderen Applets entfernen (nur Zuweisungen D.<x>=… direkt im Engine-Rumpf)
const comments = [];
const ast = acorn.parse(engine, { ecmaVersion: 'latest', sourceType: 'script', onComment: comments });
let body = null;
for (const st of ast.body) {
  if (st.type !== 'VariableDeclaration') continue;
  for (const d of st.declarations) {
    if (d.id.name === 'ANIM') body = d.init.callee.body.body;
  }
}
if (!body) throw new Error('ANIM-Rumpf nicht gefunden');
const isD = st => st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression'
  && st.expression.left.type === 'MemberExpression' && st.expression.left.object.name === 'D';
const keys = body.filter(isD).map(st => st.expression.left.property.name);
if (!keys.includes(key)) throw new Error(`Applet "${key}" nicht gefunden. Vorhanden: ${keys.join(', ')}`);
const block = body.find(st => isD(st) && st.expression.left.property.name === key);

// Änderungen als Bereiche [von, bis, Ersatz]: andere Applets raus, Kommentare raus, info leeren
const edits = [];
body.filter(st => isD(st) && st !== block).forEach(st => edits.push([st.start, st.end, '']));
comments.forEach(c => edits.push([c.start, c.end, c.type === 'Line' ? '' : ' ']));
// info (Quellen mit Namen von Skript/VO) wird nie veröffentlicht -> leer, dann gibt es keinen Info-Reiter
(function walk(n) {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'Property' && !n.computed && (n.key.name === 'info' || n.key.value === 'info'))
    edits.push([n.value.start, n.value.end, "''"]);
  for (const k in n) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
  }
})(block);
// überlappende Bereiche zusammenfassen (Kommentare in entfernten Applets), dann von hinten anwenden
edits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
const merged = [];
for (const e of edits) {
  const last = merged[merged.length - 1];
  if (last && e[0] < last[1]) { if (e[1] > last[1]) last[1] = e[1]; continue; }
  merged.push([...e]);
}
let js = engine;
for (const [a, b, r] of merged.reverse()) js = js.slice(0, a) + r + js.slice(b);
const removed = body.filter(isD).length - 1;

// 5) Seite zusammensetzen
const out = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Applet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;700&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js"></script>
<style>
${css}
.pub-wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.pub-top{padding-top:4px}
.pub-top a{font-size:15px}
</style>
</head>
<body>
<div class="pub-wrap">
  <header class="pub-top"><a href="../../index.html">← Alle Applets</a></header>
  <div id="pub-app"></div>
</div>
<script>
${js}
</script>
<script>
(function(){
  var key=${JSON.stringify(key)};
  var t=ANIM.title(key);
  document.title=t.replace(/\\$[^$]*\\$/g,'').replace(/\\s+/g,' ').trim()||'Applet';
  var app=document.getElementById('pub-app');
  app.innerHTML=ANIM.html(key,'pub-'+key);
  ANIM.mount(app);
})();
</script>
</body>
</html>
`;
// 6) Filter: nichts Persönliches, nichts zu Prüfungen. Bei einem Treffer wird NICHTS geschrieben.
const tools = path.dirname(new URL(import.meta.url).pathname);
const sperrDatei = process.env.SPERRLISTE || path.join(tools, 'sperrliste.local.txt');
if (!fs.existsSync(sperrDatei)) {
  console.error(`Abbruch: Sperrliste fehlt (${sperrDatei}). Namen von Profs und Personen aus der Lernzentrale eintragen, eine Zeile pro Name.`);
  process.exit(2);
}
const namen = fs.readFileSync(sperrDatei, 'utf8').split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('#'));
const woerter = ['Altprüfung', 'Prüfung', 'Probeprüfung', 'Klausur', 'Übungsblatt', 'Übungsbeispiel', 'Gedächtnisprotokoll',
  'Altfrage', 'Prof', 'Professor', 'Professorin', 'Lernzentrale', 'RemNote', 'Moodle', 'Matrikel', 'u:find', 'Discord',
  'Nachtschicht', 'Alessio', 'Ospelt', 'Oisela', 'Skript', 'Folie'];
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const muster = new RegExp('(' + [...woerter, ...namen].map(esc).join('|') + ')', 'giu');
const treffer = [];
for (const m of out.matchAll(muster)) {
  const a = Math.max(0, m.index - 40), b = Math.min(out.length, m.index + m[0].length + 40);
  treffer.push(`  „${m[0]}“: …${out.slice(a, b).replace(/\s+/g, ' ')}…`);
}
if (treffer.length) {
  console.error(`Abbruch, ${treffer.length} Treffer. Bitte im Applet in der Lernzentrale ändern und neu exportieren:`);
  console.error(treffer.slice(0, 30).join('\n'));
  process.exit(3);
}

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'applets', fach);
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, key + '.html');
fs.writeFileSync(file, out);
console.log(`${file} (${(out.length / 1024).toFixed(0)} KB), entfernt: ${removed} andere Applets, Filter ok`);
