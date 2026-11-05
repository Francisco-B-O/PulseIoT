"""
Model training module for the IoT ML Platform.
Provides functionality to train an Isolation Forest model using historical telemetry data.
"""

import os
import logging
import json
from datetime import datetime
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from config.settings import settings
from storage.data_lake import data_lake
from processing.data_processor import data_processor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ModelTrainer:
    """
    Handles training and serialization of the anomaly detection model with versioning.
    """
    def __init__(self, model_path: str | None = None):
        """
        Initializes the trainer and ensures the model storage directory exists.

        Args:
            model_path (Optional[str]): Directory to save the trained model.
        """
        self.model_path = model_path or settings.MODEL_STORAGE_PATH
        self.registry_file = os.path.join(self.model_path, "model_registry.json")
        try:
            if not os.path.exists(self.model_path):
                os.makedirs(self.model_path, exist_ok=True)
                logger.info("Created model storage directory at %s", self.model_path)
        except Exception as e:
            logger.error("Failed to create model storage directory: %s", e)
            raise

    def train_anomaly_model(self, data: pd.DataFrame | None = None) -> IsolationForest | None:
        """
        Trains an Isolation Forest model for anomaly detection.
        Uses historical data from the data lake if not provided.
        Includes versioning and registry tracking.

        Args:
            data (Optional[pd.DataFrame]): The training data.
                                          If None, data is loaded from the data lake.

        Returns:
            Optional[IsolationForest]: The trained model instance, or None if training failed.
        """
        try:
            if data is None:
                logger.info("No training data provided, loading from Data Lake...")
                raw_data = data_lake.get_latest_data(limit=10000)
                if raw_data.empty:
                    logger.error("No historical data found for training.")
                    return None
                data = data_processor.prepare_for_ml(raw_data)

            if data is None or data.empty:
                logger.error("No valid features found for training.")
                return None

            features = data_processor.get_features_only(data)

            if features.empty:
                logger.error("Feature extraction resulted in empty dataframe.")
                return None

            version = datetime.now().strftime("%Y%m%d_%H%M%S")
            logger.info("Training model version %s with %d samples.", version, len(features))

            model = IsolationForest(
                n_estimators=100,
                contamination='auto',
                random_state=42
            )
            model.fit(features)

            # Save versioned model
            version_dir = os.path.join(self.model_path, version)
            os.makedirs(version_dir, exist_ok=True)

            model_file = os.path.join(version_dir, "anomaly_detector.joblib")
            feature_file = os.path.join(version_dir, "feature_names.joblib")

            joblib.dump(model, model_file)

            # Save feature names for inference
            feature_names = features.columns.tolist()
            joblib.dump(feature_names, feature_file)

            # Compute threshold from training data score distribution.
            # We use the 5th percentile of decision_function scores on training data.
            # This means ~5% of the training distribution is flagged as anomalous,
            # which is a reasonable sensitivity for IoT telemetry that is mostly normal.
            # Storing it here ensures training and inference use the same threshold.
            training_scores = model.decision_function(features)
            threshold = float(np.percentile(training_scores, 5))
            flagged_pct = (training_scores < threshold).mean() * 100
            logger.info(
                "Threshold computed from training data (p5): %.4f (flags %.1f%% of training samples)",
                threshold, flagged_pct,
            )

            # Update 'latest' pointer
            latest_info = {
                "latest_version": version,
                "timestamp": datetime.now().isoformat(),
                "samples": len(features),
                "features": feature_names,
                "metrics": {
                    "feature_count": len(feature_names),
                    "contamination": model.contamination,
                    "avg_anomaly_score": float(training_scores.mean()),
                    "threshold": threshold,
                    "threshold_percentile": 5,
                }
            }
            with open(os.path.join(self.model_path, "latest_model.json"), "w") as f:
                json.dump(latest_info, f, indent=4)

            self._update_registry(version, len(features), feature_names, latest_info["metrics"])

            logger.info("Model version %s saved and set as latest.", version)
            return model
        except Exception as e:
            logger.error("Unexpected error during model training: %s", e, exc_info=True)
            return None

    def _update_registry(self, version: str, samples: int, features: list[str], metrics: dict[str, Any]):
        """
        Updates the model registry with new training information.

        Args:
            version (str): The model version identifier.
            samples (int): Number of training samples.
            features (List[str]): List of feature names used.
            metrics (Dict[str, Any]): Training metrics.
        """
        try:
            registry = []
            if os.path.exists(self.registry_file):
                with open(self.registry_file) as f:
                    registry = json.load(f)

            registry.append({
                "version": version,
                "timestamp": datetime.now().isoformat(),
                "samples": samples,
                "feature_count": len(features),
                "features": features,
                "metrics": metrics
            })

            with open(self.registry_file, "w") as f:
                json.dump(registry, f, indent=4)
        except Exception as e:
            logger.error("Failed to update model registry: %s", e)

if __name__ == "__main__":
    trainer = ModelTrainer()
    trainer.train_anomaly_model()
