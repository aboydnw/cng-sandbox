# Stage 1: Builder
FROM python:3.13-slim AS builder

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
FROM python:3.13-slim-trixie

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

EXPOSE 8000

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
