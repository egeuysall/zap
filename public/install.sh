#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO="${ZAP_GITHUB_REPO:-egeuysall/zap}"
BIN_DIR="${ZAP_INSTALL_DIR:-${HOME}/.local/bin}"
TARGET="${BIN_DIR}/zap"
SOURCE_ROOT="${HOME}/.local/share/zap-cli"
RELEASE_API_URL="${ZAP_RELEASE_API_URL:-https://api.github.com/repos/${GITHUB_REPO}/releases/latest}"
RELEASE_TAG="${ZAP_RELEASE_TAG:-}"

fail() { echo "[error] $*" >&2; exit 1; }
ok() { echo "[ok] $*"; }
info() { echo "[info] $*"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"; }

need curl
need tar
[ -n "${HOME:-}" ] && [ "${HOME}" != "/" ] || fail "HOME must be a non-root absolute path"
case "${SOURCE_ROOT}" in
  "${HOME}"/.local/share/*) ;;
  *) fail "refusing unsafe source directory: ${SOURCE_ROOT}" ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  info "installing bun"
  curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"
fi
command -v bun >/dev/null 2>&1 || fail "bun installation failed"

tag="${RELEASE_TAG}"
if [ -z "${tag}" ]; then
  tag="$(curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error "${RELEASE_API_URL}" | sed -nE 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n1)"
fi
[ -n "${tag}" ] || fail "failed to resolve latest release"

tmp="$(mktemp "${TMPDIR:-/tmp}/zap-source.XXXXXX.tar.gz")"
mkdir -p "${HOME}/.local/share"
stage="$(mktemp -d "${HOME}/.local/share/zap-cli-stage.XXXXXX")"
backup="${SOURCE_ROOT}.previous"
trap 'rm -f "${tmp}"; rm -rf "${stage}"' EXIT

curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error "https://github.com/${GITHUB_REPO}/archive/refs/tags/${tag}.tar.gz" -o "${tmp}"
tar -xzf "${tmp}" --strip-components=1 -C "${stage}"
[ -f "${stage}/cli/src/index.ts" ] || fail "release does not contain the Zap CLI"
expected_version="${tag#v}"
staged_version="$(bun "${stage}/cli/src/index.ts" --version)"
[ "${staged_version}" = "${expected_version}" ] || fail "release version mismatch: expected ${expected_version}, got ${staged_version}"

rm -rf "${backup}"
if [ -d "${SOURCE_ROOT}" ]; then mv "${SOURCE_ROOT}" "${backup}"; fi
if ! mv "${stage}" "${SOURCE_ROOT}"; then
  if [ -d "${backup}" ]; then mv "${backup}" "${SOURCE_ROOT}"; fi
  fail "failed to activate Zap CLI"
fi
rm -rf "${backup}"
mkdir -p "${BIN_DIR}"

cat >"${TARGET}" <<EOF
#!/usr/bin/env bash
if command -v bun >/dev/null 2>&1; then
  exec bun "${SOURCE_ROOT}/cli/src/index.ts" "\$@"
fi
exec "\${HOME}/.bun/bin/bun" "${SOURCE_ROOT}/cli/src/index.ts" "\$@"
EOF
chmod 0755 "${TARGET}"

case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *) echo "Add ${BIN_DIR} to PATH to run zap from any terminal." ;;
esac

installed_version="$("${TARGET}" --version)"
ok "installed zap ${installed_version} to ${TARGET}"
