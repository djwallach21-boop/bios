# BiOS deploy checklist (free tier)

Everything is built, tested, and private. This is the exact click-path. Order
matters (the URL/CORS dependency resolves cleanly if you follow it).

## 0. Rotate keys + set spend caps (do first, ~5 min)
The old keys are burned. Mint fresh ones and set a monthly cap where offered.
- Anthropic (console.anthropic.com) -> new key + **set a monthly spend cap**
- NVIDIA NIM (build.nvidia.com) -> new key
- NCBI (ncbi.nlm.nih.gov/account) -> new key (optional but raises rate limits)
Keep these in hand for step 1. Never paste them into the repo.

## 1. Backend -> Render (free)
1. render.com -> New -> Blueprint -> connect the (now private) `bios` repo;
   authorize Render's GitHub access when asked.
2. It auto-reads `backend/render.yaml` (Docker, rootDir `backend`, free plan,
   health check `/api/health`).
3. Set env vars (Environment tab):
   - `ANTHROPIC_API_KEY`   = rotated key
   - `NVIDIA_NIM_API_KEY`  = rotated key
   - `NCBI_API_KEY`        = rotated key
   - (leave `BIOS_ALLOWED_ORIGINS` and `BIOS_PUBLIC_URL` blank for now)
4. Deploy. **Copy the URL**, e.g. `https://bios-api.onrender.com`.
   (Free tier sleeps after ~15 min idle; first hit after idle is slow. To keep
   it warm during your test, add a free uptime pinger hitting `/api/health`.)

## 2. Frontend -> Vercel (free)
1. vercel.com -> Add New -> Project -> import the `bios` repo.
2. **Root Directory: `frontend`**.
3. Env var: `NEXT_PUBLIC_API_BASE` = the Render URL from step 1 (no trailing
   slash). This also locks the prod CSP `connect-src` to that origin.
4. Deploy. **Copy the Vercel URL**, e.g. `https://bios-xxx.vercel.app`.

## 3. Back-fill the two URLs on Render
Environment tab on the Render service:
- `BIOS_ALLOWED_ORIGINS` = your Vercel URL (else the browser is CORS-blocked)
- `BIOS_PUBLIC_URL`      = your Render URL
Save -> it redeploys.

## 4. Seed the gallery (optional, after deploy)
So `/explore` isn't empty for your first visitors (each design costs a little
Claude $; the global wallet cap bounds it):
```
BIOS_API_BASE=https://<your-render-url> bash scripts/seed-explore.sh
```

## 5. Smoke test
Open the Vercel URL, run one design (e.g. "design a small antimicrobial
peptide"), confirm: it streams, the 3D structure renders, and the `/d/<id>`
share link opens. Then DM ~10 biologists the link (see docs/launch/).

## Upgrade to always-on (when you have signal)
In `backend/render.yaml`: set `plan: starter` and uncomment the `disk:` block,
then redeploy. ~$7/mo: no cold starts, persistent registry/permalinks.
