#!/bin/bash
# Publier une nouvelle version de l'application de bureau.
#
#   ./publier-version.sh 0.1.1
#
# Aligne la version dans les trois fichiers qui la portent, committe, pose le
# tag et pousse : GitHub Actions compile alors le .exe, le signe et le depose
# sur worldfa.fr/app — le bouton « Mettre a jour » apparait dans l'application
# de chacun dans les 10 minutes.
set -euo pipefail
V="${1:-}"
if ! [[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage : ./publier-version.sh 0.1.1" >&2
  exit 1
fi

node - "$V" <<'NODE'
const fs = require('fs');
const v = process.argv[2];
for (const f of ['package.json', 'src-tauri/tauri.conf.json']) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.version = v;
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
}
const cargo = 'src-tauri/Cargo.toml';
fs.writeFileSync(cargo, fs.readFileSync(cargo, 'utf8').replace(/^version = ".*"$/m, `version = "${v}"`));
console.log('version', v, 'posee dans package.json, tauri.conf.json, Cargo.toml');
NODE

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock 2>/dev/null || true
git commit -m "version $V"
git tag "v$V"
git push && git push --tags
echo
echo "Tag v$V pousse. Suivre la compilation : onglet Actions du depot GitHub."
echo "Installeur a l'arrivee : https://worldfa.fr/app/WorldFA-Admin_${V}_x64-setup.exe"
