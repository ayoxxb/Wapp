// Espace admin World:FA en application de bureau.
//
// L'app est une COQUILLE : une seule fenetre, dont le contenu est worldfa.fr
// lui-meme. Consequence voulue, et c'est ce qui a decide de l'architecture :
// les pages d'administration se modifient plusieurs fois par jour cote
// serveur, et ces modifications apparaissent ici immediatement, sans
// republier l'application. Le bouton « Mettre a jour » ne concerne que ce
// binaire — il n'apparait que si le CODE de l'app a change (comparaison de
// versions contre worldfa.fr/app/latest.json).
//
// La connexion est celle du site : le webview garde le cookie de session
// worldfa_session comme un navigateur, l'OAuth Discord se fait dedans, et
// chaque page revalide les droits cote serveur. L'app n'ajoute AUCUN chemin
// d'acces : sans session valable, elle montre exactement ce que montrerait
// un navigateur — la porte de connexion.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

const PAGE_ACCUEIL: &str = "https://worldfa.fr/admin";
// Page LOCALE, embarquee dans le binaire : le seul ecran que l'application
// sache afficher sans le site.
const PAGE_HORS_LIGNE: &str = "hors-ligne.html";

// Le site repond-il ? On ouvre une connexion TCP sur le port 443 sans aller
// jusqu'au TLS : on ne cherche pas a valider le site, seulement a savoir s'il
// y a quelqu'un au bout. Pas de client HTTP dans les dependances pour ca —
// le binaire part en telechargement a chaque mise a jour.
//
// CE QUE CE TEST NE COUVRE PAS : une coupure APRES le demarrage. La fenetre
// est deja sur worldfa.fr, et c'est alors la page d'erreur du webview qui
// s'affiche. Le F5 de la barre de titre (0.1.8) est la pour ce cas.
fn site_joignable() -> bool {
    let adresses = match ("worldfa.fr", 443).to_socket_addrs() {
        Ok(a) => a,
        // DNS muet : pas de reseau du tout, ou resolution cassee.
        Err(_) => return false,
    };
    for adresse in adresses {
        if TcpStream::connect_timeout(&adresse, Duration::from_secs(4)).is_ok() {
            return true;
        }
    }
    false
}

// Appelee par le bouton « Reessayer » de l'ecran hors ligne. Renvoie `true`
// quand la fenetre est repartie sur le site — la page, elle, ne se recharge
// jamais elle-meme : elle se reafficherait a l'identique.
#[tauri::command]
fn rejoindre_le_site(app: tauri::AppHandle) -> bool {
    if !site_joignable() {
        return false;
    }
    if let Some(fenetre) = app.get_webview_window("main") {
        if let Ok(url) = PAGE_ACCUEIL.parse() {
            let _ = fenetre.navigate(url);
            return true;
        }
    }
    false
}

// La verification refait un aller-retour complet a chaque appel plutot que de
// garder un etat partage : le poll vient de la barre laterale toutes les dix
// minutes, et un etat garde entre deux appels serait une source de decalage
// (version annoncee != version telechargee) pour economiser une requete qui
// ne coute rien.
#[tauri::command]
async fn maj_disponible(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(maj)) => Ok(Some(maj.version.clone())),
        Ok(None) => Ok(None),
        // Une panne de reseau ne doit pas faire apparaitre d'erreur dans la
        // barre : on repond simplement « rien », le prochain poll retentera.
        Err(_) => Ok(None),
    }
}

#[tauri::command]
async fn maj_installer(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let maj = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "aucune mise a jour disponible".to_string())?;

    // download_and_install verifie la signature de l'installeur contre la clef
    // publique embarquee dans tauri.conf.json : un fichier altere sur le
    // serveur de mise a jour est refuse ici, avant toute execution.
    maj.download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    // L'installeur NSIS relance l'application lui-meme apres l'echange des
    // fichiers ; redemarrer ici en plus ouvrirait deux instances.
    Ok(())
}

#[tauri::command]
fn version_actuelle(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

fn main() {
    tauri::Builder::default()
        // EN PREMIER, comme l'exige le greffon : une seconde execution ne doit
        // pas ouvrir une seconde fenetre sur la meme session (deux vues du
        // meme espace admin, dont une qu'on croit fermee), elle doit ramener
        // celle qui existe deja.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _dossier| {
            if let Some(fenetre) = app.get_webview_window("main") {
                let _ = fenetre.unminimize();
                let _ = fenetre.set_focus();
            }
        }))
        // Taille et position retenues d'une session a l'autre. Sans lui, la
        // fenetre repartait a 1440x900 centree a chaque lancement, quel que
        // soit l'ecran ou on l'avait posee.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            maj_disponible,
            maj_installer,
            version_actuelle,
            rejoindre_le_site
        ])
        .setup(|app| {
            // Site injoignable au lancement : on ouvre sur l'ecran local
            // plutot que sur la page d'erreur du webview — celle-ci ne recoit
            // PAS le script d'injection, donc pas de barre de titre : sans
            // decoration systeme, la fenetre devenait indeplacable et
            // infermable autrement que par la barre des taches.
            let depart = if site_joignable() {
                let url: tauri::Url = PAGE_ACCUEIL.parse().expect("URL d accueil invalide");
                WebviewUrl::External(url)
            } else {
                WebviewUrl::App(PAGE_HORS_LIGNE.into())
            };
            WebviewWindowBuilder::new(app, "main", depart)
                .title("Espace Admin — World:FA")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1000.0, 640.0)
                // Pas de barre de titre Windows : elle prend la couleur
                // d'accentuation du systeme (bleu chez l'exploitant) et jure
                // avec l'ecran. La barre est dessinee par injection.js —
                // sombre, avec ses propres boutons reduire/agrandir/fermer.
                // La fenetre reste redimensionnable par ses bords.
                .decorations(false)
                // La barre laterale est INJECTEE dans chaque page du webview
                // plutot que rendue dans une seconde vue : une seule origine
                // (worldfa.fr), donc le cookie de session se comporte
                // exactement comme dans un navigateur — l'OAuth Discord
                // compris. Le script se neutralise tout seul hors de
                // worldfa.fr (garde sur location.hostname).
                .initialization_script(include_str!("../injection.js"))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l application");
}
