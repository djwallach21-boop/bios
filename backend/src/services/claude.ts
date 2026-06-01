import Anthropic from "@anthropic-ai/sdk";

// Lazily instantiate so the API key is read at call time (after dotenv loads),
// not at module-import time.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to backend/.env"
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

interface ParsedIntent {
  targetFunction: string;
  organism: string;
  constraints: string[];
  similarProteins: string[];
  keywords: string[];
}

const PARSE_SYSTEM =
  "You are a bioinformatics query parser for an open scientific research tool. " +
  "You convert a researcher's natural-language design goal into structured database-search parameters " +
  "(keywords for public protein databases like GenBank and UniProt). You only output JSON parameters; " +
  "you never produce sequences. This is standard, legitimate literature- and database-search tooling.";

export async function parseIntent(userInput: string): Promise<ParsedIntent> {
  try {
    const parsed = await parseWithClaude(userInput);
    if (parsed && Array.isArray(parsed.keywords) && parsed.keywords.length) {
      return parsed;
    }
  } catch {
    // fall through to the deterministic fallback below
  }
  return heuristicParse(userInput);
}

async function parseWithClaude(
  userInput: string
): Promise<ParsedIntent | null> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: PARSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Parse this protein-design goal into database-search parameters.

Goal: "${userInput}"

Respond in JSON only, no other text:
{
  "targetFunction": "what the protein should do",
  "organism": "target organism or 'any'",
  "constraints": ["constraints like temperature, pH, etc"],
  "similarProteins": ["known proteins with similar function"],
  "keywords": ["search keywords for GenBank/UniProt"]
}`,
      },
    ],
  });

  const block = response.content[0];
  const text = block && block.type === "text" ? block.text : "";
  if (!text) return null;
  try {
    return JSON.parse(extractJson(text));
  } catch {
    return null;
  }
}

// Deterministic fallback so the pipeline never hard-fails (e.g. if the model
// declines to JSON-ify a sensitive-sounding but legitimate research request).
const STOPWORDS = new Set([
  "the", "a", "an", "for", "that", "with", "and", "of", "to", "at", "in", "on",
  "design", "engineer", "make", "create", "build", "protein", "high", "into",
  "its", "be", "is", "this", "under", "using", "use", "want", "new", "novel",
  "small", "variant", "that", "which", "from", "can",
]);

function deriveKeywords(intent: string): string[] {
  const words = intent
    .toLowerCase()
    .replace(/[^a-z0-9\- ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, 6);
}

function heuristicParse(intent: string): ParsedIntent {
  return {
    targetFunction: intent.trim(),
    organism: "any",
    constraints: [],
    similarProteins: [],
    keywords: deriveKeywords(intent),
  };
}

// Models sometimes wrap JSON in ```json fences or add prose. Pull out the
// actual JSON object before parsing.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return body.slice(start, end + 1);
  }
  return body.trim();
}

function explanationPrompt(
  intent: string,
  sequences: string[],
  references: string[]
): string {
  return `You are a biological design assistant explaining a protein design result to a researcher, like a knowledgeable colleague.

Original request: "${intent}"
Generated sequences: ${sequences.length} candidates
Reference proteins found: ${references.join(", ")}

Write 2 to 3 short, warm, plain-language paragraphs that cover: what was designed and why, how the candidates relate to the known natural proteins, and a brief honest note on confidence and what to validate experimentally.

IMPORTANT: Write flowing prose only. Do NOT use markdown headers, bullet points, bold, or any formatting symbols. No "##", no "**", no numbered lists. Just clean sentences. Keep it under 130 words total.`;
}

export async function synthesizeExplanation(
  intent: string,
  sequences: string[],
  references: string[]
): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      { role: "user", content: explanationPrompt(intent, sequences, references) },
    ],
  });

  const block = response.content[0];
  return block && block.type === "text" ? block.text : "";
}

// Token-by-token streaming version for the SSE pipeline.
export async function* streamExplanation(
  intent: string,
  sequences: string[],
  references: string[]
): AsyncGenerator<string> {
  const stream = getClient().messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      { role: "user", content: explanationPrompt(intent, sequences, references) },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// Generic prose streamer (used by non-protein modalities).
export async function* streamText(prompt: string): AsyncGenerator<string> {
  const stream = getClient().messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// ---- Intent router: classify a request into a design modality ----
export type Modality = "protein" | "dna" | "crispr";

function keywordModality(intent: string): {
  modality: Modality;
  confidence: number;
  reason: string;
} {
  const s = intent.toLowerCase();
  if (/\b(crispr|cas9|sgrna|grna|guide rna|knock\s?out|pam|base edit)\b/.test(s))
    return { modality: "crispr", confidence: 0.6, reason: "keyword match" };
  if (
    /\b(codon|back[-\s]?translate|coding sequence|optimize.*(coli|yeast|human|cho)|express.*(in|for))\b/.test(
      s
    )
  )
    return { modality: "dna", confidence: 0.6, reason: "keyword match" };
  return { modality: "protein", confidence: 0.5, reason: "default" };
}

export async function classifyIntent(intent: string): Promise<{
  modality: Modality;
  confidence: number;
  reason: string;
}> {
  try {
    const resp = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system:
        "You route a biology design request to exactly one modality. Output JSON only.",
      messages: [
        {
          role: "user",
          content: `Classify this biology design request.

Request: "${intent}"

Modalities:
- "protein": design or engineer a protein, enzyme, binder, peptide, or antibody.
- "dna": codon-optimize / back-translate a protein into a DNA coding sequence for a host organism (E. coli, yeast, human), or design a gene/ORF.
- "crispr": design CRISPR/Cas9 guide RNAs to target or knock out a gene or sequence.

Reply JSON only: {"modality":"protein|dna|crispr","confidence":0-1,"reason":"short"}`,
        },
      ],
    });
    const block = resp.content[0];
    const text = block && block.type === "text" ? block.text : "";
    if (text) {
      const parsed = JSON.parse(extractJson(text));
      if (["protein", "dna", "crispr"].includes(parsed.modality)) {
        return {
          modality: parsed.modality,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
          reason: typeof parsed.reason === "string" ? parsed.reason : "",
        };
      }
    }
  } catch {
    // fall through to deterministic keyword routing
  }
  return keywordModality(intent);
}
