// Confidence tiering. Green is earned only at the High tier; Moderate is amber,
// Low is red. These are tiers of the same bar, never decoration.

export type ConfidenceTier = "high" | "moderate" | "low";

export interface TierInfo {
  tier: ConfidenceTier;
  label: string;
  // CSS var token used for the bar fill + number color.
  colorVar: string;
  isHigh: boolean;
}

export const SYNTHESIS_THRESHOLD = 0.5;

// Tiers follow pLDDT convention (mean per-residue confidence, 0-1):
// >=0.70 confident (green), 0.50-0.70 moderate (amber), <0.50 low (red).
export function tierFor(confidence: number): TierInfo {
  if (confidence >= 0.7) {
    return {
      tier: "high",
      label: "Confident",
      colorVar: "var(--color-confidence-high)",
      isHigh: true,
    };
  }
  if (confidence >= SYNTHESIS_THRESHOLD) {
    return {
      tier: "moderate",
      label: "Moderate",
      colorVar: "var(--color-confidence-mid)",
      isHigh: false,
    };
  }
  return {
    tier: "low",
    label: "Low",
    colorVar: "var(--color-confidence-low)",
    isHigh: false,
  };
}
