"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

// Every design is a permalink. Sharing it is the acquisition channel.
export function ShareRow({ designId }: { designId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/d/${designId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        onClick={copy}
        className="press inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
      >
        {copied ? (
          <>
            <Check
              className="size-3.5"
              style={{ color: "var(--color-confidence-high)" }}
            />
            Link copied
          </>
        ) : (
          <>
            <Link2 className="size-3.5" />
            Share design
          </>
        )}
      </button>
      <a
        href={`/d/${designId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        /d/{designId}
      </a>
    </div>
  );
}
