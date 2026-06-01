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

// Screen any free text (the intent, a resolved target name) for harm intent.
export function screenText(text: string): BiosafetyResult {
  const s = text.toLowerCase();
  for (const t of terms()) {
    if (s.includes(t)) return { allowed: false, matched: t };
  }
  return { allowed: true };
}
