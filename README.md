# WorldFA-Admin — l'espace admin en application de bureau

Une coquille [Tauri](https://tauri.app) autour de worldfa.fr : la fenetre EST
le site, avec une barre laterale injectee qui donne les cinq categories
(Anticheat, Permission & Session, Panel FiveM, Giveaway, Achat boutique) et le
bouton de mise a jour du logiciel.

Reservee aux fondateurs : la connexion est l'OAuth Discord du site, la session
et les droits sont verifies par le serveur a chaque page — l'application
n'ajoute aucun chemin d'acces.

## Ce qu'il faut comprendre avant de toucher

- **Les pages d'admin ne vivent PAS ici.** Elles sont servies par worldfa.fr :
  les modifier ne demande AUCUNE nouvelle version de l'application, c'est
  visible immediatement dans la fenetre.
- **Le bouton « Mettre a jour » ne concerne que ce depot.** Il apparait quand
  la version publiee sur worldfa.fr/app/latest.json depasse celle installee —
  donc uniquement apres `./publier-version.sh`.
- La barre laterale est `src-tauri/injection.js`, injectee dans chaque page du
  webview. Elle se neutralise hors de worldfa.fr (OAuth Discord), et les
  capacites Tauri (`src-tauri/capabilities/`) ne lui accordent que trois
  commandes et l'ouverture de liens externes.

## Publier une version

    ./publier-version.sh 0.1.1

GitHub Actions compile sur Windows, signe l'installeur (clef
TAURI_SIGNING_PRIVATE_KEY), et le depose sur worldfa.fr avec sa signature et le
manifeste (`/app/publier`, secret APP_PUBLISH_SECRET — le meme que dans le
.env de worldfa). L'application verifie la signature avant d'installer : un
fichier altere sur le serveur est refuse.

Premiere installation sur un PC : https://worldfa.fr/app/WorldFA-Admin_<version>_x64-setup.exe
— Windows affichera « Windows a protege votre ordinateur » une fois
(installeur non signe par un certificat Microsoft) : « Informations
complementaires » puis « Executer quand meme ». Les mises a jour suivantes
passent par le bouton, sans avertissement.

## Les secrets

Deux, dans Settings > Secrets and variables > Actions du depot :

| Secret | Role | Ou est la valeur |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | signe les mises a jour | `~/.tauri/worldfa-admin.key` sur le VPS |
| `APP_PUBLISH_SECRET` | autorise le depot sur worldfa.fr/app | `.env` de worldfa, meme nom |

**Perdre la clef de signature = plus aucune mise a jour automatique possible**
(les applications installees refuseront tout ce qui n'est pas signe avec).
Elle n'existe que sur le VPS et dans le secret GitHub.

## Verifier sans Windows

    npm test                       # la barre laterale : syntaxe et invariants
    cd src-tauri && cargo check    # le Rust compile (chaine posee sur le VPS)
