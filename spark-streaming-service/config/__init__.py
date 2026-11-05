import os

KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
INPUT_TOPIC: str = os.getenv("INPUT_TOPIC", "device-data-processed")
OUTPUT_TOPIC: str = os.getenv("OUTPUT_TOPIC", "device-data-enriched")
WINDOW_SIZE: int = int(os.getenv("WINDOW_SIZE", "20"))
CHECKPOINT_LOCATION: str = os.getenv("CHECKPOINT_LOCATION", "/app/spark-checkpoint")
SPARK_MASTER: str = os.getenv("SPARK_MASTER", "local[*]")
