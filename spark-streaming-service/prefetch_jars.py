"""Pre-download Spark Kafka connector JARs into the Ivy cache at image build time."""
from pyspark.sql import SparkSession

try:
    spark = (
        SparkSession.builder
        .master("local[1]")
        .appName("prefetch")
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )
    spark.stop()
    print("JAR pre-fetch complete.")
except Exception as exc:
    print(f"Pre-fetch warning: {exc}")
