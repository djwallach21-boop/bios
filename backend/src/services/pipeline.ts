import {
  parseIntent,
  classifyIntent,
  synthesizeExplanation,
  generateText,
} from "./claude";
import { searchProteins } from "./genbank";
import { generateRedesignedSequences } from "./denovo";
import { foldSequence } from "./esmfold";
import {
  computeDna,
  computeCrispr,
  dnaExplanationPrompt,
  crisprExplanationPrompt,
} from "./modalities";
import { screenText, containsRawSequence } from "./biosafety";
import type { DesignResult, ParsedIntent } from "../types";

const EMPTY_PARSED: ParsedIntent = {
  targetFunction: "",
  organism: "",
  constraints: [],
  similarProteins: [],
  keywords: [],
};

// Pre-routing decline (safety / pasted sequence): no parsed intent yet.
function declined(
  intent: string,
  reason: string,
  alternative: string
): DesignResult {
  return {
    intent,
    modality: "declined",
    kind: "decline",
    computed: "reference-only",
    confidence: null,
    parsed: EMPTY_PARSED,
    references: [],
    explanation: `${reason} ${alternative}`,
    candidates: [],
    declineReason: reason,
    alternative,
  };
}

// Post-routing decline (could not resolve a target for the chosen modality).
function decline(
  intent: string,
  parsed: ParsedIntent,
  modality: string,
  reason: string,
  alternative: string
): DesignResult {
  return {
    intent,
    modality,
    kind: "decline",
    computed: "reference-only",
    confidence: null,
    parsed,
    references: [],
    explanation: `${reason} ${alternative}`,
    candidates: [],
    declineReason: reason,
    alternative,
  };
}

// Generate explanatory prose, falling back to a short note if the model call
// fails -- a 429/5xx must never throw away an already-computed design.
async function explainOrFallback(
  fn: () => Promise<string>,
  fallback: string
): Promise<string> {
  try {
    const text = await fn();
    if (text.trim()) return text;
  } catch (e) {
    console.error("explanation failed:", e instanceof Error ? e.message : e);
  }
  return fallback;
}

// The one canonical NON-STREAMING design pipeline behind POST /v1/designs and
// POST /api/design (the documented public REST API + SDK surface). It mirrors
// the streaming path's modality routing so the REST API and the chat UI never
// diverge: parse + route -> (protein | dna | crispr) -> explain.
export async function runDesign(intent: string): Promise<DesignResult> {
  if (!screenText(intent).allowed) {
    return declined(
      intent,
      "This request was declined by the BiOS safety screen and nothing was designed.",
      "Rephrase as a legitimate research goal."
    );
  }
  // Fail closed on pasted raw sequences (mirrors the streaming path), so the
  // contract is identical on /v1/designs and /api/design.
  if (containsRawSequence(intent)) {
    return declined(
      intent,
      "Pasted raw sequences can't be safety-screened yet, so BiOS does not design directly from them.",
      "Describe the target by name or function (e.g. 'codon-optimize human insulin for E. coli')."
    );
  }

  const route = await classifyIntent(intent);
  const parsed = await parseIntent(intent);

  // ---- DNA: codon-optimize a named protein into a coding sequence ----
  if (route.modality === "dna") {
    const dna = await computeDna(intent, parsed);
    if (!dna) {
      return decline(
        intent,
        parsed,
        "dna",
        "I could not find a protein to codon-optimize from that request.",
        "Name a known protein, e.g. 'codon-optimize human insulin for E. coli'."
      );
    }
    return {
      intent,
      modality: "dna",
      kind: "dna",
      computed: "deterministic",
      confidence: null,
      parsed,
      references: dna.references,
      explanation: await explainOrFallback(
        () => generateText(dnaExplanationPrompt(intent, dna.construct)),
        "Codon-optimized sequence ready. The written analysis could not be generated this time, but the construct below is valid."
      ),
      candidates: [],
      construct: dna.construct,
    };
  }

  // ---- CRISPR: enumerate SpCas9 guides for a named target ----
  if (route.modality === "crispr") {
    const cr = await computeCrispr(intent, parsed);
    if (!cr) {
      return decline(
        intent,
        parsed,
        "crispr",
        "I could not fetch a target sequence to scan for guides.",
        "Name a gene, e.g. 'CRISPR guides to knock out human PCSK9'."
      );
    }
    return {
      intent,
      modality: "crispr",
      kind: "crispr",
      computed: "deterministic",
      confidence: null,
      parsed,
      references: cr.references,
      explanation: await explainOrFallback(
        () =>
          generateText(
            crisprExplanationPrompt(intent, cr.target.name, cr.guides.length)
          ),
        "Guide RNAs ready. The written analysis could not be generated this time, but the guides below are valid."
      ),
      candidates: [],
      guides: cr.guides,
      target: cr.target,
    };
  }

  // ---- Protein (the original pipeline) ----
  // find natural scaffolds (GenBank) -> design novel sequences (ProteinMPNN, or
  // scaffold fallback) -> fold the top candidate (ESMFold) -> explain (Claude).
  const references = await searchProteins(parsed.keywords);

  const referenceSequences = references.map((r) => r.sequence).filter(Boolean);
  const raw = await generateRedesignedSequences(
    parsed.targetFunction,
    referenceSequences,
    foldSequence
  );
  const top = raw.slice(0, 3);

  const candidates = await Promise.all(
    top.map(async (c, i) => {
      const fold = i === 0 ? await foldSequence(c.sequence) : null;
      return {
        name: c.name,
        sequence: c.sequence,
        confidence: fold ? fold.meanPlddt : null,
        pdb: fold ? fold.pdb : null,
        origin: c.origin,
      };
    })
  );

  // When no redesign ran (verbatim natural scaffolds), this is a reference,
  // not a computed design -- label it honestly.
  const computed = top[0]?.origin === "scaffold" ? "reference-only" : "real";

  const explanation = await explainOrFallback(
    () =>
      synthesizeExplanation(
        intent,
        candidates.map((c) => c.sequence),
        references.map((r) => r.title)
      ),
    "Design complete. The written analysis could not be generated this time, but the candidate sequences and predicted structure are valid."
  );

  return {
    intent,
    modality: "protein",
    kind: "protein",
    computed,
    confidence: candidates[0]?.confidence ?? null,
    parsed,
    candidates,
    references: references.map((r) => ({
      id: r.id,
      title: r.title,
      organism: r.organism,
      accession: r.accession,
    })),
    explanation,
  };
}
