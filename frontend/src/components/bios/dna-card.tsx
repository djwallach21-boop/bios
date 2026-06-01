"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenbankRelatives } from "./genbank-relatives";
import { downloadFasta } from "@/lib/fasta";
import type { DesignResult } from "@/lib/types";

// Codon-optimized DNA coding sequence (deterministic).
export function DnaCard({ result }: { result: DesignResult }) {
  const c = result.construct;
  const [copied, setCopied] = useState(false);
  if (!c) return null;

  const lines: string[] = [];
  for (let i = 0; i < c.dna.length; i += 60) lines.push(c.dna.slice(i, i + 60));

  async function copy() {
    await navigator.clipboard.writeText(c!.dna);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="card-elevated squircle max-w-[52rem] overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="text-heading text-foreground">Codon-optimized gene</h3>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">
            {c.proteinName} · for {c.host}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Deterministic
        </span>
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-wrap gap-6 px-5 py-3 font-mono text-[12px]">
        <span className="text-muted-foreground">
          Length <span className="text-foreground tabular-nums">{c.lengthBp} bp</span>
        </span>
        <span className="text-muted-foreground">
          GC <span className="text-foreground tabular-nums">{Math.round(c.gc * 100)}%</span>
        </span>
        <span className="text-muted-foreground">
          Protein <span className="text-foreground tabular-nums">{c.protein.length} aa</span>
        </span>
      </div>

      <div className="border-t border-border" />

      <div className="flex items-center justify-between px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Coding sequence (DNA)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check style={{ color: "var(--color-confidence-high)" }} />
              <span className="font-mono text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Copy />
              <span className="font-mono text-[11px]">Copy</span>
            </>
          )}
        </Button>
      </div>
      <div className="px-5 pb-5">
        <div className="max-h-64 overflow-y-auto rounded-lg bg-recess p-4 font-mono text-[13px] leading-[1.6] text-foreground/90">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-3 whitespace-pre">
              <span className="select-none text-muted-foreground/60 tabular-nums">
                {String(i * 60 + 1).padStart(String(c.lengthBp).length, " ")}
              </span>
              <span className="break-all">{l}</span>
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
      <div className="flex items-center justify-between px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadFasta("BiOS-codon-optimized", c.dna)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Download />
          <span className="font-mono text-[11px]">.fasta</span>
        </Button>
        <span className="font-mono text-[12px] text-muted-foreground/70">
          max-frequency codons
        </span>
      </div>
    </div>
  );
}
