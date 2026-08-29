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

// LARGEUR DE RENDU EXPLICITE. Le defaut de Chrome sans tete est 780x493 : sous
// le seuil de repli automatique de la barre (1100 px), elle s'y masquait toute
// seule et les controles qui la regardent ne prouvaient plus rien. On rend donc
// dans une fenetre courante, et le repli a son propre controle (10) qui, lui,
// choisit sa largeur.
function rendre(scenario, script, largeur) {
  const stub = `<script>
    window.__WFA_APP_TEST = true;
    window.__SCENARIO = ${JSON.stringify(scenario)};
    window.fetch = function (url) {
      var u = String(url);
      if (window.__SCENARIO === 'refuse' && u.indexOf('/api/') !== -1) {
        return Promise.resolve({ status: 403, json: function () { return Promise.resolve({}); } });
      }
      if (u.indexOf('/api/fivem-players-offline') !== -1) {
        return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({ ok: true, players: [
          { unique_id: '5555', character_id: 77, character_name: 'Hugo Sorensen', uid: '5555-77', last_seen_label: '12/08/2026 21:04', steam_name: 'hugo' }
        ] }); } });
      }
      if (u.indexOf('/api/fivem-players') !== -1) {
        return Promise.resolve({ status: 200, json: function () {
          return Promise.resolve({ online: true, players: ${JSON.stringify(JOUEURS)} });
        } });
      }
      if (u.indexOf('/api/fivem-player-info') !== -1) {
        return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ info: {
          name: 'Raoul Oshimen', uid: '1234', faction: 'PF', playtime: '12 h', stars: '40',
          health: 187, armour: 55, phone: '12345', radio: 'Éteinte', frozen: false, discordId: '312910627507011584'
        } }); } });
      }
      if (u.indexOf('/api/fivem-offline-player') !== -1) {
        return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: true,
          account: { unique_id: '5555', discord_id: '999', stars: 12 },
          characters: [{ id: 77, firstname: 'Hugo', lastname: 'Sorensen', faction_name: 'Aucune', last_played_label: '12/08/2026' }]
        }); } });
      }
      if (u.indexOf('/api/fivem-sanctions') !== -1) {
        return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: true, sanctions: [
          { id: 1, kind: 'kick', reason: 'AFK', minutes: null, atLabel: '20/08 18:00', by: 'staffA' }
        ] }); } });
      }
      if (u.indexOf('/api/admin/reports') !== -1) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ reports: [
          { id: 1, clotureeLe: null }, { id: 2, clotureeLe: 123 }, { id: 3, clotureeLe: null }
        ] }); } });
      }
      if (u.indexOf('/ticket/api/dashboard') !== -1) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ stats: { openTickets: 4 } }); } });
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
    '--window-size=' + (largeur || 1400) + ',900',
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
    entreeBarre: vis(document.getElementById('wfa-app-bar')) && vis(document.querySelector('.wfa-mod-ouvrir')),
    barreRepliee: document.body.classList.contains('wfa-replie'),
    barreVisible: vis(document.getElementById('wfa-app-bar')),
    poigneeVisible: vis(document.getElementById('wfa-app-poignee')),
    margeBody: getComputedStyle(document.body).marginLeft,
    focusRecherche: document.activeElement === document.getElementById('mod-rech'),
    kill: !!document.querySelector('#wfa-mod [data-acte=kill]')
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
r.boutons === 12 ? ok('6 boutons par joueur (fiche + 5 actions)') : ko('boutons = ' + r.boutons);
r.kill ? ok('bouton Kill present') : ko('bouton Kill absent');
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

// 6bis. La premiere colonne porte l'IDUnique-perso, pas l'ID de session
// FiveM (volatile : il change a chaque reconnexion). L'ID de session doit
// rester en interne pour les actions, mais ne plus s'afficher.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ ${releve(`, premiereCol: (document.querySelector('#wfa-mod tbody tr td')||{}).textContent || '',
    idInterne: !!document.querySelector('#wfa-mod [data-acte=kick][data-id="12"]')`)} }, 400);`);
r.premiereCol === '1234-1' ? ok('1re colonne = IDUnique-perso') : ko('1re colonne : ' + r.premiereCol);
r.idInterne ? ok('ID de session conserve pour les actions') : ko('data-id perdu');

// 7. Recherche : un compte HORS LIGNE remonte des 2 caracteres.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ var i=document.getElementById('mod-rech'); i.value='sorensen';
    i.dispatchEvent(new Event('input'));
    setTimeout(function(){ ${releve(", horsLigne: document.querySelectorAll('#wfa-mod [data-fiche=horsligne]').length")} }, 500); }, 400);`);
r.horsLigne === 1 ? ok('recherche : compte hors ligne trouve') : ko('hors ligne -> ' + r.horsLigne);

// 8. Fiche d'un joueur en jeu : la vie BRUTE (187) doit s'afficher en 87.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ document.querySelector('[data-fiche=enligne]').click();
    setTimeout(function(){ ${releve(", fiche: (document.querySelector('#wfa-mod .mod-fiche')||{}).textContent || ''")} }, 600); }, 400);`);
/Raoul Oshimen/.test(r.fiche) ? ok('fiche en jeu : ouverte') : ko('fiche : ' + String(r.fiche).slice(0,80));
/87 \/ 100/.test(r.fiche) ? ok('vie brute 187 rendue en 87/100') : ko('vie mal convertie : ' + String(r.fiche).slice(0,120));
/AFK/.test(r.fiche) ? ok('casier affiche dans la fiche') : ko('sanctions absentes de la fiche');

// 9. Tuiles de contexte : reports en attente comptes, tickets ouverts.
r = rendre('normal', `document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){ ${releve()} }, 700);`);
/2\s*reports en attente/i.test(r.tuiles.replace(/\s+/g,' ')) ? ok('tuile reports (2 non clotures)') : ko('tuiles : ' + r.tuiles);
/4\s*tickets ouverts/i.test(r.tuiles.replace(/\s+/g,' ')) ? ok('tuile tickets') : ko('tuiles : ' + r.tuiles);

// 10. UNE SEULE barre de defilement. Le panneau couvre la page mais ne
// l'empechait pas de defiler : sa barre restait visible A DROITE de celle du
// panneau. On mesure la largeur reellement prise par la barre du document
// (innerWidth - clientWidth), panneau ouvert puis referme.
r = rendre('normal', `document.body.insertAdjacentHTML('afterbegin', '<div style="height:3000px"></div>');
  window.scrollTo(0, 400);
  document.querySelector('.wfa-mod-ouvrir').click();
  setTimeout(function(){
    var pendant = window.innerWidth - document.scrollingElement.clientWidth;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    ${releve(`, barrePendant: pendant,
      barreApres: window.innerWidth - document.scrollingElement.clientWidth,
      defilementApres: document.scrollingElement.scrollTop`)} }, 400);`);
r.barrePendant === 0 ? ok('panneau ouvert : une seule barre de defilement')
  : ko('barre de la page encore la (' + r.barrePendant + ' px) : deux barres');
r.barreApres > 0 ? ok('fermeture : la page redefile') : ko('la page reste figee apres fermeture');
r.defilementApres === 400 ? ok('position de defilement conservee') : ko('defilement -> ' + r.defilementApres);

// 11. Fenetre etroite : la barre se replie TOUTE SEULE et rend ses 210 px a la
// page. Sans cela, les pages du site (qui decident de leur disposition sur la
// largeur de la FENETRE) gardaient une mise en page trop large pour la place
// reelle — sur « Gestion FiveM » a 950 px, la colonne des bans depassait de
// 124 px hors de l'ecran, sans defilement pour la rejoindre.
r = rendre('normal', releve(), 950);
r.barreRepliee ? ok('fenetre etroite : barre repliee d office') : ko('barre encore deployee a 950 px');
r.margeBody === '0px' ? ok('la page recupere toute la largeur') : ko('marge du body : ' + r.margeBody);
r.poigneeVisible ? ok('poignee ≡ disponible pour la rouvrir') : ko('poignee absente : barre irrecuperable');

// 12. Fenetre large : rien ne bouge, la barre reste en place.
r = rendre('normal', releve(), 1400);
r.barreRepliee === false ? ok('fenetre large : barre deployee') : ko('barre repliee sans raison a 1400 px');
r.margeBody === '210px' ? ok('la page est decalee de la largeur de la barre') : ko('marge du body : ' + r.margeBody);

console.log(echecs ? '\n' + echecs + ' echec(s).' : '\nPanneau de moderation : tout passe.');
process.exit(echecs ? 1 : 0);
