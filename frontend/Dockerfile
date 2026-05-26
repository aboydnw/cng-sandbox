# --- Builder: produces optimized static assets in /app/dist ---
FROM node:26 AS builder
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
ARG VITE_VIEWER_ORIGIN
ENV VITE_VIEWER_ORIGIN=$VITE_VIEWER_ORIGIN
RUN yarn build

# --- Dev: hot-reloading Vite dev server for local development ---
FROM node:26 AS dev
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install
COPY src/ ./src/
COPY index.html ./
COPY viewer.html ./
COPY vite.config.ts vite.shared.config.ts vite.viewer.config.ts ./
COPY tsconfig.json ./
COPY public/ ./public/
EXPOSE 5185
CMD ["npx", "vite", "--host"]

# --- Prod-export: tiny image holding only built static assets, used by the
# frontend-build compose service to copy files into the shared volume. Alpine
# is used (rather than scratch) so the compose `command` has a shell. ---
FROM alpine:3 AS prod-export
COPY --from=builder /app/dist /build
