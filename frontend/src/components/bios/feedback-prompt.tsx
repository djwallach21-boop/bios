"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { sendFeedback } from "@/lib/api";

type Rating = "yes" | "not_quite" | "no";

const OPTIONS: { r: Rating; label: string }[] = [
  { r: "yes", label: "Yes" },
  { r: "not_quite", label: "Not quite" },
  { r: "no", label: "No" },
];

// In-product feedback after a design. Asks about BEHAVIOR ("would you use this
// in real work?"), not opinion ("what do you think?"), so the signal is honest.
// The rating fires the moment it's picked; an optional note can follow.
export function FeedbackPrompt({ designId }: { designId?: string | null }) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground">
        <Check
          className="size-3.5"
          style={{ color: "var(--color-confidence-high)" }}
        />
        Thanks. This shapes what gets built next.
      </p>
    );
  }

  const pick = (r: Rating) => {
    setRating(r);
    void sendFeedback({ rating: r, designId }); // capture the rating immediately
  };

  const submitNote = () => {
    if (rating) void sendFeedback({ rating, text, designId });
    setSent(true);
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-recess p-4">
      <p className="text-[13px] text-foreground">
        Would you use this design in real work?
      </p>
      <div className="mt-2 flex gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.r}
            onClick={() => pick(o.r)}
            aria-pressed={rating === o.r}
            className={`press rounded-full border px-3 py-1 font-mono text-[12px] transition-colors ${
              rating === o.r
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {rating && (
        <div className="mt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={
              rating === "yes"
                ? "What would make it indispensable? (optional)"
                : "What's missing or wrong? (optional)"
            }
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/25 focus:outline-none"
          />
          <button
            onClick={submitNote}
            className="press mt-2 rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
