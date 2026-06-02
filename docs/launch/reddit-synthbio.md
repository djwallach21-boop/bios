**Title:** I built a free, no-install web tool that turns a plain-English goal into a protein/DNA design + 3D structure you can rotate. Feedback wanted from iGEM teams and bench folks.

**Body:**

Hey r/syntheticbiology,

I'm a student. I kept watching people bounce off the heavier design tools (standing up ColabFold, paying for Benchling) just to try a quick idea, so I built a small web tool and I'd like honest feedback from people who actually work at the bench.

What it does: you type a goal in plain English and get back a sequence and a 3D structure you can rotate in the browser. No install, no signup, no code, free.

The three things it handles right now:

- **Protein:** it takes the closest natural scaffold and redesigns it with ProteinMPNN, then folds the result with ESMFold. The structure is colored by per-residue pLDDT so you can see which regions the model is (and isn't) confident about. For targets over ~400 aa it stops trying to redesign and just returns the closest natural sequence, clearly labeled as a reference, not a design.
- **DNA:** deterministic codon optimization for a target organism.
- **CRISPR:** deterministic SpCas9 guide scan.

Every design gets a shareable permalink (`/d/<id>`). That's the part I'm most curious whether teams would use: paste a link in your Slack/wiki/notebook and a teammate or PI sees the exact same sequence + structure with nothing to install. Maybe useful for teaching or for documenting "here's what we tried."

Limits, up front, because they matter:

- The output is a **hypothesis, not a validated molecule.** You still have to test it at the bench.
- **pLDDT is a confidence prediction, not a guarantee.** High pLDDT doesn't mean the protein folds that way or does what you want.
- It is **not de novo design.** Proteins are redesigns of existing scaffolds, not novel folds from scratch.
- DNA and CRISPR are **rule-based, not ML.** They do exactly what they say, nothing cleverer.

So it's a fast way to get from "I want a protein that does X" to a concrete sequence + structure you can reason about and then go validate. It's not a replacement for serious/paid tooling if you're doing production work, more of a zero-friction starting point if you don't want to set up an environment just to sketch an idea.

If you run an iGEM team: try it on something you're actually working on and tell me where it falls short. Same for anyone at the bench with five spare minutes. What's confusing? What's missing? What would make it actually useful in your workflow instead of just a demo?

Link: {{LIVE_URL}}

Built solo, so any feedback (including "this is useless because X") is welcome. Thanks.
