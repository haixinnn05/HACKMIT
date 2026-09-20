# Mozaic as one long-running Node server with its SQLite file on a disk.
# It cannot run on a serverless platform: it writes to that file on every action.
#
#   docker build -t mozaic .
#   docker run -p 3000:3000 -v mozaic-data:/data mozaic
#
# AI is optional. To turn it on, give the host these as secrets, never in the image:
#   LLM_API_KEY  LLM_BASE_URL  LLM_MODEL  LLM_MODEL_FAST

FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 ships a prebuilt binary; the toolchain is only a fallback if none matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# The lockfile was written by npm 11; older npm reads its optional packages differently and refuses it.
RUN npm install -g npm@11.6.2 && npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# The database lives on the mounted disk so it survives a redeploy. The registry
# snapshot and fixtures it is seeded from stay in the image under /app/data.
ENV MOZAIC_DB=/data/mozaic.db
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data
COPY deploy/entrypoint.sh /entrypoint.sh
RUN mkdir -p /data && chown -R node:node /data /app/data /app/.next
# No VOLUME line: Railway refuses images that declare one. Mount a disk at /data on the host.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/welcome').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Starts as root only long enough to own the mounted disk, then drops to the node user.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
