// Barre laterale de l'application de bureau — INJECTEE dans chaque page du
// webview par Tauri (initialization_script), elle n'existe dans aucun fichier
// servi par worldfa.fr.
//
// Pourquoi une injection et non une seconde vue : une seule origine, donc le
// cookie de session et l'OAuth Discord se comportent exactement comme dans un
// navigateur. Le script tourne AUSSI sur les pages hors worldfa.fr (Discord
// pendant la connexion) : la garde ci-dessous l'y neutralise, et les
// capacites Tauri n'accordent de toute facon l'IPC qu'a worldfa.fr.
(function () {
  'use strict';

  var SUR_WORLDFA = /(^|\.)worldfa\.fr$/.test(location.hostname) || Boolean(window.__WFA_APP_TEST);
  if (window.__WFA_APP_POSEE) return;
  window.__WFA_APP_POSEE = true;

  // TOUS les outils du hub (28/08/2026, demande) — memes quatre categories et
  // meme ordre que worldfa.fr/admin, pour qu'on retrouve un outil au meme
  // endroit dans la barre et dans la page d'ouverture.
  //
  // Aucun filtrage par permission : l'application est DESTINEE aux fondateurs
  // (rien ne l'impose techniquement — l'installeur est en telechargement
  // libre), et la barre a toujours tout montre. Chaque page refait son propre
  // controle cote serveur : la barre n'ouvre aucun acces, au pire un lien
  // mene a un refus. Si elle est distribuee plus largement un jour, filtrer
  // sur /api/me devient utile.
  var GROUPES = [
    { titre: 'Serveur de jeu', liens: [
      { chemin: '/fivem',                       nom: 'Gestion FiveM' },
      { chemin: '/fivem/stats',                 nom: 'Stats de tir' },
      { chemin: '/admin/reports',               nom: 'Reports' },
      { chemin: '/fivem/anticheat',             nom: 'Anticheat' },
      { chemin: '/admin/panel-fivem',           nom: 'Panel FiveM' }
    ] },
    { titre: 'Joueurs & récompenses', liens: [
      { chemin: '/ticket',                      nom: 'Gestion ticket' },
      { chemin: '/admin/giveaway',              nom: 'Giveaway' },
      { chemin: '/admin/boost',                 nom: 'Boost' },
      { chemin: '/achat-boutique',              nom: 'Achat boutique' }
    ] },
    { titre: 'Équipe & candidatures', liens: [
      { chemin: '/admin/planning',              nom: 'Présence staff' },
      { chemin: '/ticket/stats-tickets',        nom: 'Stats tickets' },
      { chemin: '/forms/gestion',               nom: 'Candidatures' },
      { chemin: '/forms/admin',                 nom: 'Édition formulaires' },
      { chemin: '/forms/candidature-pole-ggo',  nom: 'Pôle GGO' }
    ] },
    { titre: 'Site & supervision', liens: [
      { chemin: '/admin/sessions',              nom: 'Permissions' },
      { chemin: '/admin/wiki',                  nom: 'Wiki' },
      { chemin: '/graph',                       nom: 'Supervision VPS' },
      { chemin: '/groupe-graph',                nom: 'Fréquentation' }
    ] }
  ];

  // Le chemin le PLUS LONG qui corresponde a la page courante, '' si aucun.
  // Indispensable depuis qu'il y a des chemins emboites : /fivem/stats
  // commence par /fivem, et une simple correspondance de prefixe allumait
  // DEUX liens — ou le mauvais.
  function cheminLePlusPrecis(chemins) {
    var gagnant = '';
    for (var i = 0; i < chemins.length; i += 1) {
      var c = chemins[i];
      var correspond = location.pathname === c || location.pathname.indexOf(c + '/') === 0;
      if (correspond && c.length > gagnant.length) gagnant = c;
    }
    return gagnant;
  }
  var LARGEUR = 210;
  var CLE_REPLI = 'wfa_app_sidebar_replie';

  // L'IPC peut etre absent (capacite mal reglee, page d'erreur) : la barre
  // doit rendre quand meme, seule la mise a jour se tait.
  function invoke(commande) {
    try {
      if (window.__TAURI__ && window.__TAURI__.core) return window.__TAURI__.core.invoke(commande);
    } catch (e) {}
    return Promise.reject(new Error('ipc indisponible'));
  }

  var HAUTEUR_TITRE = 34;

  // La fenetre n'a plus de barre systeme (couleur d'accentuation Windows,
  // bleue chez l'exploitant) : celle-ci la remplace sur TOUTES les pages —
  // sans elle, la page de connexion Discord serait indeplacable et sans
  // bouton fermer. data-tauri-drag-region rend la bande saisissable a la
  // souris et le double-clic agrandit, comme une vraie barre de titre.
  function poserBarreTitre() {
    var style = document.createElement('style');
    style.textContent = [
      '#wfa-titlebar { position: fixed; top: 0; left: 0; right: 0; height: ' + HAUTEUR_TITRE + 'px;',
      '  z-index: 2147483000; display: flex; align-items: stretch; box-sizing: border-box;',
      '  background: #0c0c0d; border-bottom: 1px solid rgba(255,255,255,0.08);',
      '  font-family: "Segoe UI", Arial, sans-serif; user-select: none; -webkit-user-select: none; }',
      '#wfa-titlebar .wfa-tb-titre { flex: 1; display: flex; align-items: center; padding: 0 14px;',
      '  font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;',
      '  color: rgba(255,255,255,0.45); }',
      '#wfa-titlebar .wfa-tb-titre span { color: rgba(220,100,100,0.95); }',
      '#wfa-titlebar button { width: 46px; border: 0; background: transparent; cursor: pointer;',
      '  color: rgba(255,255,255,0.5); font-size: 13px; font-family: "Segoe UI Symbol", "Segoe UI", sans-serif; }',
      '#wfa-titlebar button:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }',
      '#wfa-titlebar button.wfa-fermer:hover { background: rgba(200,60,60,0.85); color: #fff; }',
      'body { margin-top: ' + HAUTEUR_TITRE + 'px !important; }'
    ].join('\n');
    document.head.appendChild(style);

    var barre = document.createElement('div');
    barre.id = 'wfa-titlebar';

    var titre = document.createElement('div');
    titre.className = 'wfa-tb-titre';
    titre.setAttribute('data-tauri-drag-region', '');
    titre.innerHTML = 'Espace Admin — World<span>:FA</span>';
    barre.appendChild(titre);

    function fenetre() {
      try {
        if (window.__TAURI__ && window.__TAURI__.window) {
          return window.__TAURI__.window.getCurrentWindow();
        }
      } catch (e) {}
      return null;
    }
    function boutonFenetre(texte, classe, action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = texte;
      if (classe) b.className = classe;
      b.addEventListener('click', function () {
        var w = fenetre();
        if (!w) return;
        try { action(w); } catch (e) {}
      });
      return b;
    }
    barre.appendChild(boutonFenetre('\u2500', '', function (w) { w.minimize(); }));
    barre.appendChild(boutonFenetre('\u25A1', '', function (w) { w.toggleMaximize(); }));
    barre.appendChild(boutonFenetre('\u2715', 'wfa-fermer', function (w) { w.close(); }));
    document.body.appendChild(barre);
  }

  // MODE ADMIN PUR (26/08/2026, choix de l'exploitant) : dans l'application,
  // le site public n'existe pas. La racine — la page d'accueil avec l'avion —
  // renvoie vers l'espace admin AVANT tout affichage, et si une navigation
  // atterrit quand meme sur une page publique (wiki, carte), son bandeau
  // (topbar : logo, Rejoindre, Boutique...) est masque : on y est pour lire un
  // contenu, pas pour retrouver l'habillage grand public.
  var CHEMINS_ADMIN = /^\/(admin|fivem|ticket|forms|achat-boutique|graph|groupe-graph)/;
  if (SUR_WORLDFA && (location.pathname === '/' || location.pathname === '/index.html')) {
    location.replace('/admin');
    return;
  }


  // =========================================================================
  // TABLEAU DE BORD DE MODERATION (28/08/2026, demande)
  // =========================================================================
  // Un ecran propre a l'APPLICATION, pose par-dessus la page courante : etat
  // du serveur, joueurs connectes en direct, et les quatre gestes de
  // moderation (message, gel, kick, ban) sans changer de page. Ctrl+K l'ouvre
  // directement sur la recherche.
  //
  // Il parle aux API de Support-World, servies sous /fivem/ par Apache
  // (ProxyPass /fivem/ -> 127.0.0.1:3002/). Contrats releves DANS LE CODE de
  // Support-World, pas supposes — les cinq pieges qui ont dicte ce qui suit :
  //
  //   1. SEUL le cookie `sw_dashboard_session` authentifie ; le `?token=` des
  //      pages est ignore des que le SSO est actif. Et il n'y a AUCUNE
  //      promotion de session sur un chemin /api/ : appeler l'API sans avoir
  //      ouvert une page Support-World au moins une fois rend 401. D'ou
  //      `reveillerSession()` : on charge /fivem/ une fois, puis on rejoue.
  //   2. /api/fivem-players rend TOUJOURS 200, meme serveur de jeu eteint —
  //      c'est le champ `online` qui tranche, jamais le code HTTP.
  //   3. Le ban par cette route exige des MINUTES > 0 : le permanent n'existe
  //      pas ici (il passe par ban-identity, volontairement laisse au site).
  //   4. Le gel est une BASCULE sans parametre ni idempotence : rejouer
  //      l'appel degele. D'ou le verrou par joueur pendant l'envoi.
  //   5. La vie renvoyee par le jeu est BRUTE, de 100 a 200 (100 = mort).
  //
  // Le sondage est a 6 s : la liste est mise en cache 1,5 s cote serveur, et
  // chaque appel marque le staff « actif » sur le dashboard — inutile de
  // taper plus vite. Rien ne tourne quand le panneau est ferme.
  var MOD = {
    ouvert: false,
    minuteur: null,
    joueurs: [],
    enligne: false,
    filtre: '',
    erreur: '',
    enCours: {},
    sessionReveillee: false
  };
  var MOD_PERIODE = 6000;

  function modApi(chemin, corps) {
    var options = { credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (corps) {
      options.method = 'POST';
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(corps);
    }
    return fetch('/fivem' + chemin, options).then(function (r) {
      if (r.status === 401) {
        var err = new Error('session');
        err.session = true;
        throw err;
      }
      if (r.status === 403) {
        var err3 = new Error('droit');
        err3.droit = true;
        throw err3;
      }
      return r.json().catch(function () { return {}; });
    });
  }

  // Charge une PAGE de Support-World : c'est elle qui promeut la session
  // worldfa en cookie sw_dashboard_session. Les chemins /api/ ne le font pas.
  function reveillerSession() {
    if (MOD.sessionReveillee) return Promise.resolve(false);
    MOD.sessionReveillee = true;
    return fetch('/fivem/', { credentials: 'same-origin' }).then(function () { return true; })
      .catch(function () { return false; });
  }

  // Un appel qui echoue en 401 est rejoue UNE fois, apres reveil de session.
  function modApiSure(chemin, corps) {
    return modApi(chemin, corps).catch(function (e) {
      if (!e || !e.session) throw e;
      return reveillerSession().then(function (fait) {
        if (!fait) throw e;
        return modApi(chemin, corps);
      });
    });
  }

  function modEchapper(t) {
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function modStyle() {
    var s = document.createElement('style');
    s.textContent = [
      '#wfa-mod { position: fixed; top: ' + HAUTEUR_TITRE + 'px; left: 0; right: 0; bottom: 0;',
      '  z-index: 2147482000; background: #0b0b0c; display: none; flex-direction: column;',
      '  font-family: "Segoe UI", Arial, sans-serif; color: #e0e0e0; }',
      '#wfa-mod.ouvert { display: flex; }',
      '#wfa-mod .mod-tete { display: flex; align-items: center; gap: 14px; padding: 14px 20px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.08); flex: none; }',
      '#wfa-mod .mod-titre { font-size: 12px; font-weight: 700; letter-spacing: 3px;',
      '  text-transform: uppercase; color: rgba(255,255,255,0.85); }',
      '#wfa-mod .mod-titre span { color: rgba(220,100,100,0.95); }',
      '#wfa-mod .mod-tuiles { display: flex; gap: 10px; margin-left: 8px; }',
      '#wfa-mod .mod-tuile { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);',
      '  padding: 5px 11px; min-width: 78px; }',
      '#wfa-mod .mod-tuile b { display: block; font-size: 15px; color: rgba(255,255,255,0.9);',
      '  font-variant-numeric: tabular-nums; line-height: 1.1; }',
      '#wfa-mod .mod-tuile i { font-style: normal; font-size: 8.5px; letter-spacing: 1.3px;',
      '  text-transform: uppercase; color: rgba(255,255,255,0.28); }',
      '#wfa-mod .mod-tuile.hs b { color: rgba(220,100,100,0.95); }',
      '#wfa-mod .mod-tuile.ok b { color: #34d399; }',
      '#wfa-mod input.mod-rech { flex: 1; max-width: 340px; margin-left: auto; background: #08080a;',
      '  border: 1px solid rgba(255,255,255,0.12); color: #e0e0e0; font-family: inherit;',
      '  font-size: 12.5px; padding: 8px 11px; }',
      '#wfa-mod input.mod-rech:focus { outline: none; border-color: rgba(255,255,255,0.3); }',
      '#wfa-mod .mod-fermer { border: 1px solid rgba(255,255,255,0.12); background: transparent;',
      '  color: rgba(255,255,255,0.45); font-family: inherit; font-size: 11px; font-weight: 700;',
      '  letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 14px; cursor: pointer; }',
      '#wfa-mod .mod-fermer:hover { background: rgba(255,255,255,0.06); color: #fff; }',
      '#wfa-mod .mod-corps { flex: 1; overflow-y: auto; padding: 0 20px 20px; }',
      '#wfa-mod .mod-avis { margin: 14px 0; padding: 11px 14px; border: 1px solid rgba(220,100,100,0.35);',
      '  background: rgba(220,100,100,0.07); color: rgba(220,100,100,0.95); font-size: 12px; }',
      '#wfa-mod table { width: 100%; border-collapse: collapse; font-size: 12.5px; }',
      '#wfa-mod th { position: sticky; top: 0; background: #0b0b0c; text-align: left; padding: 10px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 8.5px; font-weight: 700;',
      '  letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,0.28); }',
      '#wfa-mod td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.045); vertical-align: middle; }',
      '#wfa-mod td.num { font-variant-numeric: tabular-nums; white-space: nowrap; color: rgba(255,255,255,0.55); }',
      '#wfa-mod .mod-nom { color: rgba(255,255,255,0.9); }',
      '#wfa-mod .mod-sous { display: block; font-size: 10.5px; color: rgba(255,255,255,0.3); }',
      '#wfa-mod .mod-eti { display: inline-block; padding: 1px 6px; border: 1px solid rgba(255,255,255,0.12);',
      '  font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;',
      '  color: rgba(255,255,255,0.45); margin-left: 6px; }',
      '#wfa-mod .mod-eti.staff { color: #34d399; border-color: rgba(52,211,153,0.35); }',
      '#wfa-mod .mod-eti.gele { color: #fbbf24; border-color: rgba(251,191,36,0.35); }',
      '#wfa-mod .mod-actes { display: flex; gap: 6px; justify-content: flex-end; }',
      '#wfa-mod .mod-acte { border: 1px solid rgba(255,255,255,0.12); background: transparent;',
      '  color: rgba(255,255,255,0.45); font-family: inherit; font-size: 10px; font-weight: 700;',
      '  letter-spacing: 1px; text-transform: uppercase; padding: 5px 9px; cursor: pointer; }',
      '#wfa-mod .mod-acte:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: #fff; }',
      '#wfa-mod .mod-acte:disabled { opacity: 0.35; cursor: wait; }',
      '#wfa-mod .mod-acte.danger { color: rgba(220,100,100,0.8); border-color: rgba(220,100,100,0.28); }',
      '#wfa-mod .mod-acte.danger:hover:not(:disabled) { background: rgba(200,60,60,0.14); color: rgba(220,100,100,1); }',
      '#wfa-mod .mod-vide { padding: 40px; text-align: center; color: rgba(255,255,255,0.25); font-size: 12.5px; }',
      '#wfa-mod .mod-pied { flex: none; padding: 8px 20px; border-top: 1px solid rgba(255,255,255,0.06);',
      '  font-size: 10.5px; color: rgba(255,255,255,0.25); }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function modConstruire() {
    modStyle();
    var v = document.createElement('div');
    v.id = 'wfa-mod';
    v.innerHTML =
      '<div class="mod-tete">' +
        '<div class="mod-titre">Mode<span>ration</span></div>' +
        '<div class="mod-tuiles" id="mod-tuiles"></div>' +
        '<input class="mod-rech" id="mod-rech" type="text" placeholder="Rechercher : pseudo, personnage, IDUnique, Discord…" autocomplete="off">' +
        '<button type="button" class="mod-fermer" id="mod-fermer">Fermer (Echap)</button>' +
      '</div>' +
      '<div class="mod-corps" id="mod-corps"></div>' +
      '<div class="mod-pied" id="mod-pied"></div>';
    document.body.appendChild(v);

    document.getElementById('mod-fermer').addEventListener('click', function () { modBasculer(false); });
    var rech = document.getElementById('mod-rech');
    rech.addEventListener('input', function () { MOD.filtre = rech.value.trim().toLowerCase(); modRendre(); });
    // Les touches du panneau ne doivent pas remonter a la page dessous.
    rech.addEventListener('keydown', function (e) { e.stopPropagation(); });
    return v;
  }

  function modVisible() {
    var f = MOD.filtre;
    if (!f) return MOD.joueurs;
    return MOD.joueurs.filter(function (j) {
      return [j.name, j.characterName, j.uid, j.discordName, j.discordId, String(j.id)]
        .some(function (c) { return c && String(c).toLowerCase().indexOf(f) !== -1; });
    });
  }

  var MOD_ETATS = {
    dead: 'mort', coma: 'coma', ghost: 'invisible', armour: 'kevlar', vehicle: 'vehicule'
  };

  function modRendre() {
    if (!MOD.ouvert) return;
    var tuiles = document.getElementById('mod-tuiles');
    var corps = document.getElementById('mod-corps');
    if (!tuiles || !corps) return;

    var staff = MOD.joueurs.filter(function (j) { return j.staff; }).length;
    // `online` est le SEUL juge : l'API rend 200 meme serveur eteint.
    tuiles.innerHTML =
      '<div class="mod-tuile ' + (MOD.enligne ? 'ok' : 'hs') + '"><b>' + (MOD.enligne ? 'En ligne' : 'Hors ligne') + '</b><i>serveur</i></div>' +
      '<div class="mod-tuile"><b>' + MOD.joueurs.length + '</b><i>joueurs</i></div>' +
      '<div class="mod-tuile"><b>' + staff + '</b><i>staff en jeu</i></div>';

    var liste = modVisible();
    var html = '';
    if (MOD.erreur) html += '<div class="mod-avis">' + modEchapper(MOD.erreur) + '</div>';

    if (!liste.length) {
      html += '<div class="mod-vide">' +
        (MOD.joueurs.length ? 'Aucun joueur ne correspond a cette recherche.'
          : (MOD.enligne ? 'Personne en jeu.' : 'Serveur de jeu injoignable.')) + '</div>';
    } else {
      html += '<table><thead><tr>' +
        '<th style="width:52px">ID</th><th>Joueur</th><th style="width:120px">IDUnique</th>' +
        '<th style="width:64px">Ping</th><th style="width:64px">FPS</th><th style="width:96px">Etat</th>' +
        '<th style="width:250px"></th></tr></thead><tbody>';
      for (var i = 0; i < liste.length; i += 1) {
        var j = liste[i];
        var occupe = MOD.enCours[j.id] ? ' disabled' : '';
        html += '<tr>' +
          '<td class="num">' + modEchapper(j.id) + '</td>' +
          '<td><span class="mod-nom">' + modEchapper(j.characterName || j.name) + '</span>' +
            (j.staff ? '<span class="mod-eti staff">staff</span>' : '') +
            '<span class="mod-sous">' + modEchapper(j.name) +
            (j.discordName ? ' · ' + modEchapper(j.discordName) : '') + '</span></td>' +
          '<td class="num">' + modEchapper(j.uid || '—') + '</td>' +
          '<td class="num">' + modEchapper(j.ping === null || j.ping === undefined ? '—' : j.ping) + '</td>' +
          // fps null = mesure absente, ce n'est pas zero.
          '<td class="num">' + (j.fps === null || j.fps === undefined ? '—' : modEchapper(j.fps)) + '</td>' +
          '<td>' + modEchapper(MOD_ETATS[j.status] || '—') + '</td>' +
          '<td><div class="mod-actes">' +
            '<button type="button" class="mod-acte" data-acte="message" data-id="' + modEchapper(j.id) + '"' + occupe + '>Message</button>' +
            '<button type="button" class="mod-acte" data-acte="freeze" data-id="' + modEchapper(j.id) + '"' + occupe + '>Gel</button>' +
            '<button type="button" class="mod-acte danger" data-acte="kick" data-id="' + modEchapper(j.id) + '"' + occupe + '>Kick</button>' +
            '<button type="button" class="mod-acte danger" data-acte="ban" data-id="' + modEchapper(j.id) + '"' + occupe + '>Ban</button>' +
          '</div></td></tr>';
      }
      html += '</tbody></table>';
    }
    corps.innerHTML = html;
  }

  function modCharger() {
    return modApiSure('/api/fivem-players').then(function (d) {
      MOD.enligne = Boolean(d && d.online);
      MOD.joueurs = (d && d.players) || [];
      MOD.erreur = '';
    }).catch(function (e) {
      MOD.joueurs = [];
      MOD.enligne = false;
      MOD.erreur = e && e.droit
        ? 'Acces refuse : il faut la permission « Gestion FiveM » (ou la cle) pour voir les joueurs.'
        : (e && e.session
          ? 'Session non reconnue. Ouvre « Gestion FiveM » une fois dans la barre, puis reviens.'
          : 'Liste des joueurs illisible (serveur injoignable).');
    }).then(function () {
      modRendre();
      var pied = document.getElementById('mod-pied');
      if (pied) pied.textContent = 'Rafraichi toutes les 6 s · le ban par cette fenetre est TEMPORAIRE (le permanent reste sur la page Gestion FiveM)';
    });
  }

  function modJoueur(id) {
    for (var i = 0; i < MOD.joueurs.length; i += 1) {
      if (String(MOD.joueurs[i].id) === String(id)) return MOD.joueurs[i];
    }
    return null;
  }

  // Les quatre gestes. Le VERROU par joueur n'est pas une precaution de
  // style : le gel est une bascule sans idempotence cote jeu, un double-clic
  // (ou un renvoi apres timeout) degelerait celui qu'on vient de geler.
  function modAgir(acte, id) {
    var j = modJoueur(id);
    if (!j || MOD.enCours[id]) return;

    var corps = { playerId: j.id, playerName: j.characterName || j.name };
    var confirmation = '';

    if (acte === 'message') {
      var texte = window.prompt('Message a envoyer en jeu a ' + (j.characterName || j.name) + ' :', '');
      if (texte === null) return;
      texte = String(texte).trim();
      // Le jeu refuse une chaine vide ('empty_message') : autant le dire ici.
      if (!texte) { window.alert('Message vide : rien envoye.'); return; }
      corps.message = texte;
      corps.playerDiscordId = j.discordId || undefined;
    } else if (acte === 'kick') {
      var motif = window.prompt('Motif du kick de ' + (j.characterName || j.name) + ' :', '');
      if (motif === null) return;
      corps.reason = String(motif).trim();
    } else if (acte === 'ban') {
      // Cette route n'accepte QUE des minutes > 0 — le permanent passe par
      // ban-identity, laisse a la page Gestion FiveM.
      var duree = window.prompt('Duree du ban en MINUTES (le permanent se fait sur la page Gestion FiveM) :', '60');
      if (duree === null) return;
      var minutes = parseInt(String(duree).trim(), 10);
      if (!minutes || minutes <= 0) { window.alert('Duree invalide : il faut un nombre de minutes superieur a zero.'); return; }
      var motifBan = window.prompt('Motif du ban :', '');
      if (motifBan === null) return;
      corps.minutes = minutes;
      corps.reason = String(motifBan).trim();
      confirmation = 'Bannir ' + (j.characterName || j.name) + ' pendant ' + minutes + ' minute(s) ?';
    } else if (acte === 'freeze') {
      confirmation = 'Basculer le gel de ' + (j.characterName || j.name) + ' ? (c\'est une bascule : geler / degeler)';
    }

    if (confirmation && !window.confirm(confirmation)) return;

    MOD.enCours[id] = true;
    modRendre();

    var chemins = { message: '/api/fivem/message', kick: '/api/fivem/kick', ban: '/api/fivem/ban', freeze: '/api/fivem/freeze' };
    modApiSure(chemins[acte], corps).then(function (r) {
      if (r && r.ok) {
        if (acte === 'freeze') {
          window.alert((j.characterName || j.name) + (r.frozen ? ' est GELE.' : ' est DEGELE.'));
        }
        return;
      }
      // Les erreurs du jeu arrivent en clair : on les montre telles quelles
      // plutot qu'un « echec » qui obligerait a ouvrir les journaux.
      window.alert('Action refusee : ' + ((r && r.error) || 'raison inconnue'));
    }).catch(function (e) {
      window.alert(e && e.droit ? 'Permission insuffisante pour cette action.'
        : (e && e.session ? 'Session non reconnue : ouvre « Gestion FiveM » une fois, puis reessaie.'
          : 'Serveur injoignable : action non effectuee.'));
    }).then(function () {
      delete MOD.enCours[id];
      modCharger();
    });
  }

  function modBasculer(ouvrir, surRecherche) {
    var v = document.getElementById('wfa-mod') || modConstruire();
    MOD.ouvert = Boolean(ouvrir);
    v.classList.toggle('ouvert', MOD.ouvert);

    if (MOD.ouvert) {
      modRendre();
      modCharger();
      // Rien ne tourne quand le panneau est ferme.
      if (!MOD.minuteur) MOD.minuteur = setInterval(modCharger, MOD_PERIODE);
      if (surRecherche) {
        var r = document.getElementById('mod-rech');
        if (r) { r.focus(); r.select(); }
      }
    } else if (MOD.minuteur) {
      clearInterval(MOD.minuteur);
      MOD.minuteur = null;
    }
  }

  function poserModeration() {
    var v = modConstruire();

    // Delegation : les lignes sont reconstruites a chaque rafraichissement,
    // un ecouteur par bouton fuirait a chaque passage.
    v.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.mod-acte') : null;
      if (b && !b.disabled) modAgir(b.getAttribute('data-acte'), b.getAttribute('data-id'));
    });

    // Ctrl+K ouvre sur la recherche, Echap ferme. Le raccourci est pose sur
    // la fenetre en capture : sinon un champ de la page dessous l'avalerait.
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        modBasculer(true, true);  // Ctrl+K OUVRE toujours et donne le focus a la recherche
        return;
      }
      if (e.key === 'Escape' && MOD.ouvert) {
        e.preventDefault();
        modBasculer(false);
      }
    }, true);
  }

  function poser() {
    if (!document.body) return;
    poserBarreTitre();
    if (!SUR_WORLDFA) return;

    if (!CHEMINS_ADMIN.test(location.pathname)) {
      var voile = document.createElement('style');
      voile.textContent = '.topbar { display: none !important; }';
      document.head.appendChild(voile);
    }

    // AJUSTEMENTS PAR CATEGORIE (26/08/2026). Deux choses que chaque page
    // traine du site et qui n'ont pas de sens dans l'application :
    //   - le bouton « Espace admin / Retour » en tete : la barre laterale EST
    //     la navigation, et ce bouton decalait tout le contenu vers le bas,
    //     a une hauteur differente selon la page ;
    //   - le rembourrage haut de 48 px, prevu pour une page nue dans un
    //     navigateur — sous notre barre de titre, il creusait une bande vide.
    // Chaque categorie demarre desormais a la meme hauteur.
    var AJUSTEMENTS = {
      '/fivem/anticheat':
        '.topbar { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      '/admin/sessions':
        '.retour { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      '/admin/panel-fivem':
        '.retour { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      '/admin/giveaway':
        '.retour { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      '/achat-boutique':
        '#retour { display: none !important; }' +
        'footer { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      '/admin/reports':
        '.retour { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      '/admin/boost':
        '.retour { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      // Ces deux-la nomment leur bouton retour « back » et non « retour » :
      // c'est ce qui les avait fait oublier a la premiere ecriture. Leur
      // rembourrage haut vaut 48 px (planning) et 40 px (wiki).
      '/admin/planning':
        '.back[href="/admin"] { display: none !important; }' +
        'body { padding-top: 22px !important; }',
      // ATTENTION au selecteur : admin-wiki porte DEUX liens .back — le
      // retour vers /admin (a masquer) et « Voir la page publique » vers
      // /wiki, qui doit rester. Un « .back » nu les effacait tous les deux.
      '/admin/wiki':
        '.back[href="/admin"] { display: none !important; }' +
        'body { padding-top: 22px !important; }'
    };
    // AUCUN ajustement pour /ticket, /fivem, /fivem/stats, /graph,
    // /groupe-graph ni /forms/* : ces pages ne viennent pas de worldfa (ou
    // pas de son gabarit admin) et plusieurs se calent en `height: 100vh` —
    // leur imposer un `padding-top` a l'aveugle decalerait leur mise en page
    // au lieu de la nettoyer.
    //
    // La cle retenue est la PLUS LONGUE qui corresponde. Aucune cle de cette
    // table n'est aujourd'hui prefixe d'une autre, donc l'ancienne boucle
    // (premiere cle venue, ordre de l'objet) rendait le meme resultat : c'est
    // une PRECAUTION, pas la correction d'un defaut observe. Elle evite qu'un
    // ajout futur du genre /admin/panel-fivem/console ne depende de l'ordre
    // d'ecriture — et elle partage sa regle avec le lien actif, qui, lui,
    // avait un vrai probleme.
    var cheminAjuste = cheminLePlusPrecis(Object.keys(AJUSTEMENTS));
    if (cheminAjuste) {
      var ajustement = document.createElement('style');
      ajustement.textContent = AJUSTEMENTS[cheminAjuste];
      document.head.appendChild(ajustement);
    }

    var style = document.createElement('style');
    style.textContent = [
      /* Meme langage que l espace admin : gris tres sombres, filets faibles,
         accent rouge, AUCUN arrondi. */
      '#wfa-app-bar { position: fixed; top: ' + HAUTEUR_TITRE + 'px; left: 0; bottom: 0; width: ' + LARGEUR + 'px;',
      '  z-index: 6; display: flex; flex-direction: column; box-sizing: border-box;',
      '  background: linear-gradient(180deg, #0c0c0d 0%, #131315 100%);',
      '  border-right: 1px solid rgba(255,255,255,0.08);',
      '  font-family: "Segoe UI", Arial, sans-serif; }',
      '#wfa-app-bar .wfa-titre { padding: 18px 16px 14px; cursor: pointer;',
      '  font-size: 15px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;',
      '  color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.08); }',
      '#wfa-app-bar .wfa-titre span { color: rgba(220,100,100,0.95); }',
      '#wfa-app-bar nav { flex: 1; padding: 6px 0 10px; overflow-y: auto; }',
      /* Intitule de groupe : meme micro-titre que les sections du hub. */
      '#wfa-app-bar nav .wfa-groupe { padding: 12px 16px 4px; font-size: 8.5px; font-weight: 700;',
      '  letter-spacing: 1.6px; text-transform: uppercase; color: rgba(255,255,255,0.22); }',
      /* Rembourrage resserre depuis le passage a 18 liens (28/08/2026) :
         a 11 px la liste ne tenait plus sans defilement sur une fenetre
         courante. */
      '#wfa-app-bar nav a { display: block; padding: 6px 16px; text-decoration: none;',
      '  font-size: 11px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase;',
      '  color: rgba(255,255,255,0.45); border-left: 2px solid transparent; }',
      '#wfa-app-bar nav a:hover { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.04); }',
      '#wfa-app-bar nav a.actif { color: rgba(220,100,100,0.95);',
      '  border-left-color: rgba(220,100,100,0.95); background: rgba(220,100,100,0.07); }',
      '#wfa-app-bar .wfa-pied { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08); }',
      '#wfa-app-maj { display: none; width: 100%; padding: 9px 10px; margin-bottom: 10px;',
      '  font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: 1px;',
      '  text-transform: uppercase; cursor: pointer; border-radius: 0;',
      '  color: #34d399; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.35); }',
      '#wfa-app-maj:hover:not(:disabled) { background: rgba(52,211,153,0.16); }',
      '#wfa-app-maj:disabled { opacity: 0.5; cursor: wait; }',
      '#wfa-app-bar .wfa-version { font-size: 10px; color: rgba(255,255,255,0.24); }',
      '#wfa-app-bar .wfa-replier { float: right; cursor: pointer; color: rgba(255,255,255,0.3);',
      '  font-size: 12px; padding: 2px 4px; }',
      '#wfa-app-bar .wfa-replier:hover { color: rgba(255,255,255,0.7); }',
      '#wfa-app-poignee { position: fixed; top: ' + (HAUTEUR_TITRE + 8) + 'px; left: 10px; z-index: 6; display: none;',
      '  width: 34px; height: 34px; line-height: 32px; text-align: center; cursor: pointer;',
      '  background: rgba(19,19,21,0.95); border: 1px solid rgba(255,255,255,0.14);',
      '  color: rgba(255,255,255,0.6); font-size: 16px; }',
      '#wfa-app-poignee:hover { color: rgba(255,255,255,0.95); }',
      'body { margin-left: ' + LARGEUR + 'px !important; }',
      'body.wfa-replie { margin-left: 0 !important; }',
      'body.wfa-replie #wfa-app-bar { display: none; }',
      '#wfa-app-bar nav a.wfa-mod-ouvrir { margin: 2px 10px 8px; padding: 9px 12px;',
      '  border: 1px solid rgba(220,100,100,0.3); background: rgba(200,60,60,0.10);',
      '  color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: space-between; }',
      '#wfa-app-bar nav a.wfa-mod-ouvrir:hover { background: rgba(200,60,60,0.2); color: #fff; }',
      '#wfa-app-bar nav a.wfa-mod-ouvrir span { font-size: 8.5px; letter-spacing: 0.5px;',
      '  color: rgba(255,255,255,0.3); }',
      'body.wfa-replie #wfa-app-poignee { display: block; }',
      /* Pastille de mise a jour sur la poignee : la barre repliee cache le
         bouton, et le repli est memorise. Sans ce point, rien ne signalait
         plus jamais qu'une version attend. */
      '#wfa-app-poignee.wfa-maj::after { content: ""; position: absolute; top: -1px; right: -1px;',
      '  width: 7px; height: 7px; border-radius: 50%; background: rgba(52,211,153,0.95); }'
    ].join('\n');
    document.head.appendChild(style);

    var barre = document.createElement('div');
    barre.id = 'wfa-app-bar';

    var titre = document.createElement('div');
    titre.className = 'wfa-titre';
    titre.innerHTML = 'World<span>:FA</span>';
    var replier = document.createElement('span');
    replier.className = 'wfa-replier';
    replier.textContent = '‹';
    replier.title = 'Replier la barre';
    replier.addEventListener('click', function (e) { e.stopPropagation(); basculer(true); });
    titre.appendChild(replier);
    titre.addEventListener('click', function () { location.href = '/admin'; });
    barre.appendChild(titre);

    var nav = document.createElement('nav');

    var accesMod = document.createElement('a');
    accesMod.className = 'wfa-mod-ouvrir';
    accesMod.href = '#';
    accesMod.innerHTML = 'Moderation <span>Ctrl+K</span>';
    accesMod.addEventListener('click', function (e) { e.preventDefault(); modBasculer(true, true); });
    nav.appendChild(accesMod);

    var tousLesChemins = [];
    for (var g = 0; g < GROUPES.length; g += 1) {
      for (var j = 0; j < GROUPES[g].liens.length; j += 1) tousLesChemins.push(GROUPES[g].liens[j].chemin);
    }
    var cheminActif = cheminLePlusPrecis(tousLesChemins);

    for (var g2 = 0; g2 < GROUPES.length; g2 += 1) {
      var entete = document.createElement('div');
      entete.className = 'wfa-groupe';
      entete.textContent = GROUPES[g2].titre;
      nav.appendChild(entete);
      for (var k = 0; k < GROUPES[g2].liens.length; k += 1) {
        var lien = document.createElement('a');
        lien.href = GROUPES[g2].liens[k].chemin;
        lien.textContent = GROUPES[g2].liens[k].nom;
        if (GROUPES[g2].liens[k].chemin === cheminActif) lien.className = 'actif';
        nav.appendChild(lien);
      }
    }
    barre.appendChild(nav);

    var pied = document.createElement('div');
    pied.className = 'wfa-pied';
    var boutonMaj = document.createElement('button');
    boutonMaj.id = 'wfa-app-maj';
    boutonMaj.type = 'button';
    pied.appendChild(boutonMaj);
    var version = document.createElement('div');
    version.className = 'wfa-version';
    version.textContent = 'version …';
    pied.appendChild(version);
    barre.appendChild(pied);

    document.body.appendChild(barre);

    poserModeration();

    var poignee = document.createElement('div');
    poignee.id = 'wfa-app-poignee';
    poignee.textContent = '≡';
    poignee.title = 'Rouvrir la barre';
    poignee.addEventListener('click', function () { basculer(false); });
    document.body.appendChild(poignee);

    function basculer(replie) {
      document.body.classList.toggle('wfa-replie', replie);
      try { localStorage.setItem(CLE_REPLI, replie ? '1' : ''); } catch (e) {}
      // Les pages qui calculent leur disposition en pixels (multicam, cartes)
      // doivent apprendre que la largeur utile vient de changer.
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }
    try { if (localStorage.getItem(CLE_REPLI) === '1') basculer(true); } catch (e) {}

    invoke('version_actuelle').then(function (v) {
      version.textContent = 'version ' + v;
    }).catch(function () { version.textContent = ''; });

    // Le bouton n'apparait QUE si le code de l'application a change : la
    // comparaison se fait entre la version embarquee et celle publiee sur
    // worldfa.fr/app/latest.json. Une modification des PAGES d'admin ne le
    // declenche jamais — elle est deja a l'ecran.
    function verifierMaj() {
      invoke('maj_disponible').then(function (nouvelle) {
        if (!nouvelle) return;
        boutonMaj.style.display = 'block';
        boutonMaj.disabled = false;
        boutonMaj.textContent = 'Mettre à jour → v' + nouvelle;
        // Visible meme barre repliee, seul signal dans ce cas.
        poignee.classList.add('wfa-maj');
        poignee.title = 'Rouvrir la barre — mise a jour disponible';
      }).catch(function () {});
    }
    boutonMaj.addEventListener('click', function () {
      boutonMaj.disabled = true;
      boutonMaj.textContent = 'Téléchargement…';
      invoke('maj_installer').then(function () {
        // L'installeur ferme et relance l'application lui-meme.
        boutonMaj.textContent = 'Redémarrage…';
      }).catch(function () {
        boutonMaj.disabled = false;
        boutonMaj.textContent = 'Échec — réessayer';
      });
    });
    verifierMaj();
    setInterval(verifierMaj, 10 * 60 * 1000);

    // Les liens target=_blank (« ouvrir le message » vers Discord, logs...)
    // n'ont pas de navigateur sous la main ici : meme origine -> on navigue
    // dans la fenetre ; externe -> navigateur par defaut de Windows.
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[target="_blank"]') : null;
      if (!a || !a.href) return;
      e.preventDefault();
      if (a.host === location.host) {
        location.href = a.href;
      } else if (window.__TAURI__ && window.__TAURI__.opener) {
        window.__TAURI__.opener.openUrl(a.href).catch(function () {});
      } else {
        location.href = a.href;
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poser);
  } else {
    poser();
  }
})();
