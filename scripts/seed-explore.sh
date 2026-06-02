#!/usr/bin/env bash
# Post-deploy gallery seed: creates a few example designs so /explore isn't
# empty for your first visitors. Run AFTER the backend is deployed.
#
#   BIOS_API_BASE=https://your-render-url.onrender.com bash scripts/seed-explore.sh
#
# Each design makes real Claude/NIM/ESMFold calls (a little $, bounded by the
# global wallet cap). Safe to re-run: identical designs dedupe by content hash.
set -euo pipefail

BASE="${BIOS_API_BASE:-${1:-}}"
if [ -z "$BASE" ]; then
  echo "Set BIOS_API_BASE (or pass the API URL as arg 1)." >&2
  exit 1
fi
BASE="${BASE%/}"

intents=(
  "design a small antimicrobial peptide that disrupts bacterial membranes"
  "make a thermostable variant of green fluorescent protein"
  "design a small zinc-finger DNA-binding protein"
  "codon-optimize human insulin for expression in E. coli"
  "design CRISPR guide RNAs to knock out human PCSK9"
)

for intent in "${intents[@]}"; do
  echo "seeding: $intent"
  # The stream endpoint persists the design server-side; we just need it to run.
  curl -sN --max-time 200 -X POST \
    -H 'Content-Type: application/json' \
    --data "{\"intent\":\"${intent}\"}" \
    "$BASE/api/design/stream" \
    | grep -o '"type":"saved"[^}]*}' | head -1 || true
  sleep 2
done

echo "Done. Open your app's /explore to confirm the gallery is populated."
