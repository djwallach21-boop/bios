// First-line dual-use guardrail. A deterministic, defensive screen that runs
// BEFORE any model call or persistence. Its only action is to REFUSE: if a
// request expresses intent to cause harm or to enhance a pathogen's danger,
// BiOS declines and designs nothing. Legitimate research (vaccines,
// diagnostics, binders, enzymes) is unaffected. This is an honest minimum and
// not a substitute for a production homology screen against the regulated
// lists (e.g. an IBBIS Common Mechanism / BLAST check), which is the next step.

// Phrases that signal intent to weaponize or increase harm. The operator can
// extend this via BIOS_BIOSAFETY_TERMS (comma-separated) without code changes.
const HARM_INTENT: string[] = [
  // Weaponization phrasing.
  "bioweapon",
  "biological weapon",
  "weaponize",
  "weaponise",
  "gain of function",
  "increase lethality",
  "more lethal",
  "more deadly",
  "more transmissible",
  "evade vaccine",
  "evade immunity",
  "defeat detection",
  "for an attack",
  "biological attack",
  "bioterror",
  "nerve agent",
  "chemical weapon",
  // Harm-OUTCOME phrasing. The list above only caught the act of weaponizing,
  // so a blunt request like "synthesize ricin to poison people" slipped through.
  // These phrases signal intent to harm humans and are vanishingly rare in
  // legitimate research prose (which says "treat", "detect", "neutralize"), so
  // they screen real malice without blocking dual-use work (vaccines, Botox,
  // immunotoxin therapeutics, antitoxins).
  "to poison people",
  "poison people",
  "poison humans",
  "to poison a",
  "to kill people",
  "kill people",
  "kill humans",
  "harm people",
  "harm humans",
  "hurt people",
  "mass casualt", // casualty / casualties
  "cause a pandemic",
  "start a pandemic",
  "engineer a pandemic",
  "spread a disease",
  "infect people",
  "release a pathogen",
];

function terms(): string[] {
  const extra = (process.env.BIOS_BIOSAFETY_TERMS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...HARM_INTENT, ...extra];
}

export interface BiosafetyResult {
  allowed: boolean;
  matched?: string;
}

export function screenText(text: string): BiosafetyResult {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[​-‍­﻿]/g, "")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase();
  for (const t of terms()) {
    if (s.includes(t)) return { allowed: false, matched: t };
  }
  return { allowed: true };
}

// A raw sequence pasted into the intent (a >=25-residue protein run or a
// >=40-nt DNA run) is used verbatim as the design target by the DNA/CRISPR
// modalities. The keyword screen above only reads English prose, so a pasted
// sequence of concern would sail through. We cannot do sequence-level
// biosecurity screening (homology against the regulated/select-agent lists)
// here, so we FAIL CLOSED on pasted sequences until that screen exists. The
// named-target path (GenBank lookup by gene/protein name) is unaffected.
// Trusted/authenticated deployments can opt back in via env.
export function containsRawSequence(text: string): boolean {
  if (process.env.BIOS_ALLOW_PASTED_SEQUENCES === "1") return false;
  const upper = text.toUpperCase();
  return /[ACDEFGHIKLMNPQRSTVWY]{25,}/.test(upper) || /[ACGT]{40,}/.test(upper);
}
