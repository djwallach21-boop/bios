# Deploying BiOS

BiOS is two services. Deploy them separately because the API holds long-lived
connections that serverless hosts truncate.

## Backend API -> Render (always-on container)

1. Push the repo to GitHub (already at github.com/djwallach21-boop/bios).
2. On render.com: New > Blueprint, point it at the repo. It reads
   `backend/render.yaml` (Docker, root `backend/`, health check `/api/health`,
   a 1GB disk at `/app/data` for the design registry).
3. Set the secret env vars (Render dashboard, never commit them):
   - `ANTHROPIC_API_KEY`
   - `NVIDIA_NIM_API_KEY`
   - `NCBI_API_KEY` (optional)
   - `BIOS_ALLOWED_ORIGINS` = the Vercel prod URL (+ any custom domain,
     comma-separated). Required, or the browser app gets CORS-blocked.
   - `BIOS_PUBLIC_URL` = this API's own URL (e.g.
     `https://bios-api.onrender.com`) so the published OpenAPI/llms.txt point
     at prod instead of localhost.
4. Deploy. Note the URL, e.g. `https://bios-api.onrender.com`. Set that URL as
   `BIOS_PUBLIC_URL`, and set `BIOS_ALLOWED_ORIGINS` once the Vercel URL exists.

Do NOT deploy the API to Vercel/Lambda: the design pipeline streams over SSE
and polls ProteinMPNN/ESMFold for minutes; serverless hosts cap and buffer
those, silently truncating folds.

## Frontend -> Vercel

1. On vercel.com: import the repo, set root directory to `frontend`.
2. Set build-time env: `NEXT_PUBLIC_API_BASE=https://bios-api.onrender.com`.
3. Deploy. Add a custom domain when ready.

## Scale path

The design + API-key store is file-backed under `backend/data/` (zero-dep, fine
for launch + the Render disk). Swap to Supabase (project already created) when
you go multi-instance: implement the same store interface against Postgres,
move PDBs to a Storage bucket, gate by `STORE_DRIVER=supabase`.
