#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || cp .env.example .env
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  . .venv/bin/activate
  python -m pip install -r requirements.txt
fi
. .venv/bin/activate
exec python Host.py
