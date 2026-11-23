// Prépare le site pour GitHub Pages :
// copie les fichiers dans _site/ et crée une petite page par document (r/…) et par bilan (bilan/…),
// avec les informations d'aperçu (titre, résumé) que Discord et les autres messageries affichent.
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..'), SORTIE = path.join(RACINE, process.argv[2] || '_site');
const IGNORER = new Set(['.git', '.github', 'outils', '_site', 'node_modules']);

function copier(de, vers) {
  fs.mkdirSync(vers, { recursive: true });
  for (const nom of fs.readdirSync(de)) {
    if (IGNORER.has(nom)) continue;
    const a = path.join(de, nom), b = path.join(vers, nom);
    if (fs.statSync(a).isDirectory()) copier(a, b); else fs.copyFileSync(a, b);
  }
}
fs.rmSync(SORTIE, { recursive: true, force: true });
copier(RACINE, SORTIE);

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateLongue = iso => { if (!iso) return ''; const p = iso.split('-'); return (+p[2]) + (p[2] === '01' ? 'er' : '') + ' ' + MOIS[+p[1] - 1] + ' ' + p[0]; };
const texte = md => String(md || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^>\s?/gm, '').replace(/^#+\s*/gm, '')
  .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '').replace(/^\s*([-*+]|\d+\.)\s+/gm, '').replace(/[*_`~|]/g, '').replace(/^-{3,}$/gm, '').replace(/\s+/g, ' ').trim();
const resume = (t, n) => t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
const COULEURS = { rapports: '#e8751a', decouvertes: '#2f7fe0', remarques: '#2e8b57' };
const SUIVIS = { transmis: ['Transmis', 'à'], examen: ["En cours d'examen", 'par'], valide: ['Validé', 'par'], 'a-revoir': ['À revoir', 'par'] };
const suiviTexte = e => { const s = SUIVIS[e.suivi]; return s ? s[0] + (e.suiviPar ? ' ' + s[1] + ' ' + e.suiviPar : '') : ''; };

function isoUTC(d) { return d.toISOString().slice(0, 10); }
function semaineDe(iso) {
  const d = new Date(iso + 'T00:00:00Z'), j = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - j + 3);
  const an = d.getUTCFullYear(), j4 = new Date(Date.UTC(an, 0, 4));
  const n = 1 + Math.round((d - j4) / 864e5 / 7 + ((j4.getUTCDay() + 6) % 7 - 3) / 7);
  return an + '-S' + String(n).padStart(2, '0');
}
function bornesSemaine(p) {
  const m = /^(\d{4})-S(\d{2})$/.exec(p), j4 = new Date(Date.UTC(+m[1], 0, 4));
  const lundi = new Date(+j4 - ((j4.getUTCDay() + 6) % 7) * 864e5 + (+m[2] - 1) * 7 * 864e5);
  return [isoUTC(lundi), isoUTC(new Date(+lundi + 6 * 864e5))];
}

function page(chemin, { titre, description, cible, couleur, image, type }) {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titre)} · Casier d'Arumi Tenzo</title>
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="Casier d'Arumi Tenzo · Section scientifique">
<meta property="og:type" content="${type || 'article'}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<meta name="theme-color" content="${couleur || '#2e8b57'}">
<meta http-equiv="refresh" content="0; url=${esc(cible)}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#f4f1ea;color:#222}a{color:#2e8b57}@media(prefers-color-scheme:dark){body{background:#16181b;color:#e8e6e1}}</style>
</head>
<body><p>Ouverture du casier… <a href="${esc(cible)}">clique ici si rien ne se passe</a>.</p>
<script>location.replace(${JSON.stringify(cible)});</script></body>
</html>
`;
  const f = path.join(SORTIE, chemin);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}

let data = { rubriques: [], entrees: [] };
try { data = JSON.parse(fs.readFileSync(path.join(RACINE, 'donnees', 'casier.json'), 'utf8')); } catch (e) { console.log('Pas de donnees/casier.json :', e.message); }
const rub = id => (data.rubriques || []).find(r => r.id === id) || { label: id, singulier: id };
const entrees = data.entrees || [];

for (const e of entrees) {
  const r = rub(e.rubrique), t = texte(e.contenu);
  const img = /!\[[^\]]*\]\(\s*<?(https:\/\/[^)\s>]+)/.exec(e.contenu || '');
  const infos = [r.singulier + (e.type ? ' ' + e.type.toLowerCase() : ''), dateLongue(e.date), e.auteur ? 'par ' + e.auteur : '', suiviTexte(e)].filter(Boolean).join(' · ');
  page('r/' + e.id.replace(/\//g, '--') + '.html', {
    titre: e.titre, description: infos + (t ? '\n' + resume(t, 220) : ''),
    cible: '../#/e/' + encodeURIComponent(e.id), couleur: COULEURS[e.rubrique], image: img && img[1],
  });
}

const periodes = new Map();
for (const e of entrees) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) continue;
  for (const p of [semaineDe(e.date), e.date.slice(0, 7)]) { if (!periodes.has(p)) periodes.set(p, []); periodes.get(p).push(e); }
}
for (const [p, docs] of periodes) {
  const comptes = (data.rubriques || []).map(r => [r, docs.filter(e => e.rubrique === r.id).length]).filter(x => x[1])
    .map(([r, n]) => n + ' ' + (n > 1 ? r.label : r.singulier).toLowerCase()).join(', ');
  const valides = docs.filter(e => e.suivi === 'valide').length;
  let titre, quand;
  if (/-S/.test(p)) { const b = bornesSemaine(p); titre = 'Bilan de la semaine ' + (+p.slice(6)); quand = 'Du ' + dateLongue(b[0]) + ' au ' + dateLongue(b[1]); }
  else { titre = 'Bilan du mois de ' + MOIS[+p.slice(5) - 1] + ' ' + p.slice(0, 4); quand = MOIS[+p.slice(5) - 1].replace(/^./, c => c.toUpperCase()) + ' ' + p.slice(0, 4); }
  page('bilan/' + p + '.html', {
    titre, type: 'website', cible: '../#/bilan/' + p,
    description: quand + ' · ' + comptes + (valides ? ' · ' + valides + ' validé' + (valides > 1 ? 's' : '') : '') + '\n' +
      docs.slice(0, 5).map(e => '• ' + e.titre).join('\n') + (docs.length > 5 ? '\n…' : ''),
  });
}
console.log(`Site prêt dans ${path.relative(RACINE, SORTIE)} : ${entrees.length} page(s) de document, ${periodes.size} page(s) de bilan.`);
