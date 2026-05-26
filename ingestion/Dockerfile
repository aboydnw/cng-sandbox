# Stage 0: Archive runtime builder (Vite library bundle)
FROM node:22-alpine AS archive-runtime-builder
RUN corepack enable
WORKDIR /build/archive-runtime
COPY frontend/archive-runtime/package.json frontend/archive-runtime/yarn.lock frontend/archive-runtime/.yarnrc.yml ./
RUN yarn install --immutable
COPY frontend/archive-runtime/src ./src
COPY frontend/archive-runtime/index.html frontend/archive-runtime/tsconfig.json frontend/archive-runtime/vite.config.ts frontend/archive-runtime/vitest.config.ts ./
RUN yarn build

# Stage 1: Builder
FROM python:3.14.5-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev \
    libmagic1 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install cng-toolkit first (changes less often)
COPY geo-conversions/ /build/cng-toolkit/
RUN pip install --no-cache-dir "/build/cng-toolkit[all]"

# Copy ingestion service source + deps, then install
COPY ingestion/ /build/ingestion/
WORKDIR /build/ingestion
RUN pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.14.5-slim-trixie

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal36 \
    gdal-bin \
    libmagic1 \
    curl \
    tippecanoe \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin/ /usr/local/bin/

WORKDIR /app
COPY ingestion/src/ /app/src/
COPY --from=archive-runtime-builder /build/archive-runtime/dist /app/runtime_assets

EXPOSE 8000

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
