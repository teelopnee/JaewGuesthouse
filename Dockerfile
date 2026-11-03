# Jaew Guesthouse - production image
# Data (settings, bookings, uploaded photos, daily backups) lives in /data:
# mount a persistent volume there or it is lost when the container is replaced.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Runs as root on purpose: hosting volumes (Railway, Render, Fly) are mounted root-owned,
# and a non-root user could not save data to them.
# (No VOLUME instruction: some hosts such as Railway reject it - attach the volume in the host's settings.)
RUN mkdir -p /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.js", "--prod"]
