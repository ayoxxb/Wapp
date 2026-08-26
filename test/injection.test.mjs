/**
 * La barre laterale injectee : syntaxe, garde d'origine, et invariants que le
 * navigateur ne verifie pas (elle est injectee par Tauri, jamais servie —
 * une faute ici ne se verrait qu'une fois l'application installee).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src-tauri/injection.js', import.meta.url), 'utf8');
const ok = (m) => console.log('ok  ' + m);

// Compile comme le ferait le webview.
new Function(src);
ok('syntaxe');

// La garde d'origine : le script se neutralise hors de worldfa.fr — il tourne
// aussi sur discord.com pendant l'OAuth, ou il n'a rien a poser.
assert.match(src, /worldfa\\\.fr\$?\//, 'garde sur location.hostname');
assert.ok(src.indexOf('location.hostname') !== -1);
ok('garde d origine');

// Les cinq categories demandees, et rien d'autre en dur.
for (const chemin of ['/fivem/anticheat', '/admin/sessions', '/admin/panel-fivem', '/admin/giveaway', '/achat-boutique']) {
  assert.ok(src.includes("'" + chemin + "'"), 'categorie ' + chemin);
}
ok('les cinq categories');

// Le bouton de mise a jour est cache par defaut et pilote par la comparaison
// de versions — jamais affiche sans une version plus recente.
assert.ok(src.includes("display: none") && src.includes('maj_disponible') && src.includes('maj_installer'));
ok('bouton de mise a jour');

// Aucune double pose : le script est injecte a CHAQUE navigation.
assert.ok(src.includes('__WFA_APP_POSEE'));
ok('anti double injection');

// L'IPC absent ne doit jamais faire tomber la barre : chaque invoke est
// enveloppe et rend une promesse rejetee, pas une exception.
assert.ok(src.includes("Promise.reject"));
ok('degradation sans IPC');

// La barre de titre remplace celle de Windows : sans elle, la fenetre est
// indeplacable et sans bouton fermer — y compris pendant l'OAuth Discord,
// d'ou sa pose sur TOUTES les origines quand la barre laterale, elle, reste
// cantonnee a worldfa.fr.
assert.ok(src.includes('data-tauri-drag-region'), 'bande saisissable');
assert.ok(src.includes('toggleMaximize') && src.includes('minimize') && src.includes('w.close()'), 'les trois boutons');
assert.ok(src.includes('poserBarreTitre();') && src.includes('if (!SUR_WORLDFA) return;'), 'titre partout, sidebar seulement worldfa');
ok('barre de titre');

console.log('\nBarre laterale : tous les invariants tiennent.');
