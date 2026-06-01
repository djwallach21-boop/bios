import axios from "axios";

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const API_KEY = process.env.NCBI_API_KEY || "";

interface GenBankResult {
  id: string;
  title: string;
  organism: string;
  sequence: string;
  accession: string;
}

export async function searchProteins(
  keywords: string[]
): Promise<GenBankResult[]> {
  const query = keywords.join(" OR ");

  const searchUrl = `${BASE_URL}/esearch.fcgi?db=protein&term=${encodeURIComponent(query)}&retmax=10&retmode=json${API_KEY ? `&api_key=${API_KEY}` : ""}`;

  const searchResponse = await axios.get(searchUrl, { timeout: 15000 });
  const ids = searchResponse.data.esearchresult?.idlist || [];

  if (ids.length === 0) return [];

  const fetchUrl = `${BASE_URL}/efetch.fcgi?db=protein&id=${ids.join(",")}&rettype=fasta&retmode=text${API_KEY ? `&api_key=${API_KEY}` : ""}`;

  const fetchResponse = await axios.get(fetchUrl, { timeout: 15000 });
  const fastaText: string = fetchResponse.data;

  return parseFasta(fastaText, ids);
}

// Fetch a curated gene/mRNA sequence for CRISPR targeting. Prefers RefSeq mRNA
// (avoids patent junk), falls back to a plain search. Caps length for speed.
export async function searchNucleotide(
  term: string,
  maxLen = 6000
): Promise<GenBankResult | null> {
  const refseqTerm = `(${term}) AND biomol_mrna[PROP] AND refseq[filter]`;
  let ids = await esearchNuccore(refseqTerm);
  if (ids.length === 0) ids = await esearchNuccore(term);
  if (ids.length === 0) return null;

  const fetchUrl = `${BASE_URL}/efetch.fcgi?db=nuccore&id=${ids[0]}&rettype=fasta&retmode=text${API_KEY ? `&api_key=${API_KEY}` : ""}`;
  const fetchResponse = await axios.get(fetchUrl, { timeout: 15000 });
  const parsed = parseFasta(fetchResponse.data as string, ids);
  if (!parsed.length) return null;
  return { ...parsed[0], sequence: parsed[0].sequence.slice(0, maxLen) };
}

async function esearchNuccore(term: string): Promise<string[]> {
  const url = `${BASE_URL}/esearch.fcgi?db=nuccore&term=${encodeURIComponent(term)}&retmax=1&sort=relevance&retmode=json${API_KEY ? `&api_key=${API_KEY}` : ""}`;
  try {
    const res = await axios.get(url, { timeout: 15000 });
    return res.data.esearchresult?.idlist || [];
  } catch {
    return [];
  }
}

function parseFasta(fastaText: string, ids: string[]): GenBankResult[] {
  const entries = fastaText.split(">").filter((e) => e.trim());

  return entries.map((entry, i) => {
    const lines = entry.trim().split("\n");
    const header = lines[0] || "";
    const sequence = lines.slice(1).join("").trim();

    const titleMatch = header.match(/^(\S+)\s+(.*?)(?:\[(.+?)\])?$/);

    return {
      id: ids[i] || "",
      accession: titleMatch?.[1] || "",
      title: titleMatch?.[2]?.trim() || header,
      organism: titleMatch?.[3] || "Unknown",
      sequence,
    };
  });
}
