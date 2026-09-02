#!/bin/sh
# grimoire — build the server, build the read-only index from the pinned skill pack(s),
# and link the bins into ~/.local/bin. Idempotent: re-running rebuilds the index
# (write-once + fail-closed publication) and re-links. The index + manifest live under ~/.grimoire.
# If a required pack is absent, the install FAILS (exit 1); any existing index is left
# untouched until publication, and a clean machine then reports INDEX_MISSING.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
command -v node >/dev/null 2>&1 || { echo "node (>=22.17) required" >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit((a>22||(a===22&&b>=17))?0:1)' \
  || { echo "grimoire needs Node >=22.17 for node:sqlite; found $(node -v)" >&2; exit 1; }

unset NODE_TLS_REJECT_UNAUTHORIZED
cd "$HERE"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build

# ---- link bins, pinned to the version-gated Node ------------------------------------
# Wrapper targets are derived from package.json#bin so the launcher path can never drift
# from the declared entry points (e.g. grimoire-index -> dist/src/indexer.js, not index.js).
# Linked BEFORE indexing so a pack-less checkout still gets a working server that honestly
# reports INDEX_MISSING.
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
NODE_BIN="$(command -v node)"
node -e 'const b=require("./package.json").bin||{};for(const[n,p]of Object.entries(b))console.log(n+" "+p)' | while read -r name rel; do
  [ -n "$name" ] || continue
  target="$BIN/$name"
  cat > "$target" <<EOF
#!/bin/sh
# $name launcher — pinned to the Node validated at install; re-checks >=22.17 (node:sqlite).
NODE="\${GRIMOIRE_NODE:-$NODE_BIN}"
command -v "\$NODE" >/dev/null 2>&1 || NODE=node
"\$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a>22||(a===22&&b>=17))?0:1)' || {
  echo "$name: needs Node >=22.17 for node:sqlite; \$NODE is \$("\$NODE" -v 2>/dev/null || echo missing)" >&2
  exit 1
}
exec "\$NODE" "$HERE/$rel" "\$@"
EOF
  chmod +x "$target"
  echo "installed $target"
done

case ":$PATH:" in
  *":$BIN:"*) : ;;
  *) echo "NOTE: add $BIN to your PATH" ;;
esac

# ---- build the index from pinned packs (served_by grimoire) --------------------------
# Packs come from registry/optional-services.json (served_by includes grimoire).
# A required pack that is absent FAILS (non-zero) rather than silently succeeding
# without rebuilding. The indexer builds temp artifacts before publishing; interruption
# between the two final renames reports INDEX_STALE and is repaired by rerunning install.
node dist/src/served-packs.js --repo "$REPO" --index --indexer "$HERE/dist/src/indexer.js"

echo "Point your MCP host at the stdio command: grimoire-server"
