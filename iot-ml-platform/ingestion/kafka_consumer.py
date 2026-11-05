"""
Kafka consumer for the IoT ML Platform.
Consumes telemetry events, enriches them with ML predictions, and stores them in the data lake.
"""

import json
import logging
import os
import time
from typing import Any

import pandas as pd

from confluent_kafka import Consumer, KafkaException, Message, KafkaError

from config.settings import settings
from storage.data_lake import data_lake
from ml.predict import predictor
from ml.kafka_producer import ml_producer
from ml import shared_state

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class KafkaIngestor:
    """
    Handles consumption of events from Kafka and orchestration of ML processing and storage.
    """
    def __init__(self):
        """
        Initializes the Kafka consumer with settings from the configuration.
        """
        self.conf = {
            'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
            'group.id': settings.KAFKA_GROUP_ID,
            'auto.offset.reset': os.getenv('KAFKA_AUTO_OFFSET_RESET', 'earliest')
        }
        try:
            self.consumer = Consumer(self.conf)
            self.topics = settings.KAFKA_CONSUME_TOPICS
        except Exception as e:
            logger.error("Failed to initialize Kafka consumer: %s", e)
            raise

    def process_event_with_ml(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """
        Processes a single event with ML, updates data, and produces results.

        Args:
            event_data (Dict[str, Any]): The enriched telemetry event data
                (from device-data-enriched, includes sparkFeatures).

        Returns:
            Dict[str, Any]: The event data with ML prediction fields attached.
        """
        try:
            prediction = predictor.predict_anomaly(event_data)

            is_anomaly = prediction["is_anomaly"]
            score      = prediction["anomaly_score"]

            # Enrich event data with ML results before storage
            event_data['anomaly_score'] = score
            event_data['is_anomaly']    = is_anomaly

            # Produce prediction back to Kafka
            ml_producer.produce_prediction(event_data, is_anomaly, score)

            # Normalise timestamp to ISO string for /anomaly-stats display
            raw_ts = event_data.get("timestamp", "")
            try:
                ts_num = float(raw_ts)
                unit = "ms" if ts_num > 1e11 else "s"
                iso_ts = pd.Timestamp(ts_num, unit=unit, tz="UTC").isoformat()
            except (TypeError, ValueError):
                iso_ts = str(raw_ts)

            # Append to shared prediction history (read by /anomaly-stats API)
            with shared_state.history_lock:
                shared_state.prediction_history.append({
                    "device_id": event_data.get("deviceId", "unknown"),
                    "timestamp": iso_ts,
                    "is_anomaly": is_anomaly,
                    "score":      score,
                    "severity":   prediction.get("severity", "NORMAL"),
                    "reason":     prediction.get("reason",   ""),
                })

            if is_anomaly:
                logger.warning(
                    "ANOMALY DETECTED for device %s: score=%.4f severity=%s",
                    event_data.get("deviceId"), score, prediction.get("severity"),
                )
                ml_producer.produce_anomaly(event_data, is_anomaly, score)
            else:
                logger.info(
                    "Normal event for device %s: score=%.4f",
                    event_data.get("deviceId"), score,
                )

            return event_data

        except Exception as e:
            logger.error("Error in ML processing: %s", e, exc_info=True)
            # Return original data if enrichment fails to avoid data loss in lake
            return event_data

    def subscribe_with_retry(self, max_retries: int = 30, retry_delay: int = 2):
        """
        Subscribe to Kafka topics with retry logic for handling topic unavailability.

        Args:
            max_retries: Maximum number of subscription attempts
            retry_delay: Delay in seconds between retry attempts
        """
        retries = 0
        while retries < max_retries:
            try:
                self.consumer.subscribe(self.topics)
                logger.info("Successfully subscribed to topics: %s", self.topics)
                return
            except Exception as e:
                retries += 1
                logger.warning("Subscription attempt %d/%d failed: %s", retries, max_retries, e)
                if retries < max_retries:
                    logger.info("Retrying in %d seconds...", retry_delay)
                    time.sleep(retry_delay)

        logger.error("Failed to subscribe to topics after %d attempts", max_retries)
        raise RuntimeError(f"Unable to subscribe to Kafka topics: {self.topics}")

    def consume_events(self):
        """
        Consumes events from Kafka, runs ML, and stores them with enriched data.
        Continuously polls Kafka for new messages with automatic recovery.
        """
        # Subscribe with retry logic
        self.subscribe_with_retry()

        topic_unavailable_count = 0

        try:
            while True:
                try:
                    msg: Message | None = self.consumer.poll(timeout=1.0)
                    if msg is None:
                        continue

                    if msg.error():
                        error_code = msg.error().code()

                        # Handle partition EOF gracefully (not a real error)
                        if error_code == KafkaError._PARTITION_EOF:
                            continue
                        # Topic not yet created — keep retrying indefinitely with backoff
                        elif error_code in [KafkaError.UNKNOWN_TOPIC_OR_PART, KafkaError.COORDINATOR_NOT_AVAILABLE]:
                            topic_unavailable_count += 1
                            if topic_unavailable_count % 10 == 1:
                                logger.warning(
                                    "Topic not available yet, waiting... (%d retries so far): %s",
                                    topic_unavailable_count, msg.error(),
                                )
                            time.sleep(2)
                            continue
                        else:
                            raise KafkaException(msg.error())

                    # Reset topic-unavailable counter on successful message
                    topic_unavailable_count = 0

                    try:
                        if msg.value() is None:
                            continue
                        raw_value = msg.value().decode('utf-8')
                        event_data = json.loads(raw_value)
                        logger.debug("Received event: %s", event_data.get('eventId', 'unknown'))

                        # 1. Run ML (Real-time scoring)
                        enriched_event = self.process_event_with_ml(event_data)

                        # 2. Store enriched event in Data Lake
                        data_lake.store_event(enriched_event)

                    except json.JSONDecodeError as e:
                        logger.error("Failed to decode message JSON: %s", e)
                    except Exception as e:
                        logger.error("Error processing message: %s", e, exc_info=True)

                except KafkaException as e:
                    logger.error("Kafka exception in consumer loop: %s", e)
                    logger.info("Attempting recovery after Kafka exception...")
                    time.sleep(5)

        except Exception as e:
            logger.critical("Fatal error in consumer loop: %s", e, exc_info=True)
            raise
        finally:
            logger.info("Closing Kafka consumer.")
            self.consumer.close()

if __name__ == "__main__":
    ingestor = KafkaIngestor()
    ingestor.consume_events()
