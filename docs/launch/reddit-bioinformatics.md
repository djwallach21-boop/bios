**Title:** I built a free, no-install web tool that turns a plain-English goal into a ProteinMPNN redesign + ESMFold structure. Want honest feedback on whether the scope is useful or a toy.

**Body:**

Solo, non-PhD builder here. I made a small web tool (BiOS) and want feedback from people who actually do this work, because I know vague claims get shredded here and I'd rather be told it's useless and why.

You type a goal in plain English, it picks a modality, and you get back a sequence plus, for proteins, a 3D structure you can rotate. Free, no signup, no install, runs in the browser: https://bios-murex.vercel.app

What it actually does, precisely:

**Protein** (the main path). NOT de novo design. It pulls the closest natural scaffold from GenBank, runs ProteinMPNN (inverse folding / sequence redesign on that backbone) via NVIDIA NIM, folds the result with ESMFold, and colors the structure by per-residue pLDDT with a mean pLDDT on top. For targets over ~400 aa it doesn't redesign — it returns the closest natural sequence, explicitly labeled as a reference, not a design. So the honest one-liner is "ProteinMPNN redesign of an existing scaffold, scored by ESMFold," not "generate me a novel binder."

**DNA** is deterministic codon optimization for a host (E. coli / yeast / human). **CRISPR** is a deterministic SpCas9 guide scan with a transparent sequence-based scoring heuristic. No ML claimed on those two — plain, inspectable algorithms.

Each result gets a permalink (/d/<id>) and can be forked so you can trace where a design came from.

What I'm explicitly NOT claiming: the output is a hypothesis, not a validated molecule. pLDDT is an ESMFold confidence prediction, not a guarantee it folds, expresses, or works — every result says to validate experimentally. There's also a screen that refuses obvious harm-intent requests before any model runs.

This is not meant to replace ColabFold, the ESM suite, RFdiffusion, or a real structural pipeline. If you're comfortable standing those up, you don't need this. I built it for the "sentence to a sequence + structure in a minute, no install, no code" case — iGEM students, bench people poking at an early idea, anyone who wants to eyeball a structure before committing to heavier tooling. (Tamarind Bio already serves serious/paying labs well; I'm aiming at the free, zero-friction end.)

Feedback I actually want:

1. Is showing a single mean pLDDT (plus per-residue coloring) fair, or does it overstate confidence? Would pTM, a pLDDT min/distribution, or something else be more honest to surface?
2. For the >400 aa "return closest natural sequence as a reference" fallback — useful honest behavior, or is silently-not-redesigning more confusing than just refusing?
3. Does ProteinMPNN-on-closest-natural-scaffold give you anything you'd consider testing, or is the lack of a designed backbone (no RFdiffusion-style generation) a dealbreaker for your problems?
4. What single thing would move this from "clicked once and closed" to actually useful for you?

Happy to get into any part of the pipeline. Thanks.
