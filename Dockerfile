FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY backend ./backend
COPY ui5.yaml ./
COPY frontend ./frontend
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production ERP_HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui5-dist ./ui5-dist
COPY backend/migrations ./backend/migrations
COPY scripts/migrate.mjs scripts/provision.mjs scripts/release.mjs scripts/bootstrap.mjs scripts/password.mjs ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/main.js"]
