"use client";

import { GenbankRelatives } from "./genbank-relatives";
import type { DesignResult } from "@/lib/types";

// SpCas9 guide RNAs (deterministic in-target scan).
export function CrisprCard({ result }: { result: DesignResult }) {
  const guides = result.guides ?? [];
  const target = result.target;

  return (
    <div className="card-elevated squircle max-w-[52rem] overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="text-heading text-foreground">CRISPR guide RNAs</h3>
          {target && (
            <p className="mt-1 truncate font-mono text-[12px] text-muted-foreground">
              {target.name} · {target.lengthBp} bp scanned
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Deterministic
        </span>
      </div>

      <div className="border-t border-border" />

      <div className="px-5 py-4" role="table" aria-label="SpCas9 guide RNAs">
        <div
          role="row"
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          <span role="columnheader">Protospacer (5&apos;-&gt;3&apos;)</span>
          <span role="columnheader">PAM</span>
          <span role="columnheader">Strand</span>
          <span role="columnheader" className="text-right">Score</span>
          <span role="columnheader" className="text-right">GC</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {guides.map((g, i) => (
            <div
              key={i}
              role="row"
              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 font-mono text-[13px]"
            >
              <span role="cell" className="text-foreground">{g.sequence}</span>
              <span role="cell" className="text-muted-foreground">{g.pam}</span>
              <span role="cell" className="text-muted-foreground">{g.strand}</span>
              <span role="cell" className="flex items-center justify-end">
                <span
                  className="h-1 w-12 overflow-hidden rounded-full bg-border"
                  role="img"
                  aria-label={`Score ${Math.round(g.score * 100)} percent`}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round(g.score * 100)}%`,
                      backgroundColor:
                        g.score >= 0.7
                          ? "var(--color-confidence-high)"
                          : g.score >= 0.4
                            ? "var(--color-confidence-mid)"
                            : "var(--color-confidence-low)",
                    }}
                  />
                </span>
              </span>
              <span
                role="cell"
                className="w-9 text-right tabular-nums text-muted-foreground"
              >
                {Math.round(g.gc * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {result.references.length > 0 && (
        <>
          <div className="border-t border-border" />
          <GenbankRelatives references={result.references} />
        </>
      )}

      <div className="border-t border-border" />
      <div className="px-5 py-3">
        <span className="font-mono text-[12px] text-muted-foreground/70">
          In-target scan · GC + homopolymer heuristic · validate off-targets with
          Cas-OFFinder
        </span>
      </div>
    </div>
  );
}
