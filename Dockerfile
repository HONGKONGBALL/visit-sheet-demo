# VisitSheet demo deploy image — product snapshot pinned in COMMIT.txt
# Do not edit product code here; rebuild from HONGKONGBALL/visit-sheet @ that commit.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev

COPY app/ ./

# Seed fictional demo data at build time; also re-seed on start if DB missing
RUN mkdir -p data && npm run seed

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Re-seed if volume wiped; then start
CMD ["sh", "-c", "test -f \"${DB_PATH:-data/visitsheet.db}\" || npm run seed; exec npm start"]
