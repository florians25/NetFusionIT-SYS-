# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm ci --no-audit --no-fund
COPY scripts/ensure-einvoice-tools.mjs ./scripts/
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; NODE_USE_ENV_PROXY=1 node scripts/ensure-einvoice-tools.mjs /app/einvoice/Mustang-CLI-2.26.0.jar
COPY tsconfig.json ./
COPY backend ./backend
COPY ui5.yaml ./
COPY frontend ./frontend
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm run build

FROM eclipse-temurin:21-jre-jammy AS java-runtime

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production ERP_HOST=0.0.0.0 PORT=3000 JAVA_HOME=/opt/java/openjdk ERP_EINVOICE_VALIDATOR_JAR=/app/einvoice/Mustang-CLI-2.26.0.jar
ENV PATH="/opt/java/openjdk/bin:${PATH}"
COPY --from=java-runtime /opt/java/openjdk /opt/java/openjdk
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig libfreetype6 && rm -rf /var/lib/apt/lists/*
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/einvoice ./einvoice
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui5-dist ./ui5-dist
COPY backend/migrations ./backend/migrations
COPY assets ./assets
COPY scripts/migrate.mjs scripts/provision.mjs scripts/release.mjs scripts/bootstrap.mjs scripts/password.mjs ./scripts/
RUN chmod -R a+rX /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist/main.js"]
