"use client";

const CHIPS = [
  {
    label: "PET-degrading enzyme",
    prompt: "Design an enzyme that breaks down PET plastic at room temperature.",
  },
  {
    label: "Thermostable GFP",
    prompt: "Make a thermostable variant of green fluorescent protein.",
  },
  {
    label: "Codon-optimize insulin",
    prompt: "Codon-optimize human insulin for expression in E. coli.",
  },
  {
    label: "CRISPR knock out PCSK9",
    prompt: "Design CRISPR guide RNAs to knock out human PCSK9.",
  },
];

// Rounded-full suggestion pills. Clicking fills the composer (does not send).
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
          className="press rounded-full border border-border bg-card px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
