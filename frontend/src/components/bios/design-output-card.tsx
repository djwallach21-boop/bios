"use client";

import { useState } from "react";
import { Box, Download, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBlock } from "./confidence-block";
import { FastaViewer } from "./fasta-viewer";
import { GenbankRelatives } from "./genbank-relatives";
import { StructureViewer } from "./structure-viewer";
import { downloadFasta } from "@/lib/fasta";
import { SYNTHESIS_THRESHOLD } from "@/lib/confidence";
import { foldSequence } from "@/lib/api";
import type { DesignResult } from "@/lib/types";

const Hairline = () => <div className="border-t border-border" />;

function functionSentence(result: DesignResult): string {
  const fn = result.parsed.targetFunction?.trim();
  const base = fn
    ? fn.charAt(0).toUpperCase() + fn.slice(1)
    : "Predicted function unavailable";
  const constraints = result.parsed.constraints?.filter(Boolean) ?? [];
  const suffix = constraints.length
    ? ` Targeted for ${constraints.join(", ")}.`
    : "";
  return `${base.replace(/\.$/, "")}.${suffix}`;
}

interface FoldData {
  pdb: string;
  confidence: number;
}

// The hero artifact, driven strictly by DesignResult. Structure + confidence are
// real (ESMFold pLDDT); non-default candidates fold on demand.
export function DesignOutputCard({ result }: { result: DesignResult }) {
  const candidates = result.candidates;
  const [active, setActive] = useState(0);
  const [folds, setFolds] = useState<Record<number, FoldData>>({});
  const [foldingIdx, setFoldingIdx] = useState<number | null>(null);
  const [foldError, setFoldError] = useState<string | null>(null);

  const candidate = candidates[active];

  if (!candidate) {
    return (
      <div className="card-elevated squircle max-w-[52rem] overflow-hidden rounded-2xl border border-border bg-card p-5 text-[13px] text-muted-foreground">
        No candidate sequences were generated for this request.
      </div>
    );
  }

  const override = folds[active];
  const pdb = candidate.pdb ?? override?.pdb ?? null;
  const confidence = candidate.confidence ?? override?.confidence ?? null;
  const aa = candidate.sequence.replace(/\s+/g, "").length;
  // No redesign ran: this candidate is a verbatim natural sequence, not a
  // computed design. Label it honestly instead of as a predicted function.
  const isScaffold = candidate.origin === "scaffold";
  const belowThreshold =
    confidence === null || confidence < SYNTHESIS_THRESHOLD;

  async function predict() {
    setFoldingIdx(active);
    setFoldError(null);
    try {
      const r = await foldSequence(candidate.sequence);
      setFolds((prev) => ({
        ...prev,
        [active]: { pdb: r.pdb, confidence: r.confidence },
      }));
    } catch (e) {
      setFoldError(e instanceof Error ? e.message : "Could not fold sequence");
    } finally {
      setFoldingIdx(null);
    }
  }

  return (
    <div className="card-elevated squircle max-w-[52rem] overflow-hidden rounded-2xl border border-border bg-card">
      {candidates.length > 1 && (
        <>
          <div className="flex gap-1 px-3 py-2">
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                aria-label={`Candidate ${i + 1}`}
                className={`press rounded-md px-2.5 py-1 font-mono text-[12px] transition-colors ${
                  i === active
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                C{i + 1}
              </button>
            ))}
          </div>
          <Hairline />
        </>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="text-heading text-foreground">{candidate.name}</h3>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground tabular-nums">
            Candidate {active + 1} of {candidates.length} · {aa} aa
          </p>
        </div>
        {confidence !== null ? (
          <ConfidenceBlock confidence={confidence} />
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Mean pLDDT
            </span>
            <span className="font-mono text-[14px] text-muted-foreground/60">
              fold to score
            </span>
          </div>
        )}
      </div>

      <Hairline />

      {/* Function (predicted for a design; described for a natural scaffold) */}
      <div className="px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {isScaffold ? "Natural reference" : "Predicted function"}
        </span>
        <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
          {functionSentence(result)}
        </p>
        {isScaffold && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            No redesign ran (ProteinMPNN not configured). This is the closest
            natural sequence from GenBank, shown as a reference.
          </p>
        )}
      </div>

      <Hairline />
      <FastaViewer
        name={candidate.name}
        sequence={candidate.sequence}
        scaffold={isScaffold}
      />

      <Hairline />

      {/* Predicted structure (real ESMFold) */}
      <div className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Predicted structure
          </span>
          {pdb && (
            <span className="font-mono text-[11px] text-muted-foreground">
              ESMFold · colored by pLDDT
            </span>
          )}
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border bg-recess">
          {pdb ? (
            <StructureViewer key={pdb.slice(0, 48)} pdb={pdb} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Box className="size-6 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[13px] text-foreground">
                Predict the 3D structure
              </span>
              {foldError && (
                <span className="max-w-xs text-[12px] text-destructive">
                  {foldError}
                </span>
              )}
              <button
                onClick={predict}
                disabled={foldingIdx === active}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {foldingIdx === active ? (
                  <>
                    <Loader className="size-3.5 animate-spin motion-reduce:animate-none" />
                    Folding...
                  </>
                ) : (
                  "Predict structure"
                )}
              </button>
              <span className="font-mono text-[11px] text-muted-foreground/70">
                ESMFold · free · about 15s
              </span>
            </div>
          )}
        </div>
      </div>

      <Hairline />
      <GenbankRelatives references={result.references} />

      <Hairline />

      {/* Footer action bar */}
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadFasta(candidate.name, candidate.sequence)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Download />
          <span className="font-mono text-[11px]">.fasta</span>
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[12px] text-muted-foreground/70 sm:inline">
            esmfold · {candidates.length} candidate
            {candidates.length === 1 ? "" : "s"}
          </span>
          <button
            disabled
            title={
              belowThreshold
                ? "Confidence below synthesis threshold (0.50)"
                : "Lab synthesis ships soon"
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground opacity-50"
          >
            Send to synthesis
            <span className="rounded bg-background/30 px-1 font-mono text-[10px] uppercase">
              soon
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
