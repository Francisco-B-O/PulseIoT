"""
Entry point for the Spark Streaming service.

Reads from Kafka topic `device-data-processed`, enriches each event
with rolling window statistics, and writes to `device-data-enriched`.
"""
import logging
import time

from confluent_kafka.admin import AdminClient, NewTopic

import config as settings
from streaming.processor import run_streaming

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)


def _ensure_topics(bootstrap_servers: str, topics: list[str], retries: int = 30, delay: float = 2.0) -> None:
    """Wait for Kafka to be reachable, then create topics if they don't exist."""
    admin = AdminClient({"bootstrap.servers": bootstrap_servers})

    for attempt in range(1, retries + 1):
        try:
            meta = admin.list_topics(timeout=5)
            existing = set(meta.topics.keys())
            to_create = [
                NewTopic(t, num_partitions=1, replication_factor=1)
                for t in topics if t not in existing
            ]
            if to_create:
                results = admin.create_topics(to_create)
                for topic, future in results.items():
                    try:
                        future.result()
                        logger.info("Created Kafka topic: %s", topic)
                    except Exception as exc:  # topic may already exist in a race
                        logger.warning("Could not create topic %s: %s", topic, exc)
            else:
                logger.info("Kafka topics already exist: %s", topics)
            return
        except Exception as exc:
            logger.warning("Kafka not ready (attempt %d/%d): %s", attempt, retries, exc)
            time.sleep(delay)

    raise RuntimeError(f"Kafka at {bootstrap_servers} not reachable after {retries} attempts")


if __name__ == "__main__":
    _ensure_topics(
        settings.KAFKA_BOOTSTRAP_SERVERS,
        [settings.INPUT_TOPIC, settings.OUTPUT_TOPIC],
    )
    run_streaming(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        input_topic=settings.INPUT_TOPIC,
        output_topic=settings.OUTPUT_TOPIC,
        checkpoint_location=settings.CHECKPOINT_LOCATION,
        spark_master=settings.SPARK_MASTER,
    )
