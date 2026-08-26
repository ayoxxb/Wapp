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

use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

const PAGE_ACCUEIL: &str = "https://worldfa.fr/admin";

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            maj_disponible,
            maj_installer,
            version_actuelle
        ])
        .setup(|app| {
            let url: tauri::Url = PAGE_ACCUEIL.parse().expect("URL d accueil invalide");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Espace Admin — World:FA")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1000.0, 640.0)
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
