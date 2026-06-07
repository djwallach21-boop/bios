import axios from "axios";
import { designName, type RawCandidate } from "./esm";

// Real de novo sequence design via NVIDIA NIM's hosted ProteinMPNN (Institute
// for Protein Design). Note: Replicate does NOT host real protein-design
// models (verified), so this uses NVIDIA NIM's free-tier REST API. Falls back
// to the closest natural scaffolds when no key is configured, so the pipeline
// never breaks and never spends without a key.
const NIM_BASE = "https://health.api.nvidia.com/v1/biology/ipd";

// Cost / safety guardrails.
const MAX_DESIGN_RESIDUES = 400; // matches the ESMFold cap; longer -> fallback
const NUM_SEQ_PER_TARGET = 8;
const MAX_DESIGNS_RETURNED = 3;

interface MpnnDesign {
  sequence: string;
  score: number;
}

type FoldScaffold = (seq: string) => Promise<{ pdb: string } | null>;

export function deNovoEnabled(): boolean {
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

// MODE 1 (ship-first): redesign the closest natural backbone into novel
// sequences. One ProteinMPNN call per request. Drop-in for the routes.
export async function generateRedesignedSequences(
  targetFunction: string,
  referenceSequences: string[],
  foldScaffold: FoldScaffold,
  isCancelled?: () => boolean
): Promise<RawCandidate[]> {
  const ref = referenceSequences[0];
  if (!ref || ref.replace(/\s+/g, "").length > MAX_DESIGN_RESIDUES) {
    return fallback(targetFunction, referenceSequences);
  }
  if (!process.env.NVIDIA_NIM_API_KEY) {
    return fallback(targetFunction, referenceSequences);
  }

  try {
    const folded = await foldScaffold(ref);
    if (!folded?.pdb) return fallback(targetFunction, referenceSequences);

    const designs = await proteinMPNN(folded.pdb, isCancelled);
    if (designs.length === 0) return fallback(targetFunction, referenceSequences);

    return designs
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_DESIGNS_RETURNED)
      .map((d, i) => ({
        name: designName(targetFunction, i),
        sequence: d.sequence,
        origin: "proteinmpnn" as const,
      }));
  } catch (e) {
    console.error(
      "ProteinMPNN redesign failed, using natural scaffolds:",
      e instanceof Error ? e.message : e
    );
    return fallback(targetFunction, referenceSequences);
  }
}

// Raw ProteinMPNN call against NVIDIA NIM. Handles inline (200) and async (202).
async function proteinMPNN(pdb: string, isCancelled?: () => boolean): Promise<MpnnDesign[]> {
  const res = await axios.post(
    `${NIM_BASE}/proteinmpnn/predict`,
    {
      input_pdb: pdb,
      num_seq_per_target: NUM_SEQ_PER_TARGET,
      sampling_temp: [0.2],
      use_soluble_model: true,
      ca_only: false,
      random_seed: 42,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30_000,
      validateStatus: (s) => s === 200 || s === 202,
    }
  );

  const data =
    res.status === 202 ? await pollNim(res.headers["nvcf-reqid"], isCancelled) : res.data;
  return parseMfasta(data.mfasta as string);
}

async function pollNim(
  reqId: string,
  isCancelled?: () => boolean
): Promise<{ mfasta: string; scores: number[] }> {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(reqId)) throw new Error("Invalid NIM request ID");
  const url = `https://health.api.nvidia.com/v1/status/${reqId}`;
  const deadline = Date.now() + 120_000;
  for (let i = 0; i < 150; i++) {
    if (isCancelled?.()) throw new Error("Client disconnected during NIM poll");
    if (Date.now() > deadline) throw new Error("NIM poll deadline exceeded (120s)");
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}` },
      validateStatus: (s) => s === 200 || s === 202,
      timeout: 10000,
    });
    if (r.status === 200) return r.data;
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error("NIM ProteinMPNN poll timeout");
}

// The first FASTA record is the native/input sequence; drop it, keep designs.
// Each header carries an inline "score=" (lower = better) and "seq_recovery=".
function parseMfasta(mfasta: string): MpnnDesign[] {
  if (!mfasta) return [];
  const records = mfasta.split(/^>/m).filter((r) => r.trim());
  return records
    .map((r, idx) => {
      const lines = r.trim().split("\n");
      const header = lines[0] || "";
      const seq = lines.slice(1).join("").replace(/[^A-Za-z]/g, "").toUpperCase();
      const m = header.match(/score=([0-9.]+)/);
      const isNative = idx === 0 || /^input\b/.test(header);
      return { sequence: seq, score: m ? parseFloat(m[1]) : 0, isNative };
    })
    .filter((d) => !d.isNative && d.sequence.length >= 10)
    .map(({ sequence, score }) => ({ sequence, score }));
}

// Fallback: the closest natural scaffolds (today's behavior). Never throws.
function fallback(targetFunction: string, refs: string[]): RawCandidate[] {
  return refs
    .slice(0, MAX_DESIGNS_RETURNED)
    .map((seq, i) => ({
      name: designName(targetFunction, i),
      sequence: seq,
      origin: "scaffold" as const,
    }));
}
