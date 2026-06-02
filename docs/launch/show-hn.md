**TITLE:**
Show HN: BiOS – plain English to a candidate protein/DNA sequence and 3D view

**BODY:**
I built BiOS, a free web tool that turns a short description of what you want into a candidate biological design you can inspect in the browser. No install, no signup, no code.

What it does: for a protein target, it finds the closest natural scaffold, redesigns the sequence with ProteinMPNN, folds the result with ESMFold, and shows the structure colored by per-residue pLDDT so you can see where the model is and isn't confident. For DNA it does deterministic codon optimization; for CRISPR, a deterministic SpCas9 guide scan. Each result gets a permalink with a rotatable 3D structure.

Limitations I want to be upfront about: this is redesign of existing scaffolds, not de novo design. Targets over ~400aa just return the closest natural sequence, labeled as a reference. And the output is a hypothesis, not a validated molecule — pLDDT is a prediction, and anything here needs experimental validation before you rely on it.

Solo project, not open source. I'd value feedback on what's useful or wrong: {{LIVE_URL}}
