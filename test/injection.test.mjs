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

// Mode admin pur : la racine publique renvoie vers /admin avant tout
// affichage, et le bandeau public disparait sur les pages hors admin.
assert.ok(src.includes("location.replace('/admin')"), 'racine redirigee');
assert.ok(src.includes('.topbar { display: none !important; }'), 'bandeau public masque');
ok('mode admin pur');

// Chaque categorie a son ajustement : bouton retour masque et depart aligne.
assert.ok(src.includes('AJUSTEMENTS'), 'table des ajustements');
for (const chemin of ['/fivem/anticheat', '/admin/sessions', '/admin/panel-fivem', '/admin/giveaway', '/achat-boutique']) {
  assert.ok(src.includes("'" + chemin + "':"), 'ajustement ' + chemin);
}
assert.ok(src.includes('.retour { display: none !important; }'), 'bouton retour masque');
ok('ajustements par categorie');

// --- Tous les outils du hub (28/08/2026) -----------------------------------
// La barre doit lister les MEMES 18 outils que worldfa.fr/admin : un outil
// present dans le hub et absent ici serait introuvable dans l'application.
const CHEMINS = [
  '/fivem', '/fivem/stats', '/admin/reports', '/fivem/anticheat', '/admin/panel-fivem',
  '/ticket', '/admin/giveaway', '/admin/boost', '/achat-boutique',
  '/admin/planning', '/ticket/stats-tickets', '/forms/gestion', '/forms/admin', '/forms/candidature-pole-ggo',
  '/admin/sessions', '/admin/wiki', '/graph', '/groupe-graph'
];
for (const chemin of CHEMINS) {
  assert.ok(src.includes("'" + chemin + "'"), 'outil manquant dans la barre : ' + chemin);
}
for (const titre of ['Serveur de jeu', 'Joueurs & récompenses', 'Équipe & candidatures', 'Site & supervision']) {
  assert.ok(src.includes("'" + titre + "'"), 'groupe manquant : ' + titre);
}
ok('les 18 outils, dans leurs 4 groupes');

// Aucun doublon : un chemin liste deux fois allumerait deux liens actifs.
const listes = [...src.matchAll(/\{ chemin: '([^']+)'/g)].map((m) => m[1]);
assert.equal(new Set(listes).size, listes.length, 'chemin en double dans GROUPES');
assert.equal(listes.length, 18, '18 liens attendus, ' + listes.length + ' trouves');
ok('aucun doublon de chemin');

// --- Le lien actif : correspondance la PLUS LONGUE --------------------------
// Le vrai piege des chemins emboites : /fivem/stats commence par /fivem. Une
// correspondance de prefixe naive allumait deux liens — ou le mauvais. La
// fonction est extraite et REELLEMENT exercee : un simple grep de source
// n'aurait rien prouve.
const texteFonction = src.slice(src.indexOf('function cheminLePlusPrecis'));
const corps = texteFonction.slice(0, texteFonction.indexOf('\n  }') + 4);
const fabriquer = (pathname) => new Function('location', corps + '; return cheminLePlusPrecis;')({ pathname });

for (const [pathname, attendu] of [
  ['/fivem', '/fivem'],
  ['/fivem/stats', '/fivem/stats'],
  ['/fivem/anticheat', '/fivem/anticheat'],
  ['/ticket', '/ticket'],
  ['/ticket/stats-tickets', '/ticket/stats-tickets'],
  ['/forms/gestion', '/forms/gestion'],
  // Sous-page d'un outil : c'est bien l'outil qui reste allume.
  ['/admin/giveaway/quelque-chose', '/admin/giveaway'],
  // Rien de connu : aucun lien allume, et surtout pas le premier de la liste.
  ['/une-page-inconnue', ''],
  // Piege du prefixe sans separateur : /fivemachin n'est PAS /fivem.
  ['/fivemachin', '']
]) {
  const choisir = fabriquer(pathname);
  assert.equal(choisir(CHEMINS), attendu, 'lien actif sur ' + pathname);
}
ok('lien actif : le chemin le plus precis gagne');

// Les pages qu'on NE touche PAS : plusieurs se calent en height:100vh
// (Support-World), un padding-top impose y decalerait la mise en page.
for (const chemin of ['/ticket', '/fivem', '/graph', '/groupe-graph', '/forms/gestion']) {
  assert.ok(!src.includes("'" + chemin + "':"), 'ajustement pose a tort sur ' + chemin);
}
ok('aucun ajustement a l aveugle');

// Les pages worldfa au gabarit admin, elles, DOIVENT avoir le leur — sinon
// leur bouton retour double la barre et une bande vide s'ouvre en tete.
// /admin/planning et /admin/wiki nomment ce bouton « back » et non
// « retour » : c'est ce qui les avait fait oublier (revue du 28/08/2026).
for (const chemin of ['/admin/reports', '/admin/boost', '/admin/planning', '/admin/wiki']) {
  assert.ok(src.includes("'" + chemin + "':"), 'ajustement manquant pour ' + chemin);
}
// Le selecteur doit viser le SEUL lien de retour : admin-wiki porte un second
// .back (« Voir la page publique ») qu'un « .back » nu effacerait aussi.
assert.ok(src.includes('.back[href="/admin"] { display: none !important; }'), 'retour .back masque');
assert.ok(!src.includes("'.back { display: none !important; }'"), 'selecteur .back trop large');
ok('ajustements des pages du gabarit admin');

// Barre repliee : tout le panneau est masque, BOUTON DE MISE A JOUR COMPRIS,
// et le repli est memorise (localStorage). Sans pastille sur la poignee, on
// pouvait rester des semaines sans jamais voir qu'une version attend
// (defaut anterieur, releve par la revue du 28/08/2026).
assert.ok(src.includes('body.wfa-replie #wfa-app-bar { display: none; }'), 'repli masque bien la barre');
assert.ok(src.includes("poignee.classList.add('wfa-maj')"), 'pastille posee quand une maj attend');
assert.ok(src.includes('#wfa-app-poignee.wfa-maj::after'), 'style de la pastille');
ok('mise a jour signalee barre repliee');

// --- Tableau de bord de moderation (28/08/2026) -----------------------------
// Invariants rapides ; le rendu reel (ouverture, actions, recherche, 403) est
// verifie par test/banc-moderation.mjs, qui lance un vrai navigateur.
assert.ok(src.includes('poserModeration()'), 'moderation posee depuis poser()');
// Le panneau vit APRES la garde SUR_WORLDFA : rien ne doit s'afficher ni se
// sonder sur discord.com pendant l'OAuth.
// L'APPEL (avec le point-virgule), pas la declaration : `poserModeration()`
// nu attrapait d'abord `function poserModeration()`, qui vit forcement plus
// haut — l'assertion echouait sur du code pourtant juste.
assert.ok(src.indexOf('if (!SUR_WORLDFA) return;') < src.indexOf('poserModeration();'),
  'moderation posee apres la garde d origine');
// Les quatre gestes, sur les chemins REELS de Support-World (prefixe /fivem
// ajoute par modApi : Apache le retire).
for (const route of ['/api/fivem/kick', '/api/fivem/ban', '/api/fivem/freeze', '/api/fivem/message', '/api/fivem-players']) {
  assert.ok(src.includes("'" + route + "'"), 'route ' + route);
}
// Le ban de cette fenetre est TEMPORAIRE : la route refuse minutes <= 0.
assert.ok(src.includes('minutes') && src.includes('Duree invalide'), 'ban : duree exigee');
// Le gel est une bascule sans idempotence : un verrou par joueur est
// obligatoire, sinon un double-clic degele ce qu'on vient de geler.
assert.ok(src.includes('MOD.enCours[id]'), 'verrou par joueur');
// Sans promotion de session sur /api/, un 401 doit etre rejoue apres avoir
// charge une page Support-World.
assert.ok(src.includes('reveillerSession') && src.includes('modApiSure'), 'reveil de session sur 401');
// Rien ne tourne panneau ferme.
assert.ok(src.includes('clearInterval(MOD.minuteur)'), 'sondage arrete a la fermeture');
ok('tableau de bord de moderation');

console.log('\nBarre laterale : tous les invariants tiennent.');
