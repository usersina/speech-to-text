# syntax=docker/dockerfile:1.4

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    ffmpeg \
    libsndfile1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Use the official uv image to copy the uv binaries into the builder
# This gives a stable uv binary without installing extra tooling via pip.
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /bin/

# Copy lockfile and project metadata first for caching
COPY pyproject.toml uv.lock README.md /app/

# Create a virtual environment that uv will populate
RUN uv venv .venv

# Install exact dependencies from uv.lock into the venv
# `uv sync --frozen` will create/populate `.venv` using the lockfile
RUN PATH=/bin:$PATH uv sync --frozen

# Copy application source after deps (avoids cache busting deps)
COPY src/ /app/src/

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a non-root user for safety
RUN groupadd -r app && useradd -r -g app app

# Copy venv + app from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/pyproject.toml /app/pyproject.toml

ENV PATH=/app/.venv/bin:$PATH

# Ensure cache dirs exist and point HF/transformers caches to a writable location
# Transformers/huggingface_hub uses HOME/XDG_CACHE_HOME by default; set them to /app/.cache
ENV HOME=/app
ENV XDG_CACHE_HOME=/app/.cache
ENV HF_HOME=/app/.cache/hf

RUN mkdir -p /app/.cache/huggingface /app/.cache/hf \
    && chown -R app:app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the server using the venv's uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src"]
