import { parseIntent, synthesizeExplanation } from "./claude";
import { searchProteins } from "./genbank";
import { generateRedesignedSequences } from "./denovo";
import { foldSequence } from "./esmfold";
import { screenText, containsRawSequence } from "./biosafety";
import type { DesignResult } from "../types";

// The one canonical design pipeline. Every surface (chat, public REST API, SDK)
// runs THIS, so the contract and behavior stay identical everywhere.
//
// parse intent -> find natural scaffolds (GenBank) -> design novel sequences
// (ProteinMPNN, or scaffold fallback) -> fold the top candidate (ESMFold) for
// real structure + pLDDT -> explain (Claude).
export async function runDesign(intent: string): Promise<DesignResult> {
  if (!screenText(intent).allowed) {
    return {
      intent,
      modality: "declined",
      kind: "decline",
      computed: "reference-only",
      confidence: null,
      parsed: {
        targetFunction: "",
        organism: "",
        constraints: [],
        similarProteins: [],
        keywords: [],
      },
      references: [],
      explanation:
        "This request was declined by the BiOS safety screen and nothing was designed.",
      candidates: [],
      declineReason: "Declined by the safety screen.",
      alternative: "Rephrase as a legitimate research goal.",
    };
  }
  // Fail closed on pasted raw sequences here too (mirrors the streaming path),
  // so the contract is identical on /v1/designs and /api/design.
  if (containsRawSequence(intent)) {
    return {
      intent,
      modality: "declined",
      kind: "decline",
      computed: "reference-only",
      confidence: null,
      parsed: {
        targetFunction: "",
        organism: "",
        constraints: [],
        similarProteins: [],
        keywords: [],
      },
      references: [],
      explanation:
        "Pasted raw sequences can't be safety-screened yet, so BiOS does not design directly from them. Describe the target by name or function instead.",
      candidates: [],
      declineReason: "Pasted raw sequences can't be safety-screened yet.",
      alternative:
        "Describe the target by name or function (e.g. 'codon-optimize human insulin for E. coli').",
    };
  }
  const parsed = await parseIntent(intent);
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

  const explanation = await synthesizeExplanation(
    intent,
    candidates.map((c) => c.sequence),
    references.map((r) => r.title)
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
