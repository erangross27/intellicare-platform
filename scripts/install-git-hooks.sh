#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

chmod +x .githooks/pre-commit .githooks/pre-push
git config core.hooksPath .githooks

echo "Installed IntelliCare secret-scanning hooks from .githooks/"
