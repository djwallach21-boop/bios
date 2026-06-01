"use client";

import { PanelLeft, Plus, Trash2 } from "lucide-react";
import { BiosMark } from "./bios-mark";
import type { Thread } from "@/lib/threads";

// History sidebar: your designs persist and you come back to them.
export function Sidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onCollapse,
}: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
}) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-foreground">
          <BiosMark className="size-4" />
          BiOS
        </span>
        <button
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground transition-colors hover:border-foreground/25"
        >
          <Plus className="size-4" />
          New design
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {threads.length > 0 && (
          <p className="px-2 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
            Recent
          </p>
        )}
        <ul className="space-y-0.5">
          {threads.map((t) => (
            <li key={t.id} className="group/row relative">
              <button
                onClick={() => onSelect(t.id)}
                className={`flex w-full items-center rounded-md px-2 py-1.5 pr-7 text-left text-[13px] transition-colors ${
                  t.id === activeId
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <span className="truncate">{t.title}</span>
              </button>
              <button
                onClick={() => onDelete(t.id)}
                aria-label="Delete design"
                className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5">
        <a
          href="/explore"
          className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Explore designs
        </a>
        <a
          href="/developers"
          className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          API &amp; developers
        </a>
        <a
          href="https://github.com/djwallach21-boop/bios"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Open source on GitHub
        </a>
      </div>
    </aside>
  );
}
