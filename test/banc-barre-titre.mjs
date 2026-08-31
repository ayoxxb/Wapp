// Banc de la barre de titre et des ajustements par page.
//
// Tout ce qui est verifie ici depend du CHEMIN de la page : le nom affiche
// dans la barre, le lien allume dans la barre laterale, et les ajustements
// CSS propres a chaque page. Le rendu se fait en file:// — Chrome sans tete
// se fige sur une URL http:// avec --virtual-time-budget — et le chemin est
// donne par `__WFA_APP_TEST_CHEMIN`, le crochet de banc de l'injection.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const INJ = readFileSync('/home/ubuntu/worldfa-app/src-tauri/injection.js', 'utf8');

// Le contenu est le meme quel que soit le chemin demande : c'est le chemin
// lui-meme qu'on fait varier. `retour`/`back` imitent les boutons que les
// pages du site trainent en tete et que l'application masque.
function page(chemin, script, titreDoc) {
  return `<!doctype html><meta charset="utf-8"><title>${titreDoc || ''}</title>
<body style="background:#111;margin:0">
<a class="retour" href="/admin">Espace admin</a>
<a class="back" href="/admin">Retour</a>
<a class="back" href="/wiki">Voir la page publique</a>
<script>
  window.__WFA_APP_TEST = true;
  window.__WFA_APP_TEST_CHEMIN = ${JSON.stringify(chemin)};
  window.fetch = function () { return Promise.resolve({ status: 200, ok: true,
    json: function () { return Promise.resolve({ ok: true }); } }); };
  window.onerror = function (m) {
    var p = document.createElement('pre'); p.id = 'err'; p.textContent = 'ERREUR JS: ' + m;
    document.body.appendChild(p);
  };
</script>
<script>${INJ}</script>
<script>setTimeout(function(){ ${script} }, 400);</script></body>`;
}

const FICHIER = '/tmp/claude-1000/-home-ubuntu/416a4ab2-d28b-4c6a-bad6-bff7db9c00de/scratchpad/banc-barre-titre.html';

function rendre(chemin, script, titreDoc) {
  writeFileSync(FICHIER, page(chemin, script, titreDoc));
  const dom = execFileSync(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=1400,900', '--virtual-time-budget=4000', '--dump-dom',
    'file://' + FICHIER],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 });
  const err = dom.match(/<pre id="err">([^<]*)</);
  if (err) throw new Error(err[1]);
  const m = dom.match(/<pre id="r">([\s\S]*?)<\/pre>/);
  return m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
}

const releve = (extra) => `
  var vis = function (el) { return !!el && getComputedStyle(el).display !== 'none'; };
  var o = {
    nomPage: (document.querySelector('#wfa-titlebar .wfa-tb-page') || {}).textContent || '',
    nav: Array.prototype.map.call(document.querySelectorAll('#wfa-titlebar .wfa-tb-nav button'),
      function (b) { return b.title; }),
    lienActif: (document.querySelector('#wfa-app-bar nav a.actif') || {}).textContent || '',
    filPresent: !!document.getElementById('wfa-charge'),
    filActif: !!document.querySelector('#wfa-charge.actif'),
    retourVisible: vis(document.querySelector('.retour')),
    backAdminVisible: vis(document.querySelector('.back[href="/admin"]')),
    backPublicVisible: vis(document.querySelector('.back[href="/wiki"]')),
    zoomEtiquette: (document.querySelector('#wfa-titlebar .wfa-tb-zoom') || {}).textContent || '',
    zoomRetenu: localStorage.getItem('wfa_app_zoom') || ''
    ${extra || ''}
  };
  var p = document.createElement('pre'); p.id = 'r'; p.textContent = JSON.stringify(o); document.body.appendChild(p);`;

let echecs = 0;
const ok = (m) => console.log('ok  ' + m);
const ko = (m) => { echecs += 1; console.log('ECHEC  ' + m); };

// 1. Les trois gestes de navigation que la coquille n'avait pas.
let r = rendre('/admin', releve());
r.nav.length === 3 ? ok('barre de titre : 3 boutons de navigation') : ko('boutons = ' + JSON.stringify(r.nav));
  /Précédent/.test(r.nav[0] || '') && /Suivant/.test(r.nav[1] || '') && /Recharger/.test(r.nav[2] || '')
    ? ok('barre de titre : précédent, suivant, recharger') : ko('titres : ' + JSON.stringify(r.nav));

// 2. Le nom de la page vient de la MEME table que la barre laterale : le
// libelle affiche en haut et le lien allume a gauche disent la meme chose.
r = rendre('/fivem/stats', releve());
r.nomPage === 'Stats de tir' ? ok('nom de page : /fivem/stats -> Stats de tir') : ko('nom = ' + r.nomPage);
r.lienActif === 'Stats de tir' ? ok('lien actif : le chemin le plus precis gagne (pas /fivem)') : ko('lien actif = ' + r.lienActif);

r = rendre('/admin/reports', releve());
r.nomPage === 'Reports' ? ok('nom de page : /admin/reports -> Reports') : ko('nom = ' + r.nomPage);

// 3. Une page d'admin hors du hub : le nom du hub n'existe pas, on retombe
// sur « Espace admin » plutot que d'afficher un chemin brut.
r = rendre('/admin/inconnue', releve());
r.nomPage === 'Espace admin' ? ok('nom de page : page d admin inconnue -> Espace admin') : ko('nom = ' + r.nomPage);

// 4. Page hors hub et hors /admin : son propre titre.
r = rendre('/wiki', releve(), 'Wiki World:FA');
r.nomPage === 'Wiki World:FA' ? ok('nom de page : titre du document en dernier recours') : ko('nom = ' + r.nomPage);

// 5. AJUSTEMENTS : verifies par le RENDU, sur le vrai chemin. Sur
// /admin/reports le bouton « retour » du site disparait (la barre laterale
// est la navigation) ; sur /admin/wiki, c'est le retour vers /admin qui
// part, et SEULEMENT lui — « Voir la page publique » porte la meme classe.
r = rendre('/admin/reports', releve());
r.retourVisible === false ? ok('/admin/reports : bouton retour masque') : ko('.retour encore visible');

r = rendre('/admin/wiki', releve());
r.backAdminVisible === false ? ok('/admin/wiki : retour vers /admin masque') : ko('.back[href=/admin] visible');
r.backPublicVisible ? ok('/admin/wiki : « Voir la page publique » conserve') : ko('les deux .back ont ete masques');

// 6. Une page sans ajustement ne doit RIEN perdre : ces pages-la ne viennent
// pas du gabarit admin, leur imposer une regle a l aveugle les casserait.
r = rendre('/fivem', releve());
r.retourVisible ? ok('/fivem : aucun ajustement a l aveugle') : ko('/fivem a perdu son bouton retour');

// 7. Le fil de chargement : present, eteint une fois la page chargee, et
// rallume des qu une navigation part (c est la que l attente se voit).
r = rendre('/admin', releve());
r.filPresent ? ok('fil de chargement pose') : ko('fil absent');
r.filActif === false ? ok('fil eteint apres chargement') : ko('fil encore actif');

r = rendre('/admin', `window.dispatchEvent(new Event('beforeunload')); ${releve()}`);
r.filActif ? ok('fil rallume au depart d une navigation') : ko('fil eteint pendant une navigation');

// 8. Zoom : le palier est retenu et annonce dans la barre. Sans IPC Tauri
// (ici), l'appel au webview echoue en silence — le reglage doit quand meme
// etre memorise, sinon il serait perdu a la page suivante. Le point de depart
// est pose explicitement : le profil Chrome garde le localStorage d'un
// rendu a l'autre, un reste d'essai precedent fausserait la mesure.
r = rendre('/admin', `localStorage.setItem('wfa_app_zoom', '1');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true }));
    ${releve()}`);
r.zoomRetenu === '1.1' ? ok('Ctrl + : palier suivant retenu') : ko('zoom retenu = ' + r.zoomRetenu);
r.zoomEtiquette === '110 %' ? ok('Ctrl + : palier annonce dans la barre') : ko('etiquette = ' + r.zoomEtiquette);

r = rendre('/admin', `localStorage.setItem('wfa_app_zoom', '1.25');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }));
    ${releve()}`);
r.zoomRetenu === '1' ? ok('Ctrl 0 : retour a 100 %') : ko('zoom retenu = ' + r.zoomRetenu);
r.zoomEtiquette === '' ? ok('Ctrl 0 : plus rien a annoncer a 100 %') : ko('etiquette = ' + r.zoomEtiquette);

// 9. Une fleche NUE doit rester a la page : les tableaux d'administration
// s'en servent pour se deplacer, la coquille ne doit pas les avaler.
//
// Ni F5 ni Alt+← ne sont joues ici, volontairement : tous deux declenchent une
// vraie navigation (rechargement, retour), et sous --virtual-time-budget
// Chrome sans tete ne rend alors JAMAIS la main — le banc tournait en boucle.
// Que la touche soit prise, on le sait deja par le zoom du controle 8, qui
// passe par le meme ecouteur ; leur cablage exact est verifie dans les
// invariants de `npm test`.
r = rendre('/admin', `
    var simple = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    window.dispatchEvent(simple);
    ${releve(`, flechePrise: simple.defaultPrevented`)}`);
r.flechePrise === false ? ok('une fleche seule reste a la page') : ko('la coquille avale les fleches nues');

// 10. L'ECRAN HORS LIGNE (0.1.8) : c'est une page LOCALE de l'application,
// donc l'injection n'y pose que la barre de titre — sans elle, une fenetre
// sans decoration systeme serait indeplacable. On verifie aussi qu'elle ne
// deborde pas : la barre decale le corps de 34 px sans rien retirer a 100vh,
// et une page calee sur 100vh gagnerait une barre de defilement pour rien.
{
  const horsLigne = readFileSync('/home/ubuntu/worldfa-app/dist/hors-ligne.html', 'utf8')
    // On garde la page telle quelle, en y glissant l'injection : c'est
    // exactement ce que fait Tauri (initialization_script).
    .replace('</head>', '<script>window.fetch = function () { return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({}); } }); };<' + `/script><script>${INJ}</script></head>`)
    .replace('</body>', `<script>setTimeout(function () {
      var o = {
        barreTitre: !!document.getElementById('wfa-titlebar'),
        barreLaterale: !!document.getElementById('wfa-app-bar'),
        nomPage: (document.querySelector('#wfa-titlebar .wfa-tb-page') || {}).textContent || '',
        bouton: (document.getElementById('reessayer') || {}).textContent || '',
        deborde: document.documentElement.scrollHeight > window.innerHeight
      };
      var p = document.createElement('pre'); p.id = 'r'; p.textContent = JSON.stringify(o);
      document.body.appendChild(p);
    }, 400);</` + 'script></body>');
  writeFileSync(FICHIER, horsLigne);
  const dom = execFileSync(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=1400,900', '--virtual-time-budget=4000', '--dump-dom', 'file://' + FICHIER],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 });
  const m = dom.match(/<pre id="r">([\s\S]*?)<\/pre>/);
  const h = m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : {};
  h.barreTitre ? ok('hors ligne : barre de titre posee (fenetre deplacable)') : ko('hors ligne : aucune barre de titre');
  h.barreLaterale === false ? ok('hors ligne : pas de barre laterale (page locale)') : ko('barre laterale posee hors de worldfa.fr');
  h.nomPage === 'Hors ligne' ? ok('hors ligne : la barre nomme l ecran') : ko('nom = ' + h.nomPage);
  /Réessayer/.test(h.bouton) ? ok('hors ligne : bouton Réessayer') : ko('bouton = ' + h.bouton);
  h.deborde === false ? ok('hors ligne : aucun debordement sous la barre de titre') : ko('la page deborde de 34 px');
}

console.log(echecs ? '\n' + echecs + ' echec(s).' : '\nBarre de titre et ajustements : tout passe.');
process.exit(echecs ? 1 : 0);
