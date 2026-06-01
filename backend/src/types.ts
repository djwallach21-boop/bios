// Canonical BiOS API contract. One envelope spans every design modality so the
// UI, /v1 API, registry, and SDK render any design type. The protein case is a
// strict superset of the original shape, so legacy records stay valid.

export interface ParsedIntent {
  targetFunction: string;
  organism: string;
  constraints: string[];
  similarProteins: string[];
  keywords: string[];
}

// How a protein sequence was produced. "scaffold" = the closest natural
// sequence returned verbatim (no redesign ran); "proteinmpnn" = a computed
// redesign. Drives the honesty label on the card.
export type ProteinOrigin = "proteinmpnn" | "scaffold";

export interface DesignCandidate {
  name: string;
  sequence: string;
  confidence: number | null; // mean pLDDT (0-1)
  pdb: string | null;
  origin?: ProteinOrigin; // optional: legacy records predate this field
}

export interface DesignReference {
  id: string;
  title: string;
  organism: string;
  accession: string;
}

// DNA / codon-optimization result.
export interface DnaConstruct {
  host: string; // display label, e.g. "E. coli"
  proteinName: string;
  protein: string; // amino-acid sequence used
  dna: string; // codon-optimized coding sequence
  lengthBp: number;
  gc: number; // 0-1
}

// CRISPR SpCas9 guide.
export interface CrisprGuide {
  sequence: string; // 20nt protospacer
  pam: string;
  strand: "+" | "-";
  start: number;
  gc: number; // 0-1
  score: number; // 0-1 heuristic
}

export type ResultKind = "protein" | "dna" | "crispr" | "decline";
// How the result was produced -- the honesty signal shown as a badge.
export type Computed = "real" | "deterministic" | "reference-only";

export interface DesignResult {
  intent: string;
  modality: string;
  kind: ResultKind;
  computed: Computed;
  confidence: number | null;
  parsed: ParsedIntent;
  references: DesignReference[];
  explanation: string;

  // Protein modality
  candidates: DesignCandidate[];

  // DNA modality
  construct?: DnaConstruct;

  // CRISPR modality
  guides?: CrisprGuide[];
  target?: { name: string; lengthBp: number };

  // Decline (we will not fabricate a result we cannot compute)
  declineReason?: string;
  alternative?: string;
}
