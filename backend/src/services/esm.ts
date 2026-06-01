import axios from "axios";
import type { ProteinOrigin } from "../types";

const BIOHUB_API_URL = "https://api.biohub.ai";

// A candidate is just a name + sequence. Real confidence and structure come
// from folding the sequence (see esmfold.ts), not from any fabricated score.
// `origin` records whether the sequence was designed or is a verbatim scaffold.
export interface RawCandidate {
  name: string;
  sequence: string;
  origin: ProteinOrigin;
}

export async function generateProteinSequences(
  targetFunction: string,
  referenceSequences: string[]
): Promise<RawCandidate[]> {
  const apiKey = process.env.BIOHUB_API_KEY;

  if (apiKey) {
    const generated = await generateWithBiohub(
      apiKey,
      targetFunction,
      referenceSequences
    );
    if (generated.length) return generated;
  }

  return generateFromReferences(targetFunction, referenceSequences);
}

async function generateWithBiohub(
  apiKey: string,
  targetFunction: string,
  referenceSequences: string[]
): Promise<RawCandidate[]> {
  try {
    const response = await axios.post(
      `${BIOHUB_API_URL}/v1/generate`,
      {
        model: "esmc",
        sequence: referenceSequences[0] || "",
        num_samples: 3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return (response.data.sequences || []).map(
      (seq: { sequence: string }, i: number) => ({
        name: designName(targetFunction, i),
        sequence: seq.sequence,
        origin: "proteinmpnn" as const,
      })
    );
  } catch {
    return [];
  }
}

function generateFromReferences(
  targetFunction: string,
  referenceSequences: string[]
): RawCandidate[] {
  // Without a generative model wired up, candidates are the closest natural
  // scaffolds. They are folded downstream for real structure + confidence.
  return referenceSequences.slice(0, 3).map((seq, i) => ({
    name: designName(targetFunction, i),
    sequence: seq,
    origin: "scaffold" as const,
  }));
}

// A short, clean design identifier derived from the intent, e.g.
// "Hydrolyze polyethylene..." -> "BiOS-Hydrolyze-01".
export function designName(targetFunction: string, i: number): string {
  const word = targetFunction.match(/[A-Za-z]{3,}/)?.[0] ?? "Design";
  const slug = word.charAt(0).toUpperCase() + word.slice(1, 12).toLowerCase();
  return `BiOS-${slug}-${String(i + 1).padStart(2, "0")}`;
}
