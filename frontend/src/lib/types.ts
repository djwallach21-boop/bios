// Frontend mirror of the BiOS API contract (one envelope, every modality).

export interface ParsedIntent {
  targetFunction: string;
  organism: string;
  constraints: string[];
  similarProteins: string[];
  keywords: string[];
}

// "scaffold" = closest natural sequence returned verbatim (no redesign ran);
// "proteinmpnn" = computed redesign. Drives the honesty label on the card.
export type ProteinOrigin = "proteinmpnn" | "scaffold";

export interface ProteinCandidate {
  name: string;
  sequence: string;
  confidence: number | null;
  pdb: string | null;
  origin?: ProteinOrigin;
}

export interface ProteinReference {
  id: string;
  title: string;
  organism: string;
  accession: string;
}

export interface DnaConstruct {
  host: string;
  proteinName: string;
  protein: string;
  dna: string;
  lengthBp: number;
  gc: number;
}

export interface CrisprGuide {
  sequence: string;
  pam: string;
  strand: "+" | "-";
  start: number;
  gc: number;
  score: number;
}

export type ResultKind = "protein" | "dna" | "crispr" | "decline";
export type Computed = "real" | "deterministic" | "reference-only";

export interface DesignResult {
  intent: string;
  modality: string;
  kind: ResultKind;
  computed: Computed;
  confidence: number | null;
  parsed: ParsedIntent;
  references: ProteinReference[];
  explanation: string;
  candidates: ProteinCandidate[];
  construct?: DnaConstruct;
  guides?: CrisprGuide[];
  target?: { name: string; lengthBp: number };
  declineReason?: string;
  alternative?: string;
}

// ---- streaming ----
export type StageStatus = "pending" | "active" | "done";

export interface StreamStage {
  id: string;
  label: string;
  status: StageStatus;
}

export interface StreamState {
  stages: StreamStage[]; // delivered on the wire, modality-specific
  text: string;
  modality: string | null;
}

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; status: "streaming"; stream: StreamState }
  | {
      id: string;
      role: "assistant";
      status: "done";
      result: DesignResult;
      designId?: string;
    }
  | { id: string; role: "assistant"; status: "error"; message: string };
