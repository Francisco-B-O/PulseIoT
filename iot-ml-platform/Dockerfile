FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    librdkafka-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set PYTHONPATH to include the current directory
ENV PYTHONPATH=/app

EXPOSE 8000

# FastAPI starts the Kafka consumer as a background thread internally
CMD ["python", "api/app.py"]
