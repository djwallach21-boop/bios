import { ArrowUpRight } from "lucide-react";
import type { ProteinReference } from "@/lib/types";

// Closest natural relatives from GenBank. We render ONLY what the API returns:
// accession, organism, title. No fabricated % identity or e-values.
export function GenbankRelatives({
  references,
}: {
  references?: ProteinReference[];
}) {
  // A persisted or older result may lack `references` entirely; never let a
  // missing field crash the whole share/transcript page.
  const refs = references ?? [];
  return (
    <div className="px-5 py-5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Closest GenBank relatives
      </span>
      {refs.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          No close natural relatives found for this design.
        </p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {refs.map((ref) => (
            <li key={ref.id || ref.accession}>
              <a
                href={`https://www.ncbi.nlm.nih.gov/protein/${ref.accession}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group -mx-2 flex items-baseline justify-between gap-4 rounded px-2 py-1.5 transition-colors hover:bg-foreground/5"
              >
                <span className="min-w-0">
                  <span className="inline-flex items-center gap-1 font-mono text-[13px] text-foreground">
                    {ref.accession || "unknown"}
                    <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="block text-[13px] italic text-muted-foreground">
                    {ref.organism}
                  </span>
                </span>
                <span className="max-w-[55%] truncate text-[12px] text-muted-foreground">
                  {ref.title}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
