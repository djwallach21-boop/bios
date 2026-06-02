"use client";

import { Check, Loader } from "lucide-react";
import type { StreamStage } from "@/lib/types";

// Real pipeline progress, driven by SSE stage events (modality-specific,
// delivered on the wire -- not a fixed list or a fake timer).
export function StageList({ stages }: { stages: StreamStage[] }) {
  if (!stages.length) {
    return (
      <div className="flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
        <Loader className="size-3 animate-spin motion-reduce:animate-none" />
        Routing...
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {stages.map((s) => (
        <li key={s.id} className="flex items-center gap-2.5 font-mono text-[12px]">
          <span className="flex size-4 items-center justify-center rounded-sm border border-border">
            {s.status === "done" ? (
              <Check
                className="size-3 pop-in"
                style={{ color: "var(--color-confidence-high)" }}
              />
            ) : s.status === "active" ? (
              <Loader className="size-3 animate-spin text-foreground motion-reduce:animate-none" />
            ) : (
              <span className="size-1.5 rounded-full bg-border" />
            )}
          </span>
          <span
            className={
              s.status === "pending" ? "text-muted-foreground/50" : "text-foreground"
            }
          >
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
