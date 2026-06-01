"use client";

import { useEffect, useState } from "react";
import { tierFor } from "@/lib/confidence";

// CONFIDENCE block: the one place a second hue is allowed, and the one moment
// of delight. The bar springs from 0 to its value once on mount with a brief
// glow that blooms and fades, so "green = earned" feels physically earned.
export function ConfidenceBlock({ confidence }: { confidence: number }) {
  const t = tierFor(confidence);
  const [width, setWidth] = useState(0);
  const [glow, setGlow] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const prefersReduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduce) {
      // No spring, no bloom: jump straight to the final value.
      setReduce(true);
      setWidth(confidence * 100);
      return;
    }
    const id = requestAnimationFrame(() => {
      setWidth(confidence * 100);
      setGlow(true);
    });
    const fade = setTimeout(() => setGlow(false), 650);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(fade);
    };
  }, [confidence]);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Mean pLDDT
      </span>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[22px] leading-none tabular-nums [font-feature-settings:'zero']"
          style={{ color: t.colorVar }}
        >
          {Math.round(confidence * 100)}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {t.isHigh && (
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: t.colorVar }}
            />
          )}
          {t.label}
        </span>
      </div>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full motion-reduce:transition-none"
          style={{
            width: `${width}%`,
            backgroundColor: t.colorVar,
            transition: reduce
              ? "none"
              : "width 600ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 400ms ease-out",
            boxShadow: glow
              ? `0 0 18px color-mix(in oklch, ${t.colorVar} 45%, transparent)`
              : "0 0 0 transparent",
          }}
        />
      </div>
    </div>
  );
}
