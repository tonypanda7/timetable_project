# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps (minimal). Manylinux wheels should cover numpy/pandas, but keep build tools for safety
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       curl \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (leverage layer cache)
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# Copy application source
COPY . .

# Create runtime directories
RUN mkdir -p uploads \
    && chmod -R 775 uploads

ENV FLASK_ENV=production
EXPOSE 8000

# Start with gunicorn (2 workers, 1 thread each)
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8000", "app:app"]
