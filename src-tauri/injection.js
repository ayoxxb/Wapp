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

  var CATEGORIES = [
    { chemin: '/fivem/anticheat',    nom: 'Anticheat' },
    { chemin: '/admin/sessions',     nom: 'Permission & Session' },
    { chemin: '/admin/panel-fivem',  nom: 'Panel FiveM' },
    { chemin: '/admin/giveaway',     nom: 'Giveaway' },
    { chemin: '/achat-boutique',     nom: 'Achat boutique' }
  ];
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

  function poser() {
    if (!document.body) return;
    poserBarreTitre();
    if (!SUR_WORLDFA) return;

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
      '#wfa-app-bar nav { flex: 1; padding: 10px 0; overflow-y: auto; }',
      '#wfa-app-bar nav a { display: block; padding: 11px 16px; text-decoration: none;',
      '  font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;',
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
      'body.wfa-replie #wfa-app-poignee { display: block; }'
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
    for (var i = 0; i < CATEGORIES.length; i += 1) {
      var lien = document.createElement('a');
      lien.href = CATEGORIES[i].chemin;
      lien.textContent = CATEGORIES[i].nom;
      if (location.pathname === CATEGORIES[i].chemin
          || location.pathname.indexOf(CATEGORIES[i].chemin + '/') === 0) {
        lien.className = 'actif';
      }
      nav.appendChild(lien);
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
