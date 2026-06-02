"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFasta, residueCount, wrapSequence } from "@/lib/fasta";

const COLLAPSED_LINES = 6;

// The sequence sits in a terminal recess one shade darker than the card, with a
// left position gutter and 60-char wrap, reading like a real sequence viewer.
export function FastaViewer({
  name,
  sequence,
  scaffold = false,
}: {
  name: string;
  sequence: string;
  scaffold?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = wrapSequence(sequence);
  const count = residueCount(sequence);
  const collapsible = lines.length > COLLAPSED_LINES;
  const shown = expanded || !collapsible ? lines : lines.slice(0, COLLAPSED_LINES);
  const gutterWidth = String(
    lines.length ? lines[lines.length - 1].position : 1
  ).length;

  async function copy() {
    await navigator.clipboard.writeText(buildFasta(name, sequence));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            FASTA
          </span>
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
            {count} aa
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="pop-in" style={{ color: "var(--color-confidence-high)" }} />
              <span className="font-mono text-[11px]">
                Copied {count} residues
              </span>
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
        <div className="relative overflow-hidden rounded-lg bg-recess p-4 font-mono text-[13px] leading-[1.6]">
          <div className="text-confidence-high/70">
            &gt;{name} | {scaffold ? "closest natural scaffold (GenBank)" : "BiOS design"}
          </div>
          {shown.map((line) => (
            <div key={line.position} className="flex gap-3 whitespace-pre">
              <span className="select-none text-muted-foreground/60 tabular-nums">
                {String(line.position).padStart(gutterWidth, " ")}
              </span>
              <span className="break-all text-foreground/90">
                {line.residues}
              </span>
            </div>
          ))}
          {collapsible && !expanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-recess to-transparent" />
          )}
        </div>
        {collapsible && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? "Collapse sequence" : `Show full sequence (${count})`}
          </button>
        )}
      </div>
    </div>
  );
}
