#!/usr/bin/env bash
# Start the API server, social-worker console, and Expo student app together.
# Press Ctrl-C to stop the processes started by this script.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/unfold/server"
WORKER_DIR="$ROOT_DIR/unfold/worker-web"
CLIENT_DIR="$ROOT_DIR/unfold"
SERVER_URL="http://localhost:8787"
SERVER_PID=""
PIDS=()
NAMES=()

cleanup() {
  local pid
  for pid in "${PIDS[@]-}"; do
    [[ -n "$pid" ]] || continue
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${PIDS[@]-}"; do
    [[ -n "$pid" ]] || continue
    wait "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  echo "Error: $*" >&2
  exit 1
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  fail "Node.js and npm are required. Install Node.js 20 or newer first."
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 20 )); then
  fail "Node.js 20 or newer is required (found $(node --version))."
fi
command -v curl >/dev/null 2>&1 || fail "curl is required to check that the API server is ready."
command -v lsof >/dev/null 2>&1 || fail "lsof is required to check that the service ports are available."

for port in 8787 5173 8081; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    fail "Port $port is already in use. Stop the existing service and try again; this script will not terminate processes it did not start."
  fi
done

if [[ ! -f "$SERVER_DIR/.env" ]]; then
  cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
  echo "Created unfold/server/.env from .env.example."
fi
if [[ ! -f "$CLIENT_DIR/.env.local" ]]; then
  cp "$CLIENT_DIR/.env.example" "$CLIENT_DIR/.env.local"
  echo "Created unfold/.env.local from .env.example."
fi

# Ensure the client can reach the local API without overwriting other settings.
node - "$CLIENT_DIR/.env.local" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
let contents = fs.readFileSync(path, 'utf8');
const apiUrl = 'EXPO_PUBLIC_API_URL=http://localhost:8787';
if (/^EXPO_PUBLIC_API_URL=.*$/m.test(contents)) {
  contents = contents.replace(/^EXPO_PUBLIC_API_URL=.*$/m, (line) =>
    line.slice('EXPO_PUBLIC_API_URL='.length).trim() ? line : apiUrl,
  );
} else {
  contents = `${contents.trimEnd()}\n${apiUrl}\n`;
}
fs.writeFileSync(path, contents);
NODE

ensure_dependencies() {
  local dir="$1"
  if [[ ! -d "$dir/node_modules" ]]; then
    echo "Installing dependencies in ${dir#"$ROOT_DIR/"}..."
    (cd "$dir" && npm install)
  fi
}

ensure_dependencies "$SERVER_DIR"
ensure_dependencies "$WORKER_DIR"
ensure_dependencies "$CLIENT_DIR"

# Seed is idempotent and creates the local demo worker accounts.
echo "Seeding local demo accounts..."
(cd "$SERVER_DIR" && npm run seed)

echo "Starting API server..."
(
  cd "$SERVER_DIR"
  exec npm run dev
) &
SERVER_PID=$!
PIDS+=("$SERVER_PID")
NAMES+=("API server")

ready=false
for ((attempt = 1; attempt <= 30; attempt++)); do
  if curl -fsS "$SERVER_URL/api/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "The API server exited before becoming ready."
  fi
  sleep 1
done
$ready || fail "The API server did not become ready at $SERVER_URL within 30 seconds."

start_service() {
  local name="$1"
  local dir="$2"
  shift 2
  echo "Starting $name..."
  (
    cd "$dir"
    exec "$@"
  ) &
  PIDS+=("$!")
  NAMES+=("$name")
}

start_service "Social-worker console" "$WORKER_DIR" npm run dev
start_service "Student app (web)" "$CLIENT_DIR" npm run web

echo
echo "All services started."
echo "  Student app:         http://localhost:8081"
echo "  Social-worker app:   http://localhost:5173"
echo "  API health:          $SERVER_URL/api/health"
echo "  Demo worker login:   demo.worker@unfold.local / demo1234"
echo
echo "Voice transcription requires EXPO_PUBLIC_ELEVENLABS_API_KEY in unfold/.env.local."
echo "For Expo Go on a physical phone, set EXPO_PUBLIC_API_URL to your computer's LAN IP and restart this script."
echo "Press Ctrl-C to stop."

# Keep this script alive; if a service exits, report it and shut down the rest.
while true; do
  for index in "${!PIDS[@]}"; do
    pid="${PIDS[$index]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      set +e
      wait "$pid"
      status=$?
      set -e
      echo "${NAMES[$index]} exited (status $status); stopping the other services." >&2
      exit "$status"
    fi
  done
  sleep 2
done
