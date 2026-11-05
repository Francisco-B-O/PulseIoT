"""
Configuration settings for the IoT ML Platform.
Uses pydantic_settings to load configuration from environment variables.
"""

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Application settings and configuration.
    """
    # Kafka Configuration
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    KAFKA_CONSUME_TOPICS: list[str] = ["device-data-enriched"]
    KAFKA_PRODUCE_ML_ANOMALIES_TOPIC: str = "ml-anomalies"
    KAFKA_PRODUCE_ML_PREDICTIONS_TOPIC: str = "ml-predictions"
    KAFKA_GROUP_ID: str = "iot-ml-platform-group"

    # Storage Configuration
    DATA_LAKE_PATH: str = os.getenv("DATA_LAKE_PATH", "data/raw")
    PROCESSED_DATA_PATH: str = os.getenv("PROCESSED_DATA_PATH", "data/processed")
    MODEL_STORAGE_PATH: str = os.getenv("MODEL_STORAGE_PATH", "ml/models")

    # ML Configuration
    ANOMALY_THRESHOLD: float = -0.05  # Lower value = more strict

    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    class Config:
        """
        Pydantic config for settings.
        """
        env_file = ".env"

settings = Settings()
