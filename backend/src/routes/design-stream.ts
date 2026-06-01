import { Router, Request, Response } from "express";
import {
  parseIntent,
  classifyIntent,
  streamExplanation,
  streamText,
} from "../services/claude";
import { searchProteins } from "../services/genbank";
import { generateRedesignedSequences } from "../services/denovo";
import { foldSequence } from "../services/esmfold";
import {
  computeDna,
  computeCrispr,
  dnaExplanationPrompt,
  crisprExplanationPrompt,
} from "../services/modalities";
import { saveDesign } from "../services/store";
import { screenText } from "../services/biosafety";
import type { DesignResult, ParsedIntent } from "../types";

export const designStreamRouter = Router();

const EMPTY_PARSED: ParsedIntent = {
  targetFunction: "",
  organism: "",
  constraints: [],
  similarProteins: [],
  keywords: [],
};

function safetyDecline(intent: string): DesignResult {
  return {
    intent,
    modality: "declined",
    kind: "decline",
    computed: "reference-only",
    confidence: null,
    parsed: EMPTY_PARSED,
    references: [],
    explanation:
      "This request was declined by the BiOS safety screen and nothing was designed. BiOS does not assist with weaponizing or increasing the harm of biological agents. Legitimate research (vaccines, diagnostics, binders, benign enzymes) is welcome.",
    candidates: [],
    declineReason: "Declined by the safety screen.",
    alternative:
      "Rephrase as a legitimate research goal, e.g. a diagnostic binder or a benign industrial enzyme.",
  };
}

const STAGES: Record<string, { id: string; label: string }[]> = {
  protein: [
    { id: "parse", label: "Reading intent" },
    { id: "search", label: "Searching GenBank" },
    { id: "design", label: "Designing sequences" },
    { id: "write", label: "Writing analysis" },
    { id: "fold", label: "Folding structure" },
  ],
  dna: [
    { id: "parse", label: "Reading intent" },
    { id: "search", label: "Finding protein" },
    { id: "optimize", label: "Codon-optimizing" },
    { id: "write", label: "Writing analysis" },
  ],
  crispr: [
    { id: "parse", label: "Reading intent" },
    { id: "search", label: "Fetching target" },
    { id: "scan", label: "Scanning for guides" },
    { id: "write", label: "Writing analysis" },
  ],
};

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

designStreamRouter.post("/", async (req: Request, res: Response) => {
  const { intent, parentId } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const emit = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const stage = (id: string, status: "start" | "done") =>
    emit({ type: "stage", stage: id, status });

  if (!intent || typeof intent !== "string") {
    emit({ type: "error", message: "Missing 'intent'." });
    res.end();
    return;
  }
  if (intent.length > 20000) {
    emit({ type: "error", message: "Request too long." });
    res.end();
    return;
  }

  const safety = screenText(intent);
  if (!safety.allowed) {
    emit({ type: "route", modality: "declined", confidence: 1 });
    emit({
      type: "result",
      result: safetyDecline(intent),
    });
    emit({ type: "done" });
    res.end();
    return;
  }

  try {
    const route = await classifyIntent(intent);
    const modality = route.modality;
    emit({ type: "route", modality, confidence: route.confidence });
    emit({ type: "stages", stages: STAGES[modality] ?? STAGES.protein });

    stage("parse", "start");
    const parsed = await parseIntent(intent);
    stage("parse", "done");

    let result: DesignResult;

    if (modality === "dna") {
      stage("search", "start");
      const dna = await computeDna(intent, parsed);
      stage("search", "done");
      if (!dna) {
        result = decline(
          intent,
          parsed,
          "dna",
          "I could not find a protein to codon-optimize from that request.",
          "Paste a protein sequence, or name a known protein (e.g. 'codon-optimize human insulin for E. coli')."
        );
      } else {
        stage("optimize", "start");
        stage("optimize", "done");
        stage("write", "start");
        let explanation = "";
        for await (const t of streamText(
          dnaExplanationPrompt(intent, dna.construct)
        )) {
          explanation += t;
          emit({ type: "token", text: t });
        }
        stage("write", "done");
        result = {
          intent,
          modality: "dna",
          kind: "dna",
          computed: "deterministic",
          confidence: null,
          parsed,
          references: dna.references,
          explanation,
          candidates: [],
          construct: dna.construct,
        };
      }
    } else if (modality === "crispr") {
      stage("search", "start");
      const cr = await computeCrispr(intent, parsed);
      stage("search", "done");
      if (!cr) {
        result = decline(
          intent,
          parsed,
          "crispr",
          "I could not fetch a target sequence to scan for guides.",
          "Paste a target DNA sequence, or name a gene (e.g. 'CRISPR guides to knock out human PCSK9')."
        );
      } else {
        stage("scan", "start");
        stage("scan", "done");
        stage("write", "start");
        let explanation = "";
        for await (const t of streamText(
          crisprExplanationPrompt(intent, cr.target.name, cr.guides.length)
        )) {
          explanation += t;
          emit({ type: "token", text: t });
        }
        stage("write", "done");
        result = {
          intent,
          modality: "crispr",
          kind: "crispr",
          computed: "deterministic",
          confidence: null,
          parsed,
          references: cr.references,
          explanation,
          candidates: [],
          guides: cr.guides,
          target: cr.target,
        };
      }
    } else {
      // Protein (the original pipeline)
      stage("search", "start");
      const references = await searchProteins(parsed.keywords);
      stage("search", "done");

      stage("design", "start");
      const referenceSequences = references
        .map((r) => r.sequence)
        .filter(Boolean);
      const raw = await generateRedesignedSequences(
        parsed.targetFunction,
        referenceSequences,
        foldSequence
      );
      const top = raw.slice(0, 3);
      stage("design", "done");

      stage("write", "start");
      let explanation = "";
      for await (const token of streamExplanation(
        intent,
        top.map((c) => c.sequence),
        references.map((r) => r.title)
      )) {
        explanation += token;
        emit({ type: "token", text: token });
      }
      stage("write", "done");

      stage("fold", "start");
      const fold = await foldSequence(top[0]?.sequence ?? "");
      stage("fold", "done");

      const candidates = top.map((c, i) => ({
        name: c.name,
        sequence: c.sequence,
        confidence: i === 0 && fold ? fold.meanPlddt : null,
        pdb: i === 0 && fold ? fold.pdb : null,
        origin: c.origin,
      }));

      result = {
        intent,
        modality: "protein",
        kind: "protein",
        computed: top[0]?.origin === "scaffold" ? "reference-only" : "real",
        confidence: candidates[0]?.confidence ?? null,
        parsed,
        references: references.map((r) => ({
          id: r.id,
          title: r.title,
          organism: r.organism,
          accession: r.accession,
        })),
        explanation,
        candidates,
      };
    }

    // Never persist declines (they would surface in the public gallery).
    if (result.kind !== "decline") {
      const saved = saveDesign(
        result,
        Date.now(),
        typeof parentId === "string" ? parentId : null
      );
      emit({ type: "saved", id: saved.id, title: saved.title });
    }
    emit({ type: "result", result });
    emit({ type: "done" });
    res.end();
  } catch (error) {
    // Log internally; never leak raw error text (may carry upstream URLs/keys).
    console.error("design-stream error:", error);
    emit({
      type: "error",
      message: "The design pipeline failed. Please try again.",
    });
    res.end();
  }
});
