"use client";

import { Atom, Dna, Scissors, type LucideIcon } from "lucide-react";

// Each chip leads with a modality glyph + a one-word tag, so the four chips
// double as a capability map (protein / DNA / CRISPR) read at a glance.
const CHIPS: {
  label: string;
  tag: string;
  Icon: LucideIcon;
  prompt: string;
}[] = [
  {
    label: "PET-degrading enzyme",
    tag: "protein",
    Icon: Atom,
    prompt: "Design an enzyme that breaks down PET plastic at room temperature.",
  },
  {
    label: "Thermostable GFP",
    tag: "protein",
    Icon: Atom,
    prompt: "Make a thermostable variant of green fluorescent protein.",
  },
  {
    label: "Codon-optimize insulin",
    tag: "dna",
    Icon: Dna,
    prompt: "Codon-optimize human insulin for expression in E. coli.",
  },
  {
    label: "Knock out PCSK9",
    tag: "crispr",
    Icon: Scissors,
    prompt: "Design CRISPR guide RNAs to knock out human PCSK9.",
  },
];

// Clicking fills the composer (does not send).
export function SuggestionChips({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      {CHIPS.map((c) => (
        <button
          key={c.label}
          onClick={() => onSelect(c.prompt)}
          className="press squircle flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-surface-3 hover:text-foreground"
        >
          <c.Icon className="size-3.5 opacity-70" strokeWidth={1.75} />
          <span>{c.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">
            {c.tag}
          </span>
        </button>
      ))}
    </div>
  );
}
