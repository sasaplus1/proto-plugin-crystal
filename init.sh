#!/bin/bash

set -euo pipefail

__main() {
  unset -f __main

  if [ -x './extism-js' ]
  then
    exit
  fi

  local os=
  case "$(uname -s)" in
    Darwin)
      os=macos
      ;;
    Linux)
      os=linux
      ;;
    *)
      echo "Unsupported OS: $(uname -s)" >&2
      exit 1
      ;;
  esac

  local arch=
  case "$(uname -m)" in
    aarch64|arm64)
      arch=aarch64
      ;;
    x86_64|amd64)
      arch=x86_64
      ;;
    *)
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac

  gh release download --repo extism/js-pdk v1.5.1 --pattern "*-${arch}-${os}-*" --skip-existing

  local -r file="$(basename "$(find . -maxdepth 1 -name "*-${arch}-${os}-*.gz")")"
  local -r checksum="$(cat "${file}.sha256")"
  printf -- '%s  %s' "$checksum" "$file" > "${file}.sha256"

  local shasum=
  type shasum &>/dev/null && shasum='shasum -a 256'
  type sha256sum &>/dev/null && shasum=sha256sum
  if [ -z "$shasum" ]
  then
    echo "Neither shasum nor sha256sum is available" >&2
    exit 1
  fi

  if ! "$shasum" --check --status "${file}.sha256"
  then
    echo "Checksum verification failed" >&2
    exit 1
  fi

  rm -f "${file}.sha256"
  gunzip "$file"

  local -r base="${file%.gz}"
  chmod +x "$base"

  [ "$os" == 'macos' ] && xattr -c "$base"

  mv "$base" extism-js
}
__main "$@"
