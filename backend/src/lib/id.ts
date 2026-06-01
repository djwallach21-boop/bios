import { createHash } from "crypto";
import type { DesignResult } from "../types";

// Content-addressed, immutable design id. Identical inputs+designs collapse to
// one record (npm-style dedup) and the id becomes a stable citation/fork
// anchor. Hash the intent + designed sequences only (NOT the non-deterministic
// Claude prose), so the same design is always the same id.
export function contentId(result: DesignResult): string {
  const canonical = JSON.stringify({
    intent: result.intent.trim().toLowerCase(),
    modality: result.modality,
    kind: result.kind,
    sequences: result.candidates.map((c) => c.sequence),
    dna: result.construct?.dna ?? null,
    guides: result.guides?.map((g) => g.sequence) ?? null,
  });
  const hash = createHash("sha256").update(canonical).digest("base64url");
  return `d_${hash.slice(0, 16)}`;
}
