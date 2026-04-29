# --- Builder: produces optimized static assets in /app/dist ---
FROM node:20 AS builder
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
ARG VITE_VIEWER_ORIGIN
ENV VITE_VIEWER_ORIGIN=$VITE_VIEWER_ORIGIN
RUN npx vite build

# --- Dev: hot-reloading Vite dev server for local development ---
FROM node:20 AS dev
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY public/ ./public/
EXPOSE 5185
CMD ["npx", "vite", "--host"]

# --- Prod: static files only, served by Caddy ---
FROM scratch AS prod
COPY --from=builder /app/dist /dist
