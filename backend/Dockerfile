# BiOS API. Always-on container (NOT serverless): the pipeline holds SSE
# sockets for minutes and polls NIM/ESMFold up to ~5 min, which serverless
# function hosts truncate. Deploy to Render/Railway/Fly, never Vercel/Lambda.
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
# Render/Railway inject PORT; the server reads process.env.PORT.
EXPOSE 3001
CMD ["node", "dist/index.js"]
