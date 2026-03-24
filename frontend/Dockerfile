# --- Builder: produces optimized static assets in /app/dist ---
FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Upgrade to Vite 5 for production builds (Vite 4 has worker IIFE bugs)
RUN npm install --save-dev vite@5
COPY . .
RUN npx vite build

# --- Dev: hot-reloading Vite dev server for local development ---
FROM node:20 AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
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
