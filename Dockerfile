# ─────────────────────────────────────────────────────────────────────────────
# Euro Trade proxy — runs BOTH the TradingView scraper (server.js) and the
# OTC Pocket Option scraper (po-scraper.js) via start.js.
#
# Puppeteer needs a real Chromium + its system libraries, which Render's plain
# Node runtime does not provide — so we ship a Docker image here.
#
# Render setup:
#   • Service type: Web Service
#   • Environment:  Docker  (Render auto-detects this Dockerfile)
#   • Env vars:     PO_EMAIL, PO_PASSWORD, PO_CHART_URL,
#                   SUPABASE_URL, SUPABASE_SERVICE_KEY
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim

# Shared libraries needed by @sparticuz/chromium's bundled Chromium. The binary
# itself ships inside the npm package (brotli-compressed, extracted to /tmp at
# runtime) — we do NOT download full Chrome, which keeps the image + RAM small.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 \
    libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 \
    libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching). puppeteer-core does NOT download a
# browser; @sparticuz/chromium fetches its compressed binary into node_modules.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "start.js"]
