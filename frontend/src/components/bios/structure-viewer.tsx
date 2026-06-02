"use client";

import { useEffect, useRef, useState } from "react";

// pLDDT confidence ramp (low -> mid -> high), the product's single earned green.
const PLDDT_COLORS = ["#E5484D", "#E5A000", "#3DD68C"];
// sRGB match for --recess oklch(0.155 0.004 265); 3Dmol's color parser rejects oklch.
const RECESS_HEX = "#0b0c0e";

// Renders an ESMFold PDB with 3Dmol.js, colored by per-residue pLDDT so a
// well-folded design literally glows green. Two modes:
//  - default (in card): opaque, matched to the recess, outline + fog, reveals
//    on load and idle-spins until the user grabs it.
//  - ambient (landing hero): transparent canvas, calm auto-rotation, no input.
export function StructureViewer({
  pdb,
  ambient = false,
}: {
  pdb: string;
  ambient?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null;
    let cancelled = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const show = () => {
      if (!cancelled) setReady(true);
    };
    // Safety net: reveal even if 3Dmol's render callback never fires, so the
    // structure can never get stuck invisible behind the fade-in.
    readyTimer = setTimeout(show, 1200);

    const pause = () => {
      try {
        viewer?.spin?.(false);
      } catch {
        /* noop */
      }
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const resume = () => {
      if (reduce) return;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        try {
          viewer?.spin?.("vy", 0.25);
        } catch {
          /* noop */
        }
      }, 1200);
    };

    (async () => {
      const mod = await import("3dmol/build/3Dmol.js");
      const $3Dmol = (mod as { default?: unknown }).default ?? mod;
      if (cancelled || !el) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lib = $3Dmol as any;
      viewer = lib.createViewer(el, {
        backgroundColor: ambient ? "#000000" : RECESS_HEX,
        antialias: true,
        cartoonQuality: 10,
      });
      const v = viewer;
      if (ambient) v.setBackgroundColor(0x000000, 0); // transparent: float on the void
      v.addModel(pdb, "pdb");
      v.setStyle(
        {},
        {
          cartoon: {
            colorscheme: {
              prop: "b",
              gradient: "linear",
              min: 0,
              max: 1,
              colors: PLDDT_COLORS,
            },
            thickness: ambient ? 0.5 : 0.6,
            arrows: true,
          },
        }
      );
      if (!ambient) {
        try {
          v.setViewStyle({ style: "outline", width: 0.03 });
          v.enableFog({ fogStart: 0.45, fogEnd: 1.0 });
        } catch {
          /* optional polish; ignore if unsupported */
        }
      }
      v.zoomTo();
      v.render(show);
      if (!ambient) v.zoom(1.15, 600);
      if (!reduce) v.spin(ambient ? "y" : "vy", ambient ? 0.3 : 0.25);
    })();

    // In-card only: pause the idle spin while the user inspects, resume after.
    if (el && !ambient) {
      el.addEventListener("pointerdown", pause);
      el.addEventListener("pointerenter", pause);
      el.addEventListener("pointerleave", resume);
    }

    return () => {
      cancelled = true;
      if (resumeTimer) clearTimeout(resumeTimer);
      if (readyTimer) clearTimeout(readyTimer);
      if (el && !ambient) {
        el.removeEventListener("pointerdown", pause);
        el.removeEventListener("pointerenter", pause);
        el.removeEventListener("pointerleave", resume);
      }
      try {
        viewer?.stopAnimate?.(); // stop the render/spin loop
        viewer?.clear?.();
      } catch {
        /* ignore teardown errors */
      }
    };
  }, [pdb, ambient]);

  const motion = ready ? "opacity-100 blur-0" : "opacity-0 blur-[6px]";
  const scale = ambient ? "" : ready ? "scale-100" : "scale-[0.98]";
  return (
    <div
      ref={ref}
      role="img"
      aria-label="Predicted 3D structure colored by per-residue pLDDT confidence"
      className={`relative h-full w-full transition-[opacity,filter,transform] duration-700 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-opacity motion-reduce:duration-200 ${motion} ${scale} ${ambient ? "" : "cursor-grab active:cursor-grabbing"}`}
    />
  );
}
