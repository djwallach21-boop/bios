import { CircleAlert } from "lucide-react";
import { DesignOutputCard } from "./design-output-card";
import { DnaCard } from "./dna-card";
import { CrisprCard } from "./crispr-card";
import type { DesignResult } from "@/lib/types";

// Renders a design result by modality. One dispatcher so the chat, the share
// page, and the registry all render any design type identically.
export function ResultView({ result }: { result: DesignResult }) {
  switch (result.kind) {
    case "dna":
      return <DnaCard result={result} />;
    case "crispr":
      return <CrisprCard result={result} />;
    case "decline":
      return (
        <div className="card-elevated squircle max-w-[52rem] overflow-hidden rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-foreground">
            <CircleAlert className="size-4 text-muted-foreground" />
            <span className="text-[15px] font-semibold">Not computable yet</span>
          </div>
          {result.declineReason && (
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {result.declineReason}
            </p>
          )}
          {result.alternative && (
            <p className="mt-2 text-[14px] leading-relaxed text-foreground">
              {result.alternative}
            </p>
          )}
          {!result.declineReason && !result.alternative && (
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              This request can&apos;t be computed yet. Try rephrasing it as a
              protein, DNA, or CRISPR design.
            </p>
          )}
        </div>
      );
    default:
      return <DesignOutputCard result={result} />;
  }
}
