FROM python:3.11-slim

# Java is required by PySpark
RUN apt-get update && \
    apt-get install -y --no-install-recommends default-jre-headless procps && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only application source — avoids including test files or secrets
COPY main.py .
COPY streaming/ ./streaming/
COPY config/ ./config/

ENV PYTHONPATH=/app
ENV PYSPARK_PYTHON=python3
ENV PYSPARK_DRIVER_PYTHON=python3

# Run as non-root user
# The checkpoint dir is created here (owned by appuser) so a named volume mounted on it
# inherits that ownership on first use.
RUN useradd --create-home --shell /bin/false appuser && \
    mkdir -p /app/spark-checkpoint && \
    chown -R appuser /app

USER appuser

# Pre-download Spark Kafka connector into Ivy cache at build time
# so no network access is needed when the container starts
COPY prefetch_jars.py .
RUN python prefetch_jars.py 2>&1 || true

CMD ["python", "main.py"]
