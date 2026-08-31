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

  // Chemin de la page courante. Il passe par une fonction pour que le banc
  // puisse rejouer N'IMPORTE QUELLE page : Chrome sans tete se FIGE sur une
  // URL http:// avec --virtual-time-budget (piege deja paye), les bancs
  // rendent donc en file://, ou `location.pathname` est celui du fichier
  // temporaire — sans ce crochet, ni le lien actif, ni le nom de la page, ni
  // les ajustements par page ne seraient verifiables autrement que par une
  // lecture du source, qui ne prouve rien. Le crochet n'existe que sous
  // __WFA_APP_TEST, deja pose au meme usage plus haut.
  function cheminCourant() {
    return (window.__WFA_APP_TEST && window.__WFA_APP_TEST_CHEMIN) || location.pathname;
  }

  // Le chemin le PLUS LONG qui corresponde a la page courante, '' si aucun.
  // Indispensable depuis qu'il y a des chemins emboites : /fivem/stats
  // commence par /fivem, et une simple correspondance de prefixe allumait
  // DEUX liens — ou le mauvais.
  function cheminLePlusPrecis(chemins) {
    var gagnant = '';
    for (var i = 0; i < chemins.length; i += 1) {
      var c = chemins[i];
      var chemin = cheminCourant();
      var correspond = chemin === c || chemin.indexOf(c + '/') === 0;
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

  // Nom de la page COURANTE, tel qu'il est ecrit dans la barre laterale :
  // sans barre de navigateur, rien ne disait ou l'on se trouve une fois la
  // barre repliee, et deux pages d'admin se ressemblent beaucoup.
  function nomDeLaPage() {
    if (!SUR_WORLDFA) {
      if (/(^|\.)discord\.com$/.test(location.hostname)) return 'Connexion Discord';
      // Page LOCALE de l'application (l'ecran hors ligne) : son titre dit
      // quelque chose, « tauri.localhost » non.
      var propre = String(document.title || '').trim();
      return propre || location.hostname;
    }
    var chemins = [];
    var noms = {};
    for (var g = 0; g < GROUPES.length; g += 1) {
      for (var k = 0; k < GROUPES[g].liens.length; k += 1) {
        chemins.push(GROUPES[g].liens[k].chemin);
        noms[GROUPES[g].liens[k].chemin] = GROUPES[g].liens[k].nom;
      }
    }
    var actif = cheminLePlusPrecis(chemins);
    if (actif) return noms[actif];
    if (cheminCourant() === '/admin' || cheminCourant().indexOf('/admin/') === 0) return 'Espace admin';
    // Une page hors du hub (wiki public, carte) : son propre titre vaut mieux
    // qu'un chemin brut, mais il peut etre long.
    var t = String(document.title || '').trim();
    return t ? t.slice(0, 48) : cheminCourant();
  }

  // ZOOM DE LA FENETRE (Ctrl + / Ctrl - / Ctrl 0), retenu d'une page a
  // l'autre. Les tableaux d'administration sont denses : pouvoir reculer d'un
  // cran change tout sur un portable. On passe par le zoom du WEBVIEW et non
  // par une regle CSS : lui seul redimensionne AUSSI la barre laterale et le
  // panneau, sans quoi l'habillage de l'app resterait a sa taille pendant que
  // la page retrecit.
  var CLE_ZOOM = 'wfa_app_zoom';
  var PALIERS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4];

  function zoomRetenu() {
    var z = 1;
    try { z = parseFloat(localStorage.getItem(CLE_ZOOM)) || 1; } catch (e) {}
    return PALIERS.indexOf(z) === -1 ? 1 : z;
  }

  function appliquerZoom(z) {
    try {
      if (window.__TAURI__ && window.__TAURI__.webview) {
        window.__TAURI__.webview.getCurrentWebview().setZoom(z).catch(function () {});
      }
    } catch (e) {}
  }

  // La fenetre n'a plus de barre systeme (couleur d'accentuation Windows,
  // bleue chez l'exploitant) : celle-ci la remplace sur TOUTES les pages —
  // sans elle, la page de connexion Discord serait indeplacable et sans
  // bouton fermer. data-tauri-drag-region rend la bande saisissable a la
  // souris et le double-clic agrandit, comme une vraie barre de titre.
  function poserBarreTitre() {
    // La barre de titre RECOUVRE le haut de la page : rien dans la fenetre ne
    // reserve ses 34 px. Les pages qui se calent en `height: 100vh` (Gestion
    // FiveM, ticket...) depassaient donc d'autant par le bas, hors de l'ecran
    // et sans defilement possible. On publie la hauteur ; c'est a la page de
    // s'en servir (`calc(100vh - var(--wfa-app-haut, 0px))`), ce qui laisse le
    // reglage cote SITE — modifiable sans republier le binaire — et ne change
    // rien dans un navigateur, ou la variable n'existe pas.
    document.documentElement.style.setProperty('--wfa-app-haut', HAUTEUR_TITRE + 'px');

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
      /* Nom de la page courante, a la suite de la marque : letter-spacing
         normal et casse d origine, sinon « Gestion FiveM » devient illisible
         au milieu des majuscules espacees. */
      '#wfa-titlebar .wfa-tb-page { margin-left: 10px; padding-left: 10px;',
      '  border-left: 1px solid rgba(255,255,255,0.12); font-weight: 600; font-size: 11px;',
      '  letter-spacing: 0; text-transform: none; color: rgba(255,255,255,0.62);',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40vw; }',
      '#wfa-titlebar .wfa-tb-zoom { margin-left: 8px; font-size: 10px; letter-spacing: 0;',
      '  text-transform: none; color: rgba(255,255,255,0.35); }',
      /* Precedent / Suivant / Recharger : sans barre de navigateur, ces trois
         gestes n existaient nulle part. Plus etroits que les boutons de
         fenetre, et separes d eux par la bande de deplacement. */
      '#wfa-titlebar .wfa-tb-nav { display: flex; align-items: stretch; }',
      '#wfa-titlebar .wfa-tb-nav button { width: 34px; font-size: 14px; }',
      '#wfa-titlebar .wfa-tb-nav button:disabled { color: rgba(255,255,255,0.16); cursor: default;',
      '  background: transparent; }',
      /* Fil de chargement : la seule chose qui dise « ca travaille » quand une
         page d admin met deux secondes a repondre. */
      '#wfa-charge { position: fixed; top: 0; left: 0; height: 2px; width: 0%;',
      '  z-index: 2147483001; background: rgba(220,100,100,0.95); opacity: 0;',
      '  transition: width 0.25s ease-out, opacity 0.25s ease-out; pointer-events: none; }',
      '#wfa-charge.actif { opacity: 1; }',
      '#wfa-titlebar button { width: 46px; border: 0; background: transparent; cursor: pointer;',
      '  color: rgba(255,255,255,0.5); font-size: 13px; font-family: "Segoe UI Symbol", "Segoe UI", sans-serif; }',
      '#wfa-titlebar button:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }',
      '#wfa-titlebar button.wfa-fermer:hover { background: rgba(200,60,60,0.85); color: #fff; }',
      'body { margin-top: ' + HAUTEUR_TITRE + 'px !important; }'
    ].join('\n');
    document.head.appendChild(style);

    var barre = document.createElement('div');
    barre.id = 'wfa-titlebar';

    var nav = document.createElement('div');
    nav.className = 'wfa-tb-nav';
    barre.appendChild(nav);

    var titre = document.createElement('div');
    titre.className = 'wfa-tb-titre';
    titre.setAttribute('data-tauri-drag-region', '');
    // Le nom de la page est dans un noeud a part : la bande de deplacement
    // doit rester saisissable sur toute sa longueur, texte compris.
    titre.innerHTML = 'World<span>:FA</span>'
      + '<span class="wfa-tb-page"></span><span class="wfa-tb-zoom"></span>';
    var etiquettePage = titre.querySelector('.wfa-tb-page');
    var etiquetteZoom = titre.querySelector('.wfa-tb-zoom');
    if (etiquettePage) etiquettePage.textContent = nomDeLaPage();
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

    // Navigation : de simples appels a l'historique du webview, aucune
    // permission Tauri en jeu — ils marchent donc aussi sur la page Discord.
    function boutonNav(texte, titreBouton, action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = texte;
      b.title = titreBouton;
      b.addEventListener('click', function () { try { action(); } catch (e) {} });
      nav.appendChild(b);
      return b;
    }
    var precedent = boutonNav('\u2190', 'Précédent (Alt+←)', function () { history.back(); });
    var suivant = boutonNav('\u2192', 'Suivant (Alt+→)', function () { history.forward(); });
    boutonNav('\u27F3', 'Recharger (F5)', function () { location.reload(); });
    // `history.length` vaut 1 sur la toute premiere page d'une fenetre : c'est
    // le seul cas ou l'on sait a coup sur qu'il n'y a nulle part ou revenir.
    // Au-dela, le webview ne dit pas s'il reste un pas en avant — les fleches
    // restent donc actives, quitte a ne rien faire.
    if (history.length <= 1) { precedent.disabled = true; suivant.disabled = true; }

    document.body.appendChild(barre);

    // Fil de chargement : visible tant que la page n'a pas fini, et rallume
    // des qu'une navigation part (le document courant reste a l'ecran pendant
    // que le serveur reflechit — c'est la que l'attente se voit le plus).
    var fil = document.createElement('div');
    fil.id = 'wfa-charge';
    document.body.appendChild(fil);

    function chargeDemarre() {
      fil.classList.add('actif');
      fil.style.width = '15%';
      // Deux paliers : le fil avance franchement, puis rampe. Il ne peut pas
      // dire la vraie progression d'une navigation, il dit « ca travaille ».
      setTimeout(function () { if (fil.classList.contains('actif')) fil.style.width = '70%'; }, 120);
      setTimeout(function () { if (fil.classList.contains('actif')) fil.style.width = '88%'; }, 1200);
    }
    function chargeFinie() {
      fil.style.width = '100%';
      fil.classList.remove('actif');
      setTimeout(function () { fil.style.width = '0%'; }, 300);
    }
    if (document.readyState !== 'complete') {
      chargeDemarre();
      window.addEventListener('load', chargeFinie);
    }
    window.addEventListener('beforeunload', chargeDemarre);

    // Zoom retenu : repose a CHAQUE page, le webview ne le garde pas d'une
    // navigation a l'autre.
    var zoom = zoomRetenu();
    if (zoom !== 1) {
      appliquerZoom(zoom);
      if (etiquetteZoom) etiquetteZoom.textContent = Math.round(zoom * 100) + ' %';
    }

    function changerZoom(sens) {
      var i = PALIERS.indexOf(zoomRetenu());
      if (i === -1) i = PALIERS.indexOf(1);
      var j = sens === 0 ? PALIERS.indexOf(1) : Math.min(PALIERS.length - 1, Math.max(0, i + sens));
      var z = PALIERS[j];
      try { localStorage.setItem(CLE_ZOOM, String(z)); } catch (e) {}
      appliquerZoom(z);
      if (etiquetteZoom) etiquetteZoom.textContent = z === 1 ? '' : Math.round(z * 100) + ' %';
    }

    // Les raccourcis d'un navigateur, que la coquille n'avait pas. En
    // CAPTURE : une page qui ecoute les touches (la recherche du panneau,
    // un tableau) ne doit pas les avaler.
    window.addEventListener('keydown', function (e) {
      if (e.altKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') history.back(); else history.forward();
        return;
      }
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        location.reload();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        // '=' est la meme touche que '+' sans majuscule sur un clavier AZERTY
        // comme QWERTY ; le pave numerique envoie 'Add'/'Subtract'.
        if (e.key === '+' || e.key === '=' || e.key === 'Add') { e.preventDefault(); changerZoom(1); }
        else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') { e.preventDefault(); changerZoom(-1); }
        else if (e.key === '0') { e.preventDefault(); changerZoom(0); }
      }
    }, true);
  }

  // MODE ADMIN PUR (26/08/2026, choix de l'exploitant) : dans l'application,
  // le site public n'existe pas. La racine — la page d'accueil avec l'avion —
  // renvoie vers l'espace admin AVANT tout affichage, et si une navigation
  // atterrit quand meme sur une page publique (wiki, carte), son bandeau
  // (topbar : logo, Rejoindre, Boutique...) est masque : on y est pour lire un
  // contenu, pas pour retrouver l'habillage grand public.
  var CHEMINS_ADMIN = /^\/(admin|fivem|ticket|forms|achat-boutique|graph|groupe-graph)/;
  if (SUR_WORLDFA && (cheminCourant() === '/' || cheminCourant() === '/index.html')) {
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
    sessionReveillee: false,
    horsLigne: [],
    horsLigneAt: 0,
    horsLigneEnVol: null,
    fiche: null,
    tuilesSite: null,
    // Liste des bans (avec leur id, seul moyen d'en lever un) : chargee a
    // l'ouverture d'une fiche, gardee 60 s. `leveTous` est le droit
    // « fivem:unban », que le serveur renvoie AVEC la liste.
    bans: null,
    bansAt: 0,
    bansEnVol: null,
    leveTous: false,
    // Derniers compteurs vus, pour signaler ce qui vient d'arriver.
    vus: null,
    nouveaux: { reports: 0, tickets: 0 }
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
        // Le refus du serveur porte souvent une phrase qui explique TOUT
        // (« ce ban a ete pose par X, tu ne peux lever que les tiens ») :
        // la jeter pour dire « permission insuffisante » ferait chercher
        // dans les journaux ce que la reponse disait deja.
        return r.json().catch(function () { return {}; }).then(function (d) {
          var err3 = new Error('droit');
          err3.droit = true;
          err3.texte = d && d.error ? String(d.error) : '';
          throw err3;
        });
      }
      return r.json().catch(function () { return {}; });
    });
  }

  // Les deux tuiles de contexte ne vivent pas sous /fivem : les reports sont
  // servis par worldfa lui-meme et les tickets par Support-World monte sur
  // /ticket. Chacune a SA permission — un 403 masque la tuile au lieu de
  // remplir l'ecran d'erreurs pour un staff qui n'a que « fivem ».
  function modApiBrut(chemin) {
    return fetch(chemin, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function modChargerContexte() {
    return Promise.all([
      // Un report est EN ATTENTE tant qu'il n'est pas cloture (clotureeLe).
      modApiBrut('/api/admin/reports?limit=200').then(function (d) {
        if (!d || !d.reports) return null;
        return d.reports.filter(function (r) { return !r.clotureeLe; }).length;
      }),
      modApiBrut('/ticket/api/dashboard').then(function (d) {
        return d && d.stats && typeof d.stats.openTickets === 'number' ? d.stats.openTickets : null;
      })
    ]).then(function (v) {
      MOD.tuilesSite = { reports: v[0], tickets: v[1] };
      modVeille();
      modRendre();
    });
  }

  // VEILLE : ce qui est ARRIVE depuis le dernier passage dans le panneau
  // (30/08/2026, demande). Le sondage tourne aussi panneau FERME — les deux
  // routes concernees ne touchent pas au dashboard FiveM (elles ne marquent
  // donc personne « actif ») et une pastille sans surveillance ne servirait
  // a rien.
  //
  // Le repere est garde en localStorage et non en memoire : dans cette
  // coquille chaque navigation recharge la page, donc le script repart de
  // zero a chaque clic dans la barre.
  var CLE_VUS = 'wfa_mod_vus';
  var MOD_VEILLE_PERIODE = 90000;

  function modLireVus() {
    try { return JSON.parse(localStorage.getItem(CLE_VUS) || 'null'); } catch (e) { return null; }
  }
  function modEcrireVus(v) {
    try { localStorage.setItem(CLE_VUS, JSON.stringify(v)); } catch (e) {}
  }

  function modEcart(courant, vu) {
    if (typeof courant !== 'number' || typeof vu !== 'number') return 0;
    return Math.max(0, courant - vu);
  }

  function modVeille() {
    var t = MOD.tuilesSite || {};
    var vus = MOD.vus || modLireVus();

    // Premier passage : on prend l'etat courant pour repere, sans rien
    // annoncer — sinon toute premiere ouverture crierait « 12 nouveaux ».
    if (!vus) {
      MOD.vus = { reports: t.reports, tickets: t.tickets };
      modEcrireVus(MOD.vus);
      return;
    }

    // Un compteur qui BAISSE (reports traites ailleurs) redescend le repere,
    // sinon il faudrait remonter au-dessus de l'ancien pic pour etre averti.
    if (typeof t.reports === 'number' && typeof vus.reports === 'number' && t.reports < vus.reports) vus.reports = t.reports;
    if (typeof t.tickets === 'number' && typeof vus.tickets === 'number' && t.tickets < vus.tickets) vus.tickets = t.tickets;

    // Panneau ouvert : les chiffres sont sous les yeux, rien a signaler.
    if (MOD.ouvert) { MOD.vus = vus; modMarquerVu(); return; }

    MOD.vus = vus;
    modEcrireVus(vus);
    MOD.nouveaux = { reports: modEcart(t.reports, vus.reports), tickets: modEcart(t.tickets, vus.tickets) };
    modAfficherVeille();
  }

  // Ouvrir le panneau vaut « j'ai vu » : le repere se cale sur l'etat courant.
  function modMarquerVu() {
    var t = MOD.tuilesSite || {};
    MOD.vus = { reports: t.reports, tickets: t.tickets };
    modEcrireVus(MOD.vus);
    MOD.nouveaux = { reports: 0, tickets: 0 };
    modAfficherVeille();
  }

  function modAfficherVeille() {
    var total = (MOD.nouveaux.reports || 0) + (MOD.nouveaux.tickets || 0);
    var lien = document.querySelector('#wfa-app-bar .wfa-mod-ouvrir .wfa-mod-compte');
    if (lien) {
      lien.textContent = total ? String(total) : '';
      lien.style.display = total ? 'inline-block' : 'none';
      lien.title = total
        ? (MOD.nouveaux.reports ? MOD.nouveaux.reports + ' report(s) ' : '')
          + (MOD.nouveaux.tickets ? MOD.nouveaux.tickets + ' ticket(s) ' : '') + 'depuis ton dernier passage'
        : '';
    }
    // Barre repliee : la pastille de la poignee est le seul signal qui reste.
    var poignee = document.getElementById('wfa-app-poignee');
    if (poignee) poignee.classList.toggle('wfa-veille', total > 0);
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
      // Le panneau couvre la page mais ne l'empeche pas de defiler : sa barre
      // restait visible A DROITE de celle du panneau (deux barres cote a cote).
      // On fige la page dessous le temps de l'ouverture ; Chrome garde la
      // position de defilement, elle revient telle quelle a la fermeture.
      'html.wfa-mod-ouvert, html.wfa-mod-ouvert body { overflow: hidden !important; }',
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
      /* Dans la fiche, les gestes de ban tiennent leur propre bande : alignes
         a GAUCHE (on les lit avant d agir, contrairement aux boutons de fin
         de ligne du tableau) et separes du casier qui suit. */
      '#wfa-mod .mod-actes-fiche { justify-content: flex-start; align-items: center;',
      '  margin: 12px 0 4px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07); }',
      '#wfa-mod .mod-etat-ban { flex: 1; font-size: 11px; color: rgba(220,120,120,0.9); }',
      '#wfa-mod .mod-acte { border: 1px solid rgba(255,255,255,0.12); background: transparent;',
      '  color: rgba(255,255,255,0.45); font-family: inherit; font-size: 10px; font-weight: 700;',
      '  letter-spacing: 1px; text-transform: uppercase; padding: 5px 9px; cursor: pointer; }',
      '#wfa-mod .mod-acte:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: #fff; }',
      '#wfa-mod .mod-acte:disabled { opacity: 0.35; cursor: wait; }',
      '#wfa-mod .mod-acte.danger { color: rgba(220,100,100,0.8); border-color: rgba(220,100,100,0.28); }',
      '#wfa-mod .mod-acte.danger:hover:not(:disabled) { background: rgba(200,60,60,0.14); color: rgba(220,100,100,1); }',
      '#wfa-mod .mod-vide { padding: 40px; text-align: center; color: rgba(255,255,255,0.25); font-size: 12.5px; }',
      '#wfa-mod .mod-titre-sec { margin: 22px 0 4px; padding-bottom: 5px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 8.5px; font-weight: 700;',
      '  letter-spacing: 1.6px; text-transform: uppercase; color: rgba(255,255,255,0.25); }',
      '#wfa-mod .mod-fiche { padding-top: 16px; }',
      '#wfa-mod .mod-fiche h3 { margin: 16px 0 12px; font-size: 16px; font-weight: 700;',
      '  color: rgba(255,255,255,0.9); }',
      '#wfa-mod .mod-infos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));',
      '  gap: 10px; margin-bottom: 16px; }',
      '#wfa-mod .mod-info { border: 1px solid rgba(255,255,255,0.07); padding: 9px 12px; }',
      '#wfa-mod .mod-info i { font-style: normal; display: block; font-size: 8.5px; letter-spacing: 1.3px;',
      '  text-transform: uppercase; color: rgba(255,255,255,0.26); margin-bottom: 3px; }',
      '#wfa-mod .mod-info b { font-weight: 600; color: rgba(255,255,255,0.85); font-size: 12.5px; }',
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
    rech.addEventListener('input', function () {
      MOD.filtre = rech.value.trim().toLowerCase();
      // Chercher sort forcement de la fiche : sinon on tape sans rien voir.
      MOD.fiche = null;
      modRendre();
      if (MOD.filtre.length >= 2) modChargerHorsLigne().then(modRendre);
    });
    // Les touches du panneau ne doivent pas remonter a la page dessous.
    rech.addEventListener('keydown', function (e) { e.stopPropagation(); });
    return v;
  }

  // La recherche porte sur les joueurs EN JEU **et** sur les comptes
  // hors-ligne (28/08/2026, 2e passe : elle ne filtrait que les connectes).
  // La liste hors-ligne est complete et sans filtre cote serveur : on ne la
  // charge donc qu'a la PREMIERE recherche de 2 caracteres, et on la garde
  // 5 minutes — la retelecharger a chaque frappe serait absurde.
  function modChargerHorsLigne() {
    if (MOD.horsLigneAt && (Date.now() - MOD.horsLigneAt) < 300000) return Promise.resolve();
    if (MOD.horsLigneEnVol) return MOD.horsLigneEnVol;
    MOD.horsLigneEnVol = modApiSure('/api/fivem-players-offline').then(function (d) {
      MOD.horsLigne = (d && d.players) || [];
      MOD.horsLigneAt = Date.now();
    }).catch(function () {
      // Un echec ne doit pas vider ce qu'on avait : la recherche continue sur
      // les connectes, et la prochaine frappe reessaiera.
      MOD.horsLigne = MOD.horsLigne || [];
    }).then(function () { MOD.horsLigneEnVol = null; });
    return MOD.horsLigneEnVol;
  }

  function modCorrespond(champs, f) {
    for (var i = 0; i < champs.length; i += 1) {
      if (champs[i] && String(champs[i]).toLowerCase().indexOf(f) !== -1) return true;
    }
    return false;
  }

  function modVisible() {
    var f = MOD.filtre;
    var enligne = !f ? MOD.joueurs : MOD.joueurs.filter(function (j) {
      return modCorrespond([j.name, j.characterName, j.uid, j.discordName, j.discordId, j.id], f);
    });
    // Les comptes hors-ligne n'apparaissent qu'a partir de 2 caracteres :
    // en dessous, la liste entiere defilerait pour rien.
    var horsligne = [];
    if (f && f.length >= 2) {
      var enJeu = {};
      for (var i = 0; i < MOD.joueurs.length; i += 1) {
        if (MOD.joueurs[i].uid) enJeu[MOD.joueurs[i].uid] = true;
      }
      horsligne = (MOD.horsLigne || []).filter(function (p) {
        // Un compte deja en jeu ne doit pas apparaitre deux fois.
        if (p.uid && enJeu[p.uid]) return false;
        return modCorrespond([p.character_name, p.steam_name, p.discordName, p.discord_id, p.unique_id, p.uid], f);
      }).slice(0, 40);
    }
    return { enligne: enligne, horsligne: horsligne };
  }

  // L'IDUnique SEUL : le champ `uid` d'un joueur vaut « IDUnique-IDPersonnage »,
  // alors que /api/fivem-sanctions n'accepte qu'un nombre (\d{1,10}). Passer
  // l'uid entier faisait rendre un casier VIDE, sans le moindre message.
  function modIdUnique(uid) {
    var s = String(uid || '').split('-')[0];
    return /^\d{1,10}$/.test(s) ? s : '';
  }

  // La liste des bans est le SEUL endroit ou trouver l'`id` d'un ban, exige
  // par /api/fivem/unban. Elle voyage avec deux drapeaux poses par le
  // serveur : `aMoi` (ce ban est-il le mien) et `leveTousLesBans` (la
  // permission fivem:unban). C'est le SERVEUR qui tranche l'appartenance —
  // lui seul connait les anciens pseudos du staff.
  var MOD_BANS_TTL = 60000;

  function modChargerBans(forcer) {
    var frais = MOD.bans && (Date.now() - MOD.bansAt) < MOD_BANS_TTL;
    if (frais && !forcer) return Promise.resolve(MOD.bans);
    if (MOD.bansEnVol) return MOD.bansEnVol;
    MOD.bansEnVol = modApiSure('/api/fivem/bans').then(function (d) {
      MOD.bans = (d && d.bans) || [];
      MOD.leveTous = Boolean(d && d.leveTousLesBans);
      MOD.bansAt = Date.now();
      return MOD.bans;
    }).catch(function () {
      // Liste illisible (droit « Gestion FiveM » absent, pont muet) : la
      // fiche s'affiche sans les boutons de ban plutot que pas du tout.
      return null;
    }).then(function (v) { MOD.bansEnVol = null; return v; });
    return MOD.bansEnVol;
  }

  // Un ban se rattache a un joueur par son IDUnique ou son ID Discord : les
  // deux sont presents dans wvc_bans, mais pas toujours renseignes.
  function modBanDe(idu, discordId) {
    var liste = MOD.bans || [];
    for (var i = 0; i < liste.length; i += 1) {
      var b = liste[i];
      if (idu && String(b.uid || '') === String(idu)) return b;
      if (discordId && /^\d{17,20}$/.test(String(discordId))
        && String(b.discord_id || '') === String(discordId)) return b;
    }
    return null;
  }

  function modOuvrirFiche(source, cle) {
    MOD.fiche = { chargement: true, source: source };
    modRendre();

    var chemin = source === 'enligne'
      ? '/api/fivem-player-info?playerId=' + encodeURIComponent(cle)
      : '/api/fivem-offline-player?charId=' + encodeURIComponent(cle);

    modApiSure(chemin).then(function (d) {
      MOD.fiche = { source: source, donnees: d, cle: cle };
      modRendre();
      // Le casier est demande a part : il vient d'une autre table et ne doit
      // pas retarder l'affichage de la fiche.
      var idu = source === 'enligne'
        ? modIdUnique(d && d.info && d.info.uid)
        : modIdUnique(d && d.account && d.account.unique_id);
      var discordId = source === 'enligne'
        ? (d && d.info && d.info.discordId)
        : (d && d.account && d.account.discord_id);
      MOD.fiche.idu = idu;
      MOD.fiche.discordId = discordId;

      // Etat de ban : demande a part lui aussi, et sans bloquer. Tant qu'il
      // n'est pas connu, la fiche n'affiche AUCUN bouton de ban — mieux vaut
      // rien proposer que proposer « Bannir » a quelqu'un deja banni.
      modChargerBans().then(function (liste) {
        if (!liste || !MOD.fiche || MOD.fiche.cle !== cle) return;
        MOD.fiche.ban = modBanDe(idu, discordId);
        MOD.fiche.bansLus = true;
        modRendre();
      });

      if (!idu) return;
      return modApiSure('/api/fivem-sanctions?uid=' + encodeURIComponent(idu)).then(function (s) {
        if (MOD.fiche && MOD.fiche.cle === cle) {
          MOD.fiche.sanctions = (s && s.sanctions) || [];
          modRendre();
        }
      }).catch(function () {});
    }).catch(function (e) {
      MOD.fiche = { source: source, erreur: e && e.droit ? 'Permission insuffisante.' : 'Fiche illisible.' };
      modRendre();
    });
  }

  function modLigneInfo(cle, valeur) {
    return '<div class="mod-info"><i>' + modEchapper(cle) + '</i><b>' + modEchapper(valeur) + '</b></div>';
  }

  function modRendreFiche() {
    var f = MOD.fiche;
    var html = '<div class="mod-fiche"><button type="button" class="mod-acte" id="mod-retour">&larr; Retour a la liste</button>';
    if (f.chargement) return html + '<div class="mod-vide">Lecture de la fiche…</div></div>';
    if (f.erreur) return html + '<div class="mod-avis">' + modEchapper(f.erreur) + '</div></div>';

    var d = f.donnees || {};
    if (f.source === 'enligne') {
      var i = d.info;
      if (!i) {
        // 200 avec info:null couvre TOUT : joueur parti, sans personnage,
        // pont muet. On ne peut pas distinguer — autant le dire.
        return html + '<div class="mod-avis">Aucune information : le joueur vient peut-etre de se deconnecter, ou le serveur de jeu ne repond pas.</div></div>';
      }
      html += '<h3>' + modEchapper(i.name) + '</h3><div class="mod-infos">';
      html += modLigneInfo('IDUnique', i.uid || '—');
      html += modLigneInfo('Faction', i.faction);
      html += modLigneInfo('Temps de jeu', i.playtime);
      html += modLigneInfo('Etoiles', i.stars);
      // La vie arrive BRUTE de 100 a 200 (100 = mort) : l'afficher telle
      // quelle annoncerait « 187 % de vie ».
      if (typeof i.health === 'number') html += modLigneInfo('Vie', Math.max(0, i.health - 100) + ' / 100');
      if (typeof i.armour === 'number') html += modLigneInfo('Armure', i.armour + ' / 100');
      html += modLigneInfo('Telephone', i.phone);
      html += modLigneInfo('Radio', i.radio);
      html += modLigneInfo('Gele', i.frozen ? 'oui' : 'non');
      // discordId peut valoir litteralement « Inconnu » cote jeu.
      html += modLigneInfo('Discord', /^\d{17,20}$/.test(String(i.discordId)) ? i.discordId : 'inconnu');
      html += '</div>';
      if (i.combat) {
        html += '<div class="mod-infos">' +
          modLigneInfo('Kills', i.combat.kills) + modLigneInfo('Morts', i.combat.deaths) +
          modLigneInfo('Precision', (i.combat.accuracy === null ? '—' : i.combat.accuracy + ' %')) +
          modLigneInfo('Arme favorite', i.combat.weapon || '—') + '</div>';
      }
    } else {
      var c = d.account || {};
      var perso = (d.characters || [])[0] || {};
      html += '<h3>' + modEchapper(((perso.firstname || '') + ' ' + (perso.lastname || '')).trim() || 'Compte hors ligne') + '</h3>';
      html += '<div class="mod-infos">';
      html += modLigneInfo('IDUnique', c.unique_id || '—');
      html += modLigneInfo('Etoiles', c.stars === undefined ? '—' : c.stars);
      html += modLigneInfo('Faction', perso.faction_name || 'Aucune');
      html += modLigneInfo('Vu la derniere fois', perso.last_played_label || '—');
      html += modLigneInfo('Discord', c.discord_id || 'inconnu');
      html += modLigneInfo('Personnages', (d.characters || []).length);
      html += '</div>';
      if (d.ban && d.ban.reason) {
        html += '<div class="mod-avis">Banni : ' + modEchapper(d.ban.reason) +
          ' — par ' + modEchapper(d.ban.banned_by || '?') +
          ' le ' + modEchapper(d.ban.banned_at_label || '?') +
          (d.ban.expires_at_label ? ', jusqu au ' + modEchapper(d.ban.expires_at_label) : '') + '</div>';
      }
    }

    html += modActesDeBan(f);

    if (f.sanctions === undefined) {
      html += '<div class="mod-vide">Lecture du casier…</div>';
    } else if (!f.sanctions.length) {
      html += '<div class="mod-vide">Aucune sanction enregistree.</div>';
    } else {
      html += '<table><thead><tr><th style="width:110px">Quand</th><th style="width:90px">Type</th>' +
        '<th>Motif</th><th style="width:150px">Par</th></tr></thead><tbody>';
      for (var k = 0; k < f.sanctions.length && k < 40; k += 1) {
        var s = f.sanctions[k];
        html += '<tr><td class="num">' + modEchapper(s.atLabel || s.at || '—') + '</td>' +
          '<td>' + modEchapper(s.kind) + '</td>' +
          '<td>' + modEchapper(s.reason || '—') + (s.minutes ? ' (' + s.minutes + ' min)' : '') + '</td>' +
          '<td>' + modEchapper(s.by || s.staff || '—') + '</td></tr>';
      }
      html += '</tbody></table>';
    }
    return html + '</div>';
  }

  // Ban DEFINITIF et LEVEE, depuis la fiche (30/08/2026, demande) — les deux
  // gestes qui manquaient au panneau.
  //
  // Le ban definitif ne passe PAS par /api/fivem/ban, qui exige des minutes
  // superieures a zero : c'est /api/fivem/ban-identity, la seule route qui
  // sache poser un `expires_at` NULL, et elle vise un COMPTE (IDUnique ou ID
  // Discord) — donc elle marche aussi sur un joueur hors ligne.
  //
  // La levee, elle, se heurte a la seule exception du site : la cle ne suffit
  // PAS, il faut la permission « fivem:unban » pour lever le ban d'un AUTRE
  // (decision du 22/08). Le bouton reste donc actif meme sans le droit — le
  // serveur refuse en expliquant pourquoi, et cette phrase vaut mieux qu'un
  // bouton grise sans explication.
  function modActesDeBan(f) {
    if (!f.bansLus) return '';
    if (!f.idu && !/^\d{17,20}$/.test(String(f.discordId || ''))) return '';

    var b = f.ban;
    if (b) {
      var qui = b.banned_by ? ' (pose par ' + modEchapper(b.banned_by) + ')' : '';
      var perpetuite = b.expires_at_label ? (' jusqu au ' + modEchapper(b.expires_at_label)) : ' definitivement';
      return '<div class="mod-actes mod-actes-fiche">' +
        '<span class="mod-etat-ban">Banni' + perpetuite + qui +
        (b.aMoi || MOD.leveTous ? '' : ' — ban d un autre staff') + '</span>' +
        '<button type="button" class="mod-acte" data-ban="lever" data-banid="' + modEchapper(b.id) + '">Lever le ban</button>' +
        '</div>';
    }
    return '<div class="mod-actes mod-actes-fiche">' +
      '<button type="button" class="mod-acte danger" data-ban="definitif">Ban définitif</button>' +
      '</div>';
  }

  // Le compte vise : l'IDUnique s'il est connu, sinon l'ID Discord — ce sont
  // les deux seules formes acceptees par ban-identity, et elles sont
  // numeriques toutes les deux (la route rejette le reste en 400).
  function modCibleDuBan(f) {
    if (f.idu) return { kind: 'unique', value: String(f.idu) };
    if (/^\d{17,20}$/.test(String(f.discordId || ''))) return { kind: 'discord', value: String(f.discordId) };
    return null;
  }

  function modAgirSurBan(quoi, banId) {
    var f = MOD.fiche;
    if (!f || MOD.banEnCours) return;
    var nom = (f.donnees && f.donnees.info && f.donnees.info.name) || 'ce compte';

    var envoi;
    if (quoi === 'definitif') {
      var cible = modCibleDuBan(f);
      if (!cible) { window.alert('Ni IDUnique ni ID Discord connus : impossible de bannir depuis cette fiche.'); return; }
      var motif = window.prompt('Motif du ban DEFINITIF de ' + nom + ' :', '');
      if (motif === null) return;
      motif = String(motif).trim();
      if (!motif) { window.alert('Motif vide : rien fait.'); return; }
      if (!window.confirm('Bannir ' + nom + ' DEFINITIVEMENT (sans date de fin) ?\n\nMotif : ' + motif)) return;
      // minutes absent = permanent (expires_at NULL cote jeu).
      envoi = modApiSure('/api/fivem/ban-identity', { kind: cible.kind, value: cible.value, reason: motif });
    } else {
      if (!window.confirm('Lever le ban de ' + nom + ' ?')) return;
      envoi = modApiSure('/api/fivem/unban', { banId: String(banId) });
    }

    MOD.banEnCours = true;
    modRendre();
    envoi.then(function (r) {
      if (!r || !r.ok) {
        window.alert('Refuse : ' + ((r && r.error) || 'raison inconnue'));
        return;
      }
      // La liste des bans vient de changer : on la relit AVANT de redessiner,
      // sinon la fiche montrerait encore l'etat d'avant.
      return modChargerBans(true).then(function () {
        if (MOD.fiche) MOD.fiche.ban = modBanDe(MOD.fiche.idu, MOD.fiche.discordId);
      });
    }).catch(function (e) {
      window.alert(e && e.droit
        ? (e.texte || 'Permission insuffisante pour cette action.')
        : (e && e.session ? 'Session non reconnue : ouvre « Gestion FiveM » une fois, puis reessaie.'
          : 'Serveur injoignable : action non effectuee.'));
    }).then(function () {
      MOD.banEnCours = false;
      modRendre();
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
      '<div class="mod-tuile"><b>' + staff + '</b><i>staff en jeu</i></div>' +
      // Masquees tant qu'on n'a pas de chiffre : null = permission absente ou
      // route muette, et une tuile a « — » ferait croire a zero.
      (MOD.tuilesSite && MOD.tuilesSite.reports !== null && MOD.tuilesSite.reports !== undefined
        ? '<div class="mod-tuile' + (MOD.tuilesSite.reports ? ' hs' : '') + '"><b>' + MOD.tuilesSite.reports + '</b><i>reports en attente</i></div>' : '') +
      (MOD.tuilesSite && MOD.tuilesSite.tickets !== null && MOD.tuilesSite.tickets !== undefined
        ? '<div class="mod-tuile"><b>' + MOD.tuilesSite.tickets + '</b><i>tickets ouverts</i></div>' : '');

    if (MOD.fiche) {
      corps.innerHTML = modRendreFiche();
      var retour = document.getElementById('mod-retour');
      if (retour) retour.addEventListener('click', function () { MOD.fiche = null; modRendre(); });
      return;
    }

    var vues = modVisible();
    var liste = vues.enligne;
    var html = '';
    if (MOD.erreur) html += '<div class="mod-avis">' + modEchapper(MOD.erreur) + '</div>';

    if (!liste.length && !vues.horsligne.length) {
      html += '<div class="mod-vide">' +
        (MOD.joueurs.length ? 'Aucun joueur ne correspond a cette recherche.'
          : (MOD.enligne ? 'Personne en jeu.' : 'Serveur de jeu injoignable.')) + '</div>';
    } else {
      html += '<table><thead><tr>' +
        '<th style="width:120px">IDUnique</th><th>Joueur</th>' +
        '<th style="width:64px">Ping</th><th style="width:64px">FPS</th><th style="width:96px">Etat</th>' +
        '<th style="width:360px"></th></tr></thead><tbody>';
      for (var i = 0; i < liste.length; i += 1) {
        var j = liste[i];
        var occupe = MOD.enCours[j.id] ? ' disabled' : '';
        html += '<tr>' +
          '<td class="num">' + modEchapper(j.uid || '—') + '</td>' +
          '<td><span class="mod-nom">' + modEchapper(j.characterName || j.name) + '</span>' +
            (j.staff ? '<span class="mod-eti staff">staff</span>' : '') +
            '<span class="mod-sous">' + modEchapper(j.name) +
            (j.discordName ? ' · ' + modEchapper(j.discordName) : '') + '</span></td>' +
          '<td class="num">' + modEchapper(j.ping === null || j.ping === undefined ? '—' : j.ping) + '</td>' +
          // fps null = mesure absente, ce n'est pas zero.
          '<td class="num">' + (j.fps === null || j.fps === undefined ? '—' : modEchapper(j.fps)) + '</td>' +
          '<td>' + modEchapper(MOD_ETATS[j.status] || '—') + '</td>' +
          '<td><div class="mod-actes">' +
            '<button type="button" class="mod-acte" data-fiche="enligne" data-cle="' + modEchapper(j.id) + '">Fiche</button>' +
            '<button type="button" class="mod-acte" data-acte="message" data-id="' + modEchapper(j.id) + '"' + occupe + '>Message</button>' +
            '<button type="button" class="mod-acte" data-acte="freeze" data-id="' + modEchapper(j.id) + '"' + occupe + '>Gel</button>' +
            '<button type="button" class="mod-acte danger" data-acte="kill" data-id="' + modEchapper(j.id) + '"' + occupe + '>Kill</button>' +
            '<button type="button" class="mod-acte danger" data-acte="kick" data-id="' + modEchapper(j.id) + '"' + occupe + '>Kick</button>' +
            '<button type="button" class="mod-acte danger" data-acte="ban" data-id="' + modEchapper(j.id) + '"' + occupe + '>Ban</button>' +
          '</div></td></tr>';
      }
      html += '</tbody></table>';
    }

    if (vues.horsligne.length) {
      html += '<div class="mod-titre-sec">Comptes hors ligne</div>';
      html += '<table><thead><tr><th>Personnage</th><th style="width:120px">IDUnique</th>' +
        '<th style="width:170px">Vu la derniere fois</th><th style="width:110px"></th></tr></thead><tbody>';
      for (var h = 0; h < vues.horsligne.length; h += 1) {
        var o = vues.horsligne[h];
        html += '<tr>' +
          '<td><span class="mod-nom">' + modEchapper(o.character_name || '—') + '</span>' +
          '<span class="mod-sous">' + modEchapper(o.steam_name || o.discordName || '') + '</span></td>' +
          '<td class="num">' + modEchapper(o.uid || o.unique_id || '—') + '</td>' +
          '<td class="num">' + modEchapper(o.last_seen_label || '—') + '</td>' +
          '<td><div class="mod-actes"><button type="button" class="mod-acte" data-fiche="horsligne" ' +
          'data-cle="' + modEchapper(o.character_id) + '">Fiche</button></div></td></tr>';
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
      if (pied) pied.textContent = 'Rafraichi toutes les 6 s · le bouton Ban de la liste est TEMPORAIRE (en minutes) ; le ban definitif et la levee sont dans la fiche';
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
    } else if (acte === 'kill') {
      confirmation = 'Tuer ' + (j.characterName || j.name) + ' en jeu ? Le personnage passe par la mort normale du serveur (coma).';
    } else if (acte === 'freeze') {
      confirmation = 'Basculer le gel de ' + (j.characterName || j.name) + ' ? (c\'est une bascule : geler / degeler)';
    }

    if (confirmation && !window.confirm(confirmation)) return;

    MOD.enCours[id] = true;
    modRendre();

    var chemins = { message: '/api/fivem/message', kick: '/api/fivem/kick', ban: '/api/fivem/ban',
      freeze: '/api/fivem/freeze', kill: '/api/fivem/kill' };
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
    document.documentElement.classList.toggle('wfa-mod-ouvert', MOD.ouvert);

    if (MOD.ouvert) {
      modRendre();
      modCharger();
      // Rien ne tourne quand le panneau est ferme.
      if (!MOD.minuteur) MOD.minuteur = setInterval(modCharger, MOD_PERIODE);
      modChargerContexte().then(modMarquerVu);
      if (!MOD.minuteurContexte) MOD.minuteurContexte = setInterval(modChargerContexte, 30000);
      if (surRecherche) {
        var r = document.getElementById('mod-rech');
        if (r) { r.focus(); r.select(); }
      }
    } else {
      if (MOD.minuteur) { clearInterval(MOD.minuteur); MOD.minuteur = null; }
      if (MOD.minuteurContexte) { clearInterval(MOD.minuteurContexte); MOD.minuteurContexte = null; }
    }
  }

  function poserModeration() {
    var v = modConstruire();

    // Delegation : les lignes sont reconstruites a chaque rafraichissement,
    // un ecouteur par bouton fuirait a chaque passage.
    v.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.mod-acte') : null;
      if (!b || b.disabled) return;
      if (b.getAttribute('data-fiche')) {
        modOuvrirFiche(b.getAttribute('data-fiche'), b.getAttribute('data-cle'));
        return;
      }
      if (b.getAttribute('data-ban')) {
        modAgirSurBan(b.getAttribute('data-ban'), b.getAttribute('data-banid'));
        return;
      }
      if (b.getAttribute('data-acte')) modAgir(b.getAttribute('data-acte'), b.getAttribute('data-id'));
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

    if (!CHEMINS_ADMIN.test(cheminCourant())) {
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
      '  width: 7px; height: 7px; border-radius: 50%; background: rgba(52,211,153,0.95); }',
      /* Veille : ce qui est arrive pendant qu on regardait ailleurs. Rouge,
         a distinguer du vert de la mise a jour — deux signaux au meme endroit
         quand la barre est repliee. */
      '#wfa-app-bar nav a.wfa-mod-ouvrir .wfa-mod-compte { display: none; min-width: 16px; padding: 1px 5px;',
      '  margin-left: auto; margin-right: 8px; text-align: center; font-size: 9px; font-weight: 700;',
      '  color: #fff; background: rgba(200,60,60,0.95); }',
      '#wfa-app-poignee.wfa-veille::before { content: ""; position: absolute; bottom: -1px; right: -1px;',
      '  width: 7px; height: 7px; border-radius: 50%; background: rgba(220,80,80,0.95); }'
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
    accesMod.innerHTML = 'Moderation <span class="wfa-mod-compte"></span><span>Ctrl+K</span>';
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

    // `sansMemoire` : un repli AUTOMATIQUE (fenetre etroite) ne doit pas
    // ecraser le choix de l'utilisateur, sinon la barre ne reviendrait jamais
    // apres un simple redimensionnement.
    function basculer(replie, sansMemoire) {
      document.body.classList.toggle('wfa-replie', replie);
      if (!sansMemoire) { try { localStorage.setItem(CLE_REPLI, replie ? '1' : ''); } catch (e) {} }
      // Les pages qui calculent leur disposition en pixels (multicam, cartes)
      // doivent apprendre que la largeur utile vient de changer.
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }

    function repliChoisi() {
      try { return localStorage.getItem(CLE_REPLI) === '1'; } catch (e) { return false; }
    }

    // FENETRE ETROITE : LA BARRE SE REPLIE TOUTE SEULE.
    // Les pages du site choisissent leur disposition sur la largeur de la
    // FENETRE (@media), qui ne dit rien de la place qu'il leur reste : la
    // barre leur en prend 210. Mesure sur « Gestion FiveM » a 950 px de
    // fenetre — sous 1101 px la page revient a trois colonnes de largeur
    // MINIMALE (800 px au total) alors qu'il ne restait que 725 px de large :
    // la troisieme colonne (« Joueurs bannis ») depassait de 124 px au-dela
    // du bord droit, et `html { overflow-x: hidden }` interdisait meme d'y
    // defiler — elle etait simplement coupee.
    // Rendre sa largeur a la page suffit : sans la barre, ses propres points
    // de rupture retombent juste. La poignee ≡ reste la pour la rouvrir a la
    // main, et ce choix-la tient jusqu'au prochain franchissement du seuil.
    var SEUIL_REPLI = 1100;
    var repliAuto = false;

    function ajusterALaFenetre() {
      var etroit = window.innerWidth <= SEUIL_REPLI;
      if (etroit && !repliAuto && !document.body.classList.contains('wfa-replie')) {
        repliAuto = true;
        basculer(true, true);
      } else if (!etroit && repliAuto) {
        repliAuto = false;
        basculer(repliChoisi(), true);
      }
    }

    if (repliChoisi()) basculer(true, true);
    ajusterALaFenetre();
    window.addEventListener('resize', ajusterALaFenetre);

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

    // VEILLE panneau FERME : deux requetes toutes les 90 s, pour que la barre
    // sache dire « il est arrive quelque chose ». Le premier releve est
    // differe de 1,5 s — le temps que la page finisse de charger ses propres
    // ressources, sans faire attendre la pastille une navigation entiere.
    setTimeout(function () { modChargerContexte(); }, 1500);
    setInterval(function () {
      if (!MOD.ouvert) modChargerContexte();
    }, MOD_VEILLE_PERIODE);

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
