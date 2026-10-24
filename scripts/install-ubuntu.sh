#!/usr/bin/env bash
# Ubuntu app installation/update. Docker Engine is already installed on the target server.
set -Eeuo pipefail
umask 077

fail() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }
phase() { printf '\n%s\n' "$*"; }
main() {
  local repo_url='https://github.com/florians25/NetFusionIT-SYS-.git'
  local install_dir="${ERP_INSTALL_DIR:-}" project="${ERP_INSTALL_PROJECT:-netfusion-erp-8070}"
  local missing=() tool compose_version major minor old_commit='' auto_domain='' configured=0 explicit='' metadata
  local backup='' old_api='' volume source_version image_id database_exists=0
  local protocol caddy_file ca_args=() local_dir ca_file access_file access_temporary readiness_file i ready=0
  [[ $# -eq 0 ]] || fail 'Optionen werden als ERP_INSTALL_DIR, ERP_DOMAIN oder ERP_INSTALL_PROJECT und ERP_INSTALL_PROTOCOL=http|https gesetzt.'
  for tool in git curl flock; do command -v "$tool" >/dev/null 2>&1 || missing+=("$tool"); done
  if ((${#missing[@]})); then
    [[ $(id -u) -eq 0 ]] || fail "Fehlende Programme: ${missing[*]}. Installer mit sudo starten."
    command -v apt-get >/dev/null || fail 'Ubuntu mit apt-get wird vorausgesetzt.'
    phase 'Fehlende Ubuntu-Werkzeuge installieren.'
    apt-get update
    local packages=(git curl ca-certificates util-linux)
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${packages[@]}"
  fi
  command -v docker >/dev/null || fail 'Docker Engine muss auf dem Server installiert sein.'
  docker info >/dev/null 2>&1 || fail 'Docker-Dienst nicht erreichbar. Mit Docker-Berechtigung bzw. sudo starten.'
  if ! docker compose version --short >/dev/null 2>&1; then
    [[ $(id -u) -eq 0 ]] || fail 'Docker Compose v2 fehlt. Installer mit sudo starten.'
    apt-get update
    if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin
    elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2
    else fail 'Docker-Compose-v2-Paket fehlt in den eingerichteten Ubuntu-/Docker-Paketquellen.'; fi
  fi
  compose_version=$(docker compose version --short)
  [[ $compose_version =~ ^v?([0-9]+)\.([0-9]+) ]] || fail 'Docker-Compose-Version nicht erkennbar.'
  major=${BASH_REMATCH[1]}; minor=${BASH_REMATCH[2]}
  ((major>2 || (major==2 && minor>=20))) || fail 'Docker Compose ab Version2.20 erforderlich.'
  [[ $project =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Ungültiger ERP_INSTALL_PROJECT.'
  if [[ -z $install_dir ]]; then
    if [[ $(id -u) -eq 0 ]]; then install_dir=/opt/netfusion-erp; else install_dir="${HOME:?}/netfusion-erp"; fi
  fi
  install_dir=$(realpath -m -- "$install_dir")
  [[ $install_dir != / && $install_dir != /opt && $install_dir != /home ]] || fail 'Eigenes Installationsverzeichnis wählen.'
  mkdir -p -- "$(dirname -- "$install_dir")"
  exec 9>"${install_dir}.install.lock"
  flock -n 9 || fail 'Für dieses Verzeichnis läuft bereits eine Installation.'
  if [[ -e $install_dir ]]; then
    [[ -d $install_dir ]] || fail 'Installationspfad ist kein Verzeichnis.'
    if [[ -e $install_dir/.git ]]; then
      [[ $(git -C "$install_dir" rev-parse --show-toplevel) == "$install_dir" ]] || fail 'Eigenständigen Repository-Checkout verwenden.'
      local origin
      origin=$(git -C "$install_dir" config --get remote.origin.url)
      case "$origin" in
        https://github.com/florians25/NetFusionIT-SYS-|https://github.com/florians25/NetFusionIT-SYS-.git|git@github.com:florians25/NetFusionIT-SYS-.git) ;;
        *) fail 'Das vorhandene Repository ist nicht florians25/NetFusionIT-SYS-.' ;;
      esac
      [[ $(git -C "$install_dir" branch --show-current) == main ]] || fail 'Installer aktualisiert ausschließlich den Branch main.'
      [[ -z $(git -C "$install_dir" status --porcelain --untracked-files=normal) ]] || fail 'Lokale Git-Änderungen zuerst sichern/committen. Es wird nichts zurückgesetzt.'
      old_commit=$(git -C "$install_dir" rev-parse HEAD)
    elif [[ -n $(ls -A -- "$install_dir") ]]; then fail 'Vorhandenes Verzeichnis ist kein Checkout und wird nicht überschrieben.'; fi
  fi
  if [[ ! -e $install_dir/.git ]]; then
    phase 'Repository klonen.'
    git clone --branch main --single-branch "$repo_url" "$install_dir"
  fi
  phase 'Aktuellen Stand holen: git pull --ff-only origin main.'
  git -C "$install_dir" pull --ff-only origin main
  cd -- "$install_dir"
  local_dir="$install_dir/.local"; mkdir -p -- "$local_dir"; chmod 700 "$local_dir"
  local compose=(docker compose --project-directory "$install_dir" -f "$install_dir/compose.quickstart.yaml" -p "$project")
  # Bind-mounted helpers belong to this checkout; no Node/npm/Java needed on Ubuntu itself.
  [[ -f scripts/install-ubuntu-config.mjs ]] || fail 'Installationshelfer fehlt im aktualisierten Checkout.'
  for tool in ERP_DOMAIN ERP_BOOTSTRAP_TENANT ERP_BOOTSTRAP_COMPANY ERP_BOOTSTRAP_NAME ERP_BOOTSTRAP_EMAIL; do
    if [[ -v $tool ]]; then explicit+="${explicit:+,}$tool"; fi
  done
  if [[ -v ERP_DOMAIN ]] || { [[ -f .env ]] && grep -Eq '^[[:space:]]*(export[[:space:]]+)?ERP_DOMAIN[[:space:]]*=' .env; }; then configured=1; fi
  if command -v ip >/dev/null; then auto_domain=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<NF;i++)if($i=="src"){print $(i+1);exit}}') || true; fi
  if [[ -z $auto_domain ]]; then auto_domain=$(hostname -I 2>/dev/null | awk '{for(i=1;i<=NF;i++)if($i~/^[0-9]+\./&&$i!~/^127\./){print $i;exit}}') || true; fi
  auto_domain=${auto_domain:-localhost}
  if docker volume inspect "${project}_postgres-data" >/dev/null 2>&1; then database_exists=1; fi
  metadata=$(mktemp "$local_dir/installer-metadata.XXXXXXXX")
  # ERR traps remove only this non-secret temporary file. Existing data/volumes stay intact.
  trap 'printf "Installation angehalten. Vorhandene Daten bleiben erhalten; Diagnose: docker compose -f %q -p %q ps -a\n" "$install_dir/compose.quickstart.yaml" "$project" >&2; rm -f -- "$metadata"' ERR
  phase 'Vorhandene Installationseinstellungen übernehmen.'
  "${compose[@]}" run --rm --no-deps --quiet-pull \
    -e "ERP_INSTALL_PROTOCOL=${ERP_INSTALL_PROTOCOL:-}" -e "ERP_INSTALL_DATABASE_EXISTS=$database_exists" -e "ERP_INSTALL_EXPLICIT_KEYS=$explicit" -e "ERP_INSTALL_AUTO_DOMAIN=$auto_domain" -e "ERP_INSTALL_DOMAIN_CONFIGURED=$configured" \
    -v "$install_dir/scripts/install-ubuntu-config.mjs:/installer-config.mjs:ro" \
    initialize node /installer-config.mjs >"$metadata"
  local values=(); mapfile -d '' -t values <"$metadata"; rm -f -- "$metadata"
  [[ ${#values[@]} -eq 8 ]] || fail 'Unvollständige Installationsmetadaten.'
  export ERP_DOMAIN="${values[0]}" ERP_BOOTSTRAP_TENANT="${values[1]}" ERP_BOOTSTRAP_COMPANY="${values[2]}" ERP_BOOTSTRAP_NAME="${values[3]}" ERP_BOOTSTRAP_EMAIL="${values[4]}"
  protocol="${values[7]}"; export ERP_INSTALL_PROTOCOL="$protocol"
  if [[ $protocol == http ]]; then export ERP_GATEWAY_PORT=80; compose+=(-f "$install_dir/compose.quickstart.http.yaml"); else export ERP_GATEWAY_PORT=443; fi
  "${compose[@]}" config --quiet
  old_api=$("${compose[@]}" ps -a -q api)
  if [[ -n $old_api ]]; then image_id=$(docker inspect --format '{{.Image}}' "$old_api"); else image_id=''; fi
  phase 'Produktionsimage bauen; laufende Anwendung bleibt während des Builds erreichbar.'
  "${compose[@]}" build --pull install
  if [[ ${values[5]} == 1 ]]; then
    phase 'Anwendung für die Sicherung anhalten; Datenbank und Volumes sichern.'
    "${compose[@]}" stop caddy api
    "${compose[@]}" up -d --no-deps --wait --wait-timeout 120 db
    mkdir -p -- "$local_dir/backups"
    backup=$(mktemp -d "$local_dir/backups/$(date -u +%Y%m%dT%H%M%SZ).XXXXXXXX")
    "${compose[@]}" exec -T db pg_dump -U postgres -d erp --format=custom >"$backup/database.dump"
    "${compose[@]}" exec -T db pg_restore --list <"$backup/database.dump" >"$backup/database.catalog"
    "${compose[@]}" exec -T db pg_dumpall -U postgres --globals-only >"$backup/globals.sql"
    printf '%s\n' "${old_commit:-unknown-new-checkout}" >"$backup/checkout-before-update.txt"
    printf '%s\n' "$image_id" >"$backup/api-image-before-update.txt"
    source_version=${old_commit:-HEAD}; git archive "$source_version" | gzip -n >"$backup/source.tar.gz"
    if [[ -f .env ]]; then cp -- .env "$backup/environment.env"; chmod 600 "$backup/environment.env"; fi
    for volume in install-state app-secrets db-secret caddy-data caddy-config; do
      # Compose project is explicit and this file declares these five default named volumes.
      if docker volume inspect "${project}_${volume}" >/dev/null 2>&1; then
        docker run --rm --network none --read-only \
          --mount "type=volume,src=${project}_${volume},dst=/source,readonly" \
          --mount "type=bind,src=$backup,dst=/backup" node:24-bookworm-slim \
          sh -c 'umask 077; tar -C /source -czf "/backup/$1.tar.gz" . && chown "$2:$3" "/backup/$1.tar.gz"' sh "$volume" "$(id -u)" "$(id -g)"
      elif [[ $volume == install-state || $volume == app-secrets || $volume == db-secret ]]; then fail "Erforderliches Installationsvolume fehlt: $volume"; fi
    done
    (cd "$backup"; sha256sum ./* >SHA256SUMS; sha256sum --check --status SHA256SUMS)
    printf 'Sicherung vollständig: %s\n' "$backup"
  fi
  phase 'Container starten, Migrationen ausführen und bestehenden Mandanten erhalten.'
  "${compose[@]}" up -d --force-recreate
  ca_file="$local_dir/netfusion-root.crt"
  if [[ $protocol == https ]]; then
    for i in {1..15}; do
      if "${compose[@]}" cp caddy:/data/caddy/pki/authorities/local/root.crt "$ca_file" >/dev/null 2>&1; then break; fi
      sleep 1
    done
    [[ -s $ca_file ]] || fail 'Öffentliches Caddy-Stammzertifikat noch nicht verfügbar.'
    chmod 644 "$ca_file"; ca_args=(--cacert "$ca_file")
  fi
  phase "$protocol und Readiness auf Port8070 kontrollieren."
  readiness_file="$local_dir/readiness.json"
  for i in {1..30}; do
    if curl --noproxy '*' --silent --show-error --fail --connect-timeout 2 --max-time 5 \
      "${ca_args[@]}" --resolve "$ERP_DOMAIN:8070:127.0.0.1" "$protocol://$ERP_DOMAIN:8070/health/ready" >"$readiness_file" 2>/dev/null \
      && grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"' "$readiness_file"; then ready=1; break; fi
    sleep 2
  done
  [[ $ready == 1 ]] || fail 'Readiness nicht erreicht. Containerstatus und Installationsprotokoll prüfen.'
  access_file="$local_dir/initial-access.json"
  access_temporary=$(mktemp "$local_dir/access.XXXXXXXX")
  "${compose[@]}" run --rm --no-deps --quiet-pull install cat /run/netfusion-install/access.json >"$access_temporary"
  chmod 600 "$access_temporary"; mv -f -- "$access_temporary" "$access_file"
  phase "Bereit: $protocol://$ERP_DOMAIN:8070"
  printf 'Checkout: %s\nErstzugang (geschützt): %s\n' "$install_dir" "$access_file"
  if [[ $protocol == https ]]; then printf 'Öffentliches HTTPS-Stammzertifikat: %s\n' "$ca_file"; else printf 'HTTP-Testmodus aktiv: ausschließlich mit Testdaten im geschützten Testnetz verwenden.\n'; fi
  if [[ ${values[6]} == 0 && -t 1 ]]; then
    printf '\nEinmalige Erstzugangsdaten für dieses Terminal:\n'; cat -- "$access_file"
  else printf 'Bereits geänderte Passwörter bleiben erhalten; initial-access.json dokumentiert ausschließlich den Erstzugang.\n'; fi
  printf 'Für Installation und Updates denselben Ein-Befehl-Installer verwenden.\n'
  trap - ERR
}
main "$@"
