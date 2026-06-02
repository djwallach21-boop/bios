# DELIVERABLE 1 — Show HN / r/bioinformatics launch post

**Title:** `Show HN: BiOS – Type a goal in plain English, get a designed protein + 3D structure`

**Body:**

I built a free web tool that takes a plain-English goal and gives you back a biological design with a 3D structure you can rotate. No install, no signup, no code. {{LIVE_URL}}

What it actually does, by modality:

- **Protein**: it does NOT do de novo design. It finds the closest natural scaffold to your goal, runs inverse folding on it (ProteinMPNN via NVIDIA NIM) to redesign the sequence, then folds the result with ESMFold and colors the structure by per-residue pLDDT so you can see where the model is and isn't confident. For targets over ~400 aa, ESMFold gets unreliable, so instead of pretending, it returns the closest natural sequence labeled clearly as a reference, not a redesign.
- **DNA**: deterministic codon optimization for a chosen host (E. coli / yeast / human). No model, no randomness.
- **CRISPR**: deterministic SpCas9 guide scan over a target gene, scored with a transparent sequence heuristic.

Every design gets a shareable permalink (`/d/<id>`) and a 3D viewer. The output streams as it computes, so you can see which modality it routed to and which stage it's on.

Honest about what this is and isn't:

- The output is a **hypothesis, not a validated molecule**. pLDDT is a confidence prediction, not a promise the protein folds or functions. You have to validate it at the bench.
- It's inverse-folding redesign, not de novo backbone generation. If you want RFdiffusion-class de novo or AlphaFold-class accuracy, this isn't that.
- It's not open source — the repo is private right now. I'd rather say that than imply otherwise.
- Built solo. No users yet; you'd be among the first to try it.

Who I think this is for: iGEM and synthetic-bio students, bench biologists who aren't going to stand up ColabFold or pay for a Benchling seat, and devs/agent tinkerers who want a plain-English-to-sequence API to poke at. If you do serious, funded design work, tools like Tamarind Bio are built for that and are good at it — BiOS is the free, zero-friction "I have a sentence and want a starting point in a few seconds" option.

Why I built it: going from an idea to a concrete candidate sequence + structure usually means picking tools, wrangling environments, and reading a lot of docs before you see anything. I wanted the gap between "a sentence" and "a designed sequence I can look at and share" to be one text box.

What I'd love feedback on:
1. Where does the protein path give you something obviously wrong or useless? Concrete failure cases help most.
2. Is the >400 aa "reference, not redesign" fallback the right call, or would you rather it just refuse?
3. For the bench folks: what would make a result trustworthy enough to actually order and test?

It's free to try, no account needed: {{LIVE_URL}}. I'll be in the thread.

---

# DELIVERABLE 2 — 60-second demo script (screen recording beats)

Format: `[MM:SS] ON SCREEN — what the viewer sees / SAY — what you say (or caption if silent)`. Total 60s. Type fast; trim dead air between API streaming in the edit.

```
[00:00–00:05]  ON SCREEN: Landing page, single text box, cursor blinking. Nothing else.
               SAY: "This is BiOS. One box. You describe what you want a protein to do,
                     in plain English."

[00:05–00:12]  ON SCREEN: Type into the box, slowly enough to read:
                     "a thermostable GFP variant"
                     Hit enter.
               SAY: "I'll ask for a thermostable version of GFP."

[00:12–00:22]  ON SCREEN: Response streams. Point cursor at the route line ("protein")
                     and the stage labels appearing: scaffold -> redesign -> fold.
               SAY: "It picks the modality, finds the closest natural scaffold,
                     redesigns the sequence with ProteinMPNN, and folds it with ESMFold.
                     It's not de novo — it's a redesign of a real natural protein."

[00:22–00:34]  ON SCREEN: 3D structure renders. Rotate it slowly with the mouse.
                     Hover so the per-residue coloring is obvious (blue/high vs orange/low).
               SAY: "Here's the predicted structure, colored by pLDDT —
                     confidence per residue. Blue is where the model is sure,
                     orange is where it isn't. The coloring tells you which parts to trust."

[00:34–00:42]  ON SCREEN: Point at the mean pLDDT score and the caveat text on the
                     result card ("hypothesis — validate experimentally").
               SAY: "Important: this is a hypothesis, not a validated molecule.
                     pLDDT is a prediction. You still have to test it at the bench."

[00:42–00:50]  ON SCREEN: Click the permalink (/d/<id>). URL bar shows the short link.
                     Copy it. Optionally open in a new tab to show it loads the same design.
               SAY: "Every design gets a permalink you can share or fork.
                     Send someone a sentence's worth of work as a link."

[00:50–00:57]  ON SCREEN: Quick cut — back to the box, type a different modality, e.g.
                     "codon-optimize this gene for E. coli"  (or a CRISPR guide intent).
                     Show it routes differently (DNA / CRISPR, deterministic).
               SAY: "Same box also does deterministic codon optimization and
                     SpCas9 guide design."

[00:57–01:00]  ON SCREEN: Cut to landing page with {{LIVE_URL}} on screen.
               SAY: "Free, no signup, no install. Link's in the description. Tell me where it breaks."
```

Director notes:
- The ESMFold call can take real time. Record the stream live once for the routing beat, but if the fold is slow, cut from the "fold" stage label straight to the rendered structure — don't show a spinner for 20s.
- The most persuasive 3 seconds is the rotate + pLDDT coloring at 00:22–00:34. Linger there; it's the proof the structure is real and the confidence is shown honestly.
- Say the caveat line out loud, not just on-screen. It's what earns trust with this audience.
- No music, no zooms, no captions-with-emoji. Plain screen recording reads as honest to HN / r/bioinformatics.
