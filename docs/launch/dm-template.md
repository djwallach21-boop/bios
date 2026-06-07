Subject: built a free protein-design tool, would value your honest take

Hi [their name],

I came across [your iGEM team's wiki / your post about your protein engineering project] and figured you'd have a sharper read on this than most.

I built a free web tool. You describe in plain English what you want a protein to do, and it takes the closest natural scaffold, redesigns its sequence with ProteinMPNN, and folds that with ESMFold so you get a 3D structure with per-residue pLDDT confidence scores. No install, no signup, no code.

Two honest caveats: it is not de novo design (it edits an existing scaffold, not invent one from scratch), and the output is a hypothesis you'd still need to validate at the bench. The pLDDT is a model's confidence, not proof it folds or works. For targets over ~400 residues it just returns the closest natural sequence and labels it as a reference.

I'm trying to learn where this is actually useful versus where it falls apart. If you have 2 minutes to poke at it and tell me what you really think, I'd appreciate it: https://bios-murex.vercel.app

No worries at all if you'd rather skip it.

Thanks,
[your name]
