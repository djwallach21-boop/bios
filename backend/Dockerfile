# BiOS API. Always-on container (NOT serverless): the pipeline holds SSE
# sockets for minutes and polls NIM/ESMFold up to ~2 min, which serverless
# function hosts truncate. Deploy to Render/Railway/Fly, never Vercel/Lambda.

FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-fund
COPY --from=build /app/dist ./dist
RUN groupadd --system bios && useradd --system --gid bios bios \
    && mkdir -p /app/data && chown -R bios:bios /app
USER bios
EXPOSE 3001
CMD ["node", "dist/index.js"]
