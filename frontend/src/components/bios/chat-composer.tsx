"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ArrowUp, Plus, Square } from "lucide-react";

export interface ComposerHandle {
  focus: () => void;
}

// The composer pill. Left attach affordance, prompt in the middle, engine chip
// + a send/stop button that morphs while a design is running.
export const ChatComposer = forwardRef<
  ComposerHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    onStop?: () => void;
    running: boolean;
    autoFocus?: boolean;
  }
>(function ChatComposer(
  { value, onChange, onSubmit, onStop, running, autoFocus },
  handleRef
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(handleRef, () => ({ focus: () => ref.current?.focus() }));

  // Auto-resize to content, capped.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const submit = e.key === "Enter" && !e.shiftKey;
    const altSubmit = e.key === "Enter" && (e.metaKey || e.ctrlKey);
    if (submit || altSubmit) {
      e.preventDefault();
      if (!running && value.trim()) onSubmit();
    }
  }

  const canSend = !running && value.trim().length > 0;

  return (
    <div className="glass squircle flex items-end gap-2 rounded-[1.75rem] px-2.5 py-2.5 transition-[background-color] duration-200 focus-within:bg-[oklch(0.2_0.004_265_/_0.78)]">
      <button
        type="button"
        disabled
        title="Attach a sequence (soon)"
        aria-label="Attach a sequence"
        className="flex size-9 shrink-0 items-center justify-center self-end rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 disabled:opacity-40"
      >
        <Plus className="size-5" />
      </button>

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Describe a protein to design..."
        className="max-h-[200px] flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />

      <div className="flex shrink-0 items-center gap-2 self-end">
        <span className="hidden items-center rounded-full bg-foreground/[0.06] px-3 py-1.5 font-mono text-[12px] text-muted-foreground sm:inline-flex">
          auto
        </span>
        {running ? (
          <button
            onClick={() => onStop?.()}
            aria-label="Stop"
            className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => canSend && onSubmit()}
            disabled={!canSend}
            aria-label="Send"
            className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
});
