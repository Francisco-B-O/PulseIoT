"""
PySpark schema definitions for Kafka message parsing.

Centralised here so processor.py and any future consumers share
the same structural contract for device-data-processed messages.
"""
from pyspark.sql.types import (
    DoubleType,
    StringType,
    StructField,
    StructType,
)

ENRICHED_DATA_SCHEMA = StructType([
    StructField("temperature",    DoubleType(), True),
    StructField("humidity",       DoubleType(), True),
    StructField("vibration",      DoubleType(), True),
    StructField("deviceType",     StringType(), True),
    StructField("deviceLocation", StringType(), True),
])

INPUT_SCHEMA = StructType([
    StructField("deviceId",     StringType(),        True),
    StructField("eventId",      StringType(),        True),
    StructField("timestamp",    StringType(),        True),
    StructField("status",       StringType(),        True),
    StructField("enrichedData", ENRICHED_DATA_SCHEMA, True),
])
