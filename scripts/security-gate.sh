#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' '== RecoverOS security gate: dependency audit =='
npm audit --omit=dev --audit-level=high

printf '%s\n' '== RecoverOS security gate: tracked secret patterns =='
if git grep -nEI -- ':!*.lock' ':!*.map' 'AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----'; then
  echo 'Potential credential material found in tracked files.' >&2
  exit 1
fi

printf '%s\n' '== RecoverOS security gate: typecheck =='
npm run lint
printf '%s\n' '== RecoverOS security gate: unit tests =='
npm test
printf '%s\n' '== RecoverOS security gate: production build =='
npm run build
printf '%s\n' 'SECURITY GATE PASSED'
