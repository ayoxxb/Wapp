// Banc du panneau de moderation : la vraie injection, un fetch simule, et on
// verifie ce qui est REELLEMENT affiche (getComputedStyle), pas le DOM seul.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const INJ = readFileSync('/home/ubuntu/worldfa-app/src-tauri/injection.js', 'utf8');

const JOUEURS = [
  { id: 12, name: 'toro5795', characterName: 'Raoul Oshimen', uid: '1234-1', ping: 42, fps: 60, staff: true, status: 'default', discordName: 'toro' },
  { id: 27, name: 'z1nn', characterName: 'Nina Vasquez', uid: '9876-2', ping: 88, fps: null, staff: false, status: 'coma', discordName: null }
];

function rendre(scenario, script) {
  const stub = `<script>
    window.__WFA_APP_TEST = true;
    window.__SCENARIO = ${JSON.stringify(scenario)};
    window.fetch = function (url) {
      var u = String(url);
      if (window.__SCENARIO === 'refuse' && u.indexOf('/api/') !== -1) {
        return Promise.resolve({ status: 403, json: function () { return Promise.resolve({}); } });
      }
      if (u.indexOf('/api/fivem-players') !== -1) {
        return Promise.resolve({ status: 200, json: function () {
          return Promise.resolve({ online: true, players: ${JSON.stringify(JOUEURS)} });
        } });
      }
      return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: true }); } });
    };
    window.onerror = function (m) {
      var p = document.createElement('pre'); p.id = 'err'; p.textContent = 'ERREUR JS: ' + m;
      document.body.appendChild(p);
    };
  </script>`;
  const page = `<!doctype html><meta charset="utf-8"><body style="background:#111;margin:0">
${stub}<script>${INJ}</script>
<script>setTimeout(function(){ ${script} }, 500);</script></body>`;
  const f = '/tmp/claude-1000/-home-ubuntu/3b36268d-f4bd-42d0-972d-cf7fb4a19c21/scratchpad/mod/p.html';
  writeFileSync(f, page);
  const dom = execFileSync(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--virtual-time-budget=4000', '--dump-dom', 'file://' + f],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 });
  const err = dom.match(/<pre id="err">([^<]*)</);
  if (err) throw new Error(err[1]);
  const m = dom.match(/<pre id="r">([\s\S]*?)<\/pre>/);
  return m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
}

const releve = (extra) => `
  var v = document.getElementById('wfa-mod');
  var vis = function(el){ return !!el && getComputedStyle(el).display !== 'none'; };
  var o = {
    panneauVisible: vis(v),
    lignes: document.querySelectorAll('#wfa-mod tbody tr').length,
    boutons: document.querySelectorAll('#wfa-mod .mod-acte').length,
    tuiles: (document.getElementById('mod-tuiles')||{}).textContent || '',
    avis: (document.querySelector('#wfa-mod .mod-avis')||{}).textContent || '',
    entreeBarre: vis(document.querySelector('.wfa-mod-ouvrir')),
    focusRecherche: document.activeElement === document.getElementById('mod-rech')
    ${extra || ''}
  };
  var p = document.createElement('pre'); p.id='r'; p.textContent = JSON.stringify(o); document.body.appendChild(p);`;

let echecs = 0;
const ok = (m) => console.log('ok  ' + m);
const ko = (m) => { echecs++; console.log('ECHEC  ' + m); };

// 1. Ferme au depart, entree presente dans la barre.
let r = rendre('normal', releve());
r.panneauVisible === false ? ok('ferme au demarrage') : ko('panneau ouvert sans raison');
r.entreeBarre ? ok('entree « Moderation » dans la barre') : ko('entree absente de la barre');

// 2. Ouverture par la barre : joueurs et actions rendus.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ ${releve()} }, 400);`);
r.panneauVisible ? ok('ouverture par la barre') : ko('le panneau ne s ouvre pas');
r.lignes === 2 ? ok('2 joueurs listes') : ko('lignes = ' + r.lignes);
r.boutons === 8 ? ok('4 actions par joueur') : ko('boutons = ' + r.boutons);
/En ligne/.test(r.tuiles) && /staff en jeu/.test(r.tuiles) ? ok('tuiles etat serveur / staff') : ko('tuiles : ' + r.tuiles);

// 3. Ctrl+K ouvre ET donne le focus a la recherche.
r = rendre('normal', `window.dispatchEvent(new KeyboardEvent('keydown', {key:'k', ctrlKey:true, bubbles:true}));
  setTimeout(function(){ ${releve()} }, 400);`);
r.panneauVisible ? ok('Ctrl+K ouvre') : ko('Ctrl+K sans effet');
r.focusRecherche ? ok('Ctrl+K met le focus sur la recherche') : ko('focus non pose');

// 4. Recherche : filtre la liste.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ var i=document.getElementById('mod-rech'); i.value='nina';
    i.dispatchEvent(new Event('input')); ${releve()} }, 400);`);
r.lignes === 1 ? ok('recherche : 1 joueur retenu') : ko('recherche -> ' + r.lignes + ' ligne(s)');

// 5. Echap ferme.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    ${releve()} }, 400);`);
r.panneauVisible === false ? ok('Echap ferme') : ko('Echap sans effet');

// 6. 403 : message clair, aucune liste, aucune exception.
r = rendre('refuse', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ ${releve()} }, 500);`);
/permission/i.test(r.avis) ? ok('403 : message de permission') : ko('avis : ' + r.avis);
r.lignes === 0 ? ok('403 : aucune ligne') : ko('403 mais ' + r.lignes + ' lignes');

console.log(echecs ? '\n' + echecs + ' echec(s).' : '\nPanneau de moderation : tout passe.');
process.exit(echecs ? 1 : 0);
