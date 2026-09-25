#!/usr/bin/env bash
# Strip Windows CRLF line endings if present, then re-exec with clean file.
if grep -qU $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r//' "$0"
  exec bash "$0" "$@"
fi
# setup.sh -- IVIA DPC stack setup
#
# Run this script once before `docker compose up`.  It:
#
#   1. (Optional) Downloads and prepares the MaxMind GeoLite2 database.
#   2. Generates all self-signed TLS certificates.
#   3. Generates iag-config.yaml with live Verify SaaS credentials.
#      The IAG front-end TLS cert is base64-encoded (B64:) directly into
#      iag-config.yaml -- no server.pem volume mount is needed.
#      The JWT-signing cert is kept as a CONTAINER: file reference.
#   4. Tears down any existing stack and volumes for a clean start.
#   5. Starts postgres + dpc, waits for them to be healthy/ready.
#   6. Starts iag.
#
# Usage:
#   bash setup.sh
#
# Verify SaaS credentials -- set in the environment or in a .env file:
#   export VERIFY_TENANT_URL=https://mytenant.ice.ibmcloud.com
#   export VERIFY_CLIENT_ID=...
#   export VERIFY_CLIENT_SECRET=...
#
# MaxMind GeoLite2 (optional -- skip if you don't need geo-based rules):
#   export MAXMIND_LICENSE_KEY=xxxxxxxxxxxx
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CERT_DIR="$SCRIPT_DIR/certs/postgres"
DPCM_CERT_DIR="$SCRIPT_DIR/certs/dpcm"
IAG_CERT_DIR="$SCRIPT_DIR/certs/iag"
CONFIG_DIR="$SCRIPT_DIR/config"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

GEODB_BIN_DIR="$SCRIPT_DIR/bin"
GEODB_DEMO_DIR="$SCRIPT_DIR/geolite2"

# -- Load .env if present -----------------------------------------------------
if [ -f "$SCRIPT_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# Validate Verify SaaS credentials
if [ -z "${VERIFY_TENANT_URL:-}" ] || [ -z "${VERIFY_CLIENT_ID:-}" ] || [ -z "${VERIFY_CLIENT_SECRET:-}" ]; then
  echo ""
  echo "WARNING: VERIFY_TENANT_URL, VERIFY_CLIENT_ID and/or VERIFY_CLIENT_SECRET are not set."
  echo "         iag-config.yaml will be written with placeholder values."
  echo "         Create a .env file and set these variables before running."
  echo ""
  VERIFY_TENANT_URL="${VERIFY_TENANT_URL:-https://REPLACE_ME.ice.ibmcloud.com}"
  VERIFY_CLIENT_ID="${VERIFY_CLIENT_ID:-REPLACE_ME_CLIENT_ID}"
  VERIFY_CLIENT_SECRET="${VERIFY_CLIENT_SECRET:-REPLACE_ME_CLIENT_SECRET}"
fi

# -- Resolve dataprep-go binary -----------------------------------------------
_OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
_ARCH="$(uname -m)"
[ "$_ARCH" = "x86_64" ]  && _ARCH="amd64"
[ "$_ARCH" = "aarch64" ] && _ARCH="arm64"
_EXT=""
case "$_OS" in
  mingw*|cygwin*|msys*) _OS="windows"; _EXT=".exe" ;;
esac
# beta/bin layout: amd64/, arm64/, darwin-amd64/ -- no OS prefix for linux
case "$_OS" in
  linux)   DATAPREP_BIN="$GEODB_BIN_DIR/${_ARCH}/dataprep-go${_EXT}" ;;
  darwin)  DATAPREP_BIN="$GEODB_BIN_DIR/${_OS}-${_ARCH}/dataprep-go${_EXT}" ;;
  windows) DATAPREP_BIN="$GEODB_BIN_DIR/${_ARCH}/dataprep-go${_EXT}" ;;
  *)       DATAPREP_BIN="$GEODB_BIN_DIR/dataprep-go${_EXT}" ;;
esac
if [ ! -f "$DATAPREP_BIN" ]; then
  DATAPREP_BIN="$GEODB_BIN_DIR/dataprep-go"   # legacy flat location
fi

# -- Step 0: MaxMind GeoLite2 database (skipped when MAXMIND_LICENSE_KEY is unset)
# To get a free license key:
#   1. Sign up at https://www.maxmind.com/en/geolite2/signup
#   2. Log in -> Manage License Keys -> Generate New License Key
#   3. export MAXMIND_LICENSE_KEY=<your key>  (or add it to .env)
if [ -f "$GEODB_DEMO_DIR/GeoLite2-City.mmdb" ] && [ -f "$GEODB_DEMO_DIR/geodb.db" ]; then
  echo "==> GeoLite2 files already present in $GEODB_DEMO_DIR -- skipping download."
elif [ -n "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "==> Updating GeoIP database (MaxMind GeoLite2)..."
  if [ ! -f "$DATAPREP_BIN" ]; then
    echo "    WARNING: dataprep-go binary not found at: $DATAPREP_BIN"
    echo "    Skipping GeoIP update."
  else
    echo "    Using: $DATAPREP_BIN"
    chmod +x "$DATAPREP_BIN"
    # Copy the arch-specific binary to bin/dataprep-go so update-geodb-binary.sh finds it as ./dataprep-go
    cp -f "$DATAPREP_BIN" "$GEODB_BIN_DIR/dataprep-go"
    chmod +x "$GEODB_BIN_DIR/dataprep-go"
    mkdir -p "$GEODB_DEMO_DIR"
    (cd "$GEODB_BIN_DIR" && bash update-geodb-binary.sh "$MAXMIND_LICENSE_KEY")
    echo "==> GeoIP database updated."
  fi
else
  echo "==> Skipping GeoIP update (MAXMIND_LICENSE_KEY not set)."
  echo "    To enable geo-based consent rules, set MAXMIND_LICENSE_KEY and re-run."
  echo "    Sign up free at: https://www.maxmind.com/en/geolite2/signup"
fi

# Report what geolite2 files are available for the DPC container mount
if [ -f "$GEODB_DEMO_DIR/GeoLite2-City.mmdb" ] || [ -f "$GEODB_DEMO_DIR/geodb.db" ]; then
  echo "==> GeoLite2 files present in $GEODB_DEMO_DIR -- geo-based rules enabled."
else
  echo "==> No geolite2 files found in $GEODB_DEMO_DIR -- geo-based rules will be unavailable."
fi

# -- Step 1: Postgres TLS certificate -----------------------------------------
echo "==> Generating self-signed PostgreSQL certificate..."
rm -rf "$CERT_DIR"
mkdir -p "$CERT_DIR"
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
  -keyout "$CERT_DIR/server.key" \
  -out    "$CERT_DIR/server.crt" \
  -subj   "/CN=dpcm-postgres" \
  2>/dev/null
chmod 600 "$CERT_DIR/server.key"
echo "    cert: $CERT_DIR/server.crt"
echo "    key:  $CERT_DIR/server.key"

mkdir -p "$CONFIG_DIR"
cp "$CERT_DIR/server.crt" "$CONFIG_DIR/server.crt"
echo "    copied -> config/server.crt"

# -- Step 2: DPC HTTPS server certificate -------------------------------------
echo "==> Generating self-signed DPC HTTPS certificate..."
rm -rf "$DPCM_CERT_DIR"
mkdir -p "$DPCM_CERT_DIR"
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
  -keyout "$DPCM_CERT_DIR/httpserverkey.key" \
  -out    "$DPCM_CERT_DIR/httpservercert.crt" \
  -subj   "/CN=ivia-dpc" \
  2>/dev/null
# 644 -- DPC container runs as uid 1001 (non-root) and must be able to read the key
chmod 644 "$DPCM_CERT_DIR/httpserverkey.key"
echo "    cert: $DPCM_CERT_DIR/httpservercert.crt"
echo "    key:  $DPCM_CERT_DIR/httpserverkey.key"

cp "$DPCM_CERT_DIR/httpservercert.crt" "$CONFIG_DIR/httpservercert.crt"
cp "$DPCM_CERT_DIR/httpserverkey.key"  "$CONFIG_DIR/httpserverkey.key"
cp "$DPCM_CERT_DIR/httpservercert.crt" "$SCRIPT_DIR/dpcm.crt"
chmod 644 "$CONFIG_DIR/httpserverkey.key"
echo "    copied -> config/httpservercert.crt, config/httpserverkey.key, dpcm.crt"

# -- Step 3: IAG front-end TLS certificate (combined PEM → B64 for inline embed)
# The combined cert+key PEM is base64-encoded and written directly into
# iag-config.yaml using the IAG B64: annotation.  No volume mount is needed.
echo "==> Generating IAG front-end TLS certificate..."
rm -rf "$IAG_CERT_DIR"
mkdir -p "$IAG_CERT_DIR"
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
  -keyout "$IAG_CERT_DIR/server.key" \
  -out    "$IAG_CERT_DIR/server.crt" \
  -subj   "/CN=iag" \
  2>/dev/null
chmod 600 "$IAG_CERT_DIR/server.key"
cat "$IAG_CERT_DIR/server.crt" "$IAG_CERT_DIR/server.key" > "$IAG_CERT_DIR/server.pem"
chmod 600 "$IAG_CERT_DIR/server.pem"
echo "    pem:  $IAG_CERT_DIR/server.pem (will be B64-encoded into iag-config.yaml)"

# -- Step 4: IAG JWT-signing keypair ------------------------------------------
# IAG signs the iv-jwt it injects into each proxied request.
# This PEM is mounted as a file via CONTAINER: path reference so it can be
# rotated by replacing the file without regenerating the entire config.
echo "==> Generating IAG JWT-signing keypair..."
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
  -keyout "$IAG_CERT_DIR/jwt-signing.key" \
  -out    "$IAG_CERT_DIR/jwt-signing.crt" \
  -subj   "/CN=iag-jwt-signing" \
  2>/dev/null
chmod 600 "$IAG_CERT_DIR/jwt-signing.key"
# Combine cert + key -- IAG reads this via CONTAINER: path reference.
cat "$IAG_CERT_DIR/jwt-signing.crt" "$IAG_CERT_DIR/jwt-signing.key" \
  > "$IAG_CERT_DIR/jwt-signing.pem"
chmod 600 "$IAG_CERT_DIR/jwt-signing.pem"
echo "    pem:  $IAG_CERT_DIR/jwt-signing.pem"

# -- Step 5: Write iag-config.yaml --------------------------------------------
# Both the front-end cert and the JWT signing cert are base64-encoded inline
# (B64: annotation). No volume mounts are needed for any PEM files.
echo "==> Writing iag-config.yaml..."

# Encode both combined PEMs as single-line base64 strings (no newlines).
_IAG_SERVER_B64="B64:$(base64 -w0 "$IAG_CERT_DIR/server.pem")"
_IAG_JWT_B64="B64:$(base64 -w0 "$IAG_CERT_DIR/jwt-signing.pem")"

cat > "$SCRIPT_DIR/iag-config.yaml" << IAGEOF
# AUTO-GENERATED by setup.sh -- do not edit by hand.
# Re-run setup.sh to regenerate with fresh credentials and certs.
# Images:
#   DPC:  icr.io/ivia-eap/ivia-dpc:26.09
#   IAG:  icr.io/ibmappgateway/ibm-application-gateway:26.06
version: "26.06"

server:
  local_applications:
    cred_viewer:
      path_segment: credview
      enable_html: true
  ssl:
    front_end:
      certificate:
        # B64: embeds the combined cert+key PEM inline -- no volume mount needed.
        # Regenerate by re-running setup.sh.
        - "${_IAG_SERVER_B64}"

identity:
  oauth:
    - name: verify_introspection
      restricted: false
      introspection_endpoint: "${VERIFY_TENANT_URL}/oauth2/introspect"
      client_id: "${VERIFY_CLIENT_ID}"
      client_secret: "${VERIFY_CLIENT_SECRET}"
      auth_method: client_secret_post
      token_type_hint: access_token
      mapped_identity: '{sub}'
      multi_valued_scope: false
      attributes:
        - +scope
        - +client_id
        - +iat
        - +exp

  oidc:
    discovery_endpoint: "${VERIFY_TENANT_URL}/oauth2/.well-known/openid-configuration"
    client_id: "${VERIFY_CLIENT_ID}"
    client_secret: "${VERIFY_CLIENT_SECRET}"
    scopes:
      - ibm.dpc.read_dataitems
      - ibm.dpc.manage_dataitems
      - ibm.dpc.read_accesstypes
      - ibm.dpc.manage_accesstypes
      - ibm.dpc.read_purposes
      - ibm.dpc.manage_purposes
      - ibm.dpc.read_rules
      - ibm.dpc.manage_rules
      - ibm.dpc.read_policies
      - ibm.dpc.manage_policies
      - ibm.dpc.read_geo
      - ibm.dpc.read_consents

resource_servers:

  - path: "/dpcm-mgmt"
    transparent_path: true
    connection_type: "ssl"
    sni: dpcm
    servers:
      - host: dpcm
        port: 8438
        ssl:
          certificate:
            - "@dpcm.crt"
    identity:
      oauth: verify_introspection
    identity_headers:
      attributes:
        - attribute: AZN_CRED_AUTHZN_ID
          header: iv_user
        - attribute: groupIds
          header: iv_groups
      jwt:
        certificate: "${_IAG_JWT_B64}"
        hdr_name: iv-jwt
        claims:
          - text: www.ibm.com
            name: iss
          - attr: AZN_CRED_PRINCIPAL_NAME
            name: sub
          - attr: AZN_*
          - attr: scope*
          - attr: client_id
            name: client_id

  - path: "/dpcm"
    transparent_path: true
    connection_type: "ssl"
    sni: dpcm
    servers:
      - host: dpcm
        port: 8438
        ssl:
          certificate:
            - "@dpcm.crt"
    identity:
      oauth: verify_introspection
    identity_headers:
      attributes:
        - attribute: AZN_CRED_AUTHZN_ID
          header: iv_user
        - attribute: groupIds
          header: iv_groups
      jwt:
        certificate: "${_IAG_JWT_B64}"
        hdr_name: iv-jwt
        claims:
          - text: www.ibm.com
            name: iss
          - attr: AZN_CRED_PRINCIPAL_NAME
            name: sub
          - attr: AZN_*
          - attr: scope*
          - attr: client_id
            name: client_id

  - path: "/ui"
    transparent_path: false
    connection_type: "ssl"
    sni: dpcm
    servers:
      - host: dpcm
        port: 8438
        ssl:
          certificate:
            - "@dpcm.crt"
    identity:
      oauth: verify_introspection
    identity_headers:
      attributes:
        - attribute: AZN_CRED_AUTHZN_ID
          header: iv_user
        - attribute: groupIds
          header: iv_groups
      jwt:
        certificate: "${_IAG_JWT_B64}"
        hdr_name: iv-jwt
        claims:
          - text: www.ibm.com
            name: iss
          - attr: AZN_CRED_PRINCIPAL_NAME
            name: sub
          - attr: AZN_*
          - attr: scope
            name: scope
          - attr: client_id
            name: client_id
IAGEOF

echo "    written: iag-config.yaml (front-end cert embedded as B64:)"

# -- Step 6: Clean slate ------------------------------------------------------
echo "==> Removing any existing containers and volumes..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

for VOL in postgres_data beta_postgres_data; do
  docker volume rm "$VOL" 2>/dev/null && echo "    removed volume: $VOL" || true
done

# -- Step 7: Start postgres + dpc, wait for healthy ---------------------------
echo "==> Starting postgres and dpc..."
docker compose -f "$COMPOSE_FILE" up -d postgres dpc

echo "==> Waiting for postgres to become healthy..."
PG_TIMEOUT=120
PG_ELAPSED=0
until [ "$(docker inspect --format='{{.State.Health.Status}}' dpcm-postgres 2>/dev/null)" = "healthy" ]; do
  if [ "$PG_ELAPSED" -ge "$PG_TIMEOUT" ]; then
    echo ""
    echo "ERROR: timed out waiting for postgres to become healthy. Logs:"
    docker logs dpcm-postgres --tail 30
    exit 1
  fi
  printf "."
  sleep 2
  PG_ELAPSED=$((PG_ELAPSED + 2))
done
echo ""

echo "==> Waiting for dpc to start..."
DPC_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q dpc)
TIMEOUT=60
ELAPSED=0
until docker logs "$DPC_CONTAINER" 2>&1 | grep -q '"msg":"Starting HTTPS server"'; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$DPC_CONTAINER" 2>/dev/null)
  if [ "$STATUS" = "exited" ] || [ "$STATUS" = "dead" ]; then
    echo ""
    echo "ERROR: dpc container exited. Logs:"
    docker logs "$DPC_CONTAINER" --tail 50
    exit 1
  fi
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo ""
    echo "ERROR: timed out waiting for dpc. Last logs:"
    docker logs "$DPC_CONTAINER" --tail 50
    exit 1
  fi
  printf "."
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
echo ""
echo "==> dpc is ready."

# -- Step 8: Start iag --------------------------------------------------------
echo "==> Starting iag..."
docker compose -f "$COMPOSE_FILE" up -d iag

echo ""
echo "Stack is up."
echo ""
echo "  IAG:  https://localhost:8443"
echo "  DPC:  https://localhost:8438"
echo ""
echo "Tables in the dpc database:"
docker exec dpcm-postgres psql -U dpcm_user -d dpcm -c "\dt"
