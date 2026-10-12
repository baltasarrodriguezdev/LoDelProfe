FROM node:22.20.0-alpine3.22 AS build
WORKDIR /app
RUN apk add --no-cache ca-certificates openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --workspaces=false --include=dev --include=optional \
    && npm run prisma:generate
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY assets ./assets
RUN npm run build \
    && npm run verify:runtime \
    && npm prune --omit=dev --workspaces=false

FROM node:22.20.0-alpine3.22 AS runtime
WORKDIR /app
RUN apk add --no-cache ca-certificates openssl \
    && chown node:node /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && exec node dist/src/server.js"]
