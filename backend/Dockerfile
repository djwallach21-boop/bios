# BiOS API. Always-on container (NOT serverless): the pipeline holds SSE
# sockets for minutes and polls NIM/ESMFold up to ~5 min, which serverless
# function hosts truncate. Deploy to Render/Railway/Fly, never Vercel/Lambda.

# --- build stage: compile TS -> dist. Uses `npm install` (not strict `npm ci`)
# so the cross-platform optional binaries (esbuild/rollup, pulled in by vitest)
# resolve for the Linux builder even though the lockfile was made on macOS. ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage: production deps only (pure-JS: anthropic/axios/cors/dotenv/
# express). No test toolchain, no native binaries -> small + reliable image. ---
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
# Render/Railway inject PORT; the server reads process.env.PORT.
EXPOSE 3001
CMD ["node", "dist/index.js"]
