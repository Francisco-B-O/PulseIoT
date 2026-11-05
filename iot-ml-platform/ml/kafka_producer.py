"""
Kafka producer for the IoT ML Platform.
Sends anomaly alerts and predictions back to Kafka topics.
"""

import json
import logging
from typing import Any

from confluent_kafka import Producer, KafkaError, Message

from config.settings import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class KafkaProducer:
    """
    Handles producing ML results (anomalies and predictions) to Kafka.
    """
    def __init__(self):
        """
        Initializes the Kafka producer with settings from the configuration.
        """
        self.conf = {
            'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS
        }
        try:
            self.producer = Producer(self.conf)
        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}")
            raise

    def delivery_report(self, err: KafkaError | None, msg: Message):
        """
        Callback called once for each message delivered to indicate delivery result.

        Args:
            err (Optional[KafkaError]): Delivery error, if any.
            msg (Message): The delivered message.
        """
        if err is not None:
            logger.error(f"Message delivery failed for topic {msg.topic()}: {err}")
        else:
            logger.debug(f"Message delivered to {msg.topic()} [{msg.partition()}]")

    def produce_anomaly(self, event_data: dict[str, Any], is_anomaly: bool, score: float):
        """
        Produces an anomaly event to Kafka if detected.

        Args:
            event_data (Dict[str, Any]): The telemetry event data.
            is_anomaly (bool): Whether an anomaly was detected.
            score (float): The anomaly score.
        """
        if not is_anomaly:
            return

        try:
            anomaly_event = {
                "deviceId": event_data.get("deviceId"),
                "originalEventId": event_data.get("eventId"),
                "timestamp": event_data.get("timestamp"),
                "anomalyScore": score,
                "type": "ML_ANOMALY_DETECTED",
                "source": "iot-ml-platform"
            }

            self.producer.produce(
                settings.KAFKA_PRODUCE_ML_ANOMALIES_TOPIC,
                key=anomaly_event["deviceId"],
                value=json.dumps(anomaly_event).encode('utf-8'),
                callback=self.delivery_report
            )
            self.producer.flush(timeout=1)
        except Exception as e:
            logger.error(f"Error producing anomaly event: {e}", exc_info=True)

    def produce_prediction(self, event_data: dict[str, Any], is_anomaly: bool, score: float):
        """
        Produces all ML predictions to Kafka.

        Args:
            event_data (Dict[str, Any]): The telemetry event data.
            is_anomaly (bool): Whether an anomaly was detected.
            score (float): The anomaly score.
        """
        try:
            prediction_event = {
                "deviceId": event_data.get("deviceId"),
                "originalEventId": event_data.get("eventId"),
                "isAnomaly": is_anomaly,
                "anomalyScore": score,
                "timestamp": event_data.get("timestamp")
            }

            self.producer.produce(
                settings.KAFKA_PRODUCE_ML_PREDICTIONS_TOPIC,
                key=prediction_event["deviceId"],
                value=json.dumps(prediction_event).encode('utf-8'),
                callback=self.delivery_report
            )
            self.producer.flush(timeout=1)
        except Exception as e:
            logger.error(f"Error producing prediction event: {e}", exc_info=True)

ml_producer = KafkaProducer()
