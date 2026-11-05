"""
Data processing module for the IoT ML Platform.
Provides functionality to prepare raw telemetry data for machine learning tasks.
"""

import logging

import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DataProcessor:
    """
    Handles transformation and cleaning of raw telemetry data for ML models.
    """
    def __init__(self):
        """
        Initializes the DataProcessor.
        """
        pass

    def validate_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Validates the input data for quality.
        Removes rows with missing deviceId or timestamp.
        Handles outliers by clipping values to a reasonable range.

        Args:
            df (pd.DataFrame): Input telemetry data.

        Returns:
            pd.DataFrame: Validated and cleaned data.
        """
        if df is None or df.empty:
            return pd.DataFrame()

        # Basic requirements
        df = df.dropna(subset=['deviceId', 'timestamp'])

        # Numeric validation
        feature_cols = [c for c in df.columns if c.startswith('enrichedData.')]
        for col in feature_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            # Clip outliers (e.g., extremely high temperature sensors can be noisy)
            # This is a simple heuristic; in a real scenario, limits would be per-sensor-type
            if 'temperature' in col:
                df[col] = df[col].clip(lower=-50, upper=150)

        return df.fillna(0)

    def prepare_for_ml(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepares raw telemetry data for ML tasks.
        Extracts features from the enrichedData map and adds window-based aggregations.

        Args:
            df (pd.DataFrame): Raw telemetry data.

        Returns:
            pd.DataFrame: Processed data with advanced features ready for ML.
        """
        try:
            if df is None or df.empty:
                logger.debug("Received empty dataframe for ML preparation.")
                return pd.DataFrame()

            # Validate first
            df = self.validate_data(df)
            if df.empty:
                return pd.DataFrame()

            # Handle column name variations if json_normalize was used differently
            feature_cols = [c for c in df.columns if c.startswith('enrichedData.')]

            if not feature_cols:
                logger.warning("No enrichedData features found in the dataframe.")
                return pd.DataFrame()

            required_cols = ['deviceId', 'timestamp']
            missing_cols = [c for c in required_cols if c not in df.columns]
            if missing_cols:
                logger.error(f"Missing required columns: {missing_cols}")
                return pd.DataFrame()

            selected_cols = required_cols + feature_cols
            processed_df = df[selected_cols].copy()

            # Convert timestamp to datetime.
            # Handles three formats found in the data lake:
            #   - ISO strings: "2026-04-07T11:44:23Z"
            #   - Epoch milliseconds (int/str): 1775562669731
            #   - Epoch seconds (float/str): 1.7755626697E9
            ts_raw = processed_df['timestamp']
            # First attempt: treat as numeric epoch (ms if > 1e11, else seconds)
            numeric = pd.to_numeric(ts_raw, errors='coerce')
            is_numeric = numeric.notna()
            parsed = pd.Series(pd.NaT, index=ts_raw.index, dtype='datetime64[ns, UTC]')
            if is_numeric.any():
                is_ms = numeric > 1e11
                parsed[is_numeric & is_ms]  = pd.to_datetime(numeric[is_numeric & is_ms],  unit='ms', utc=True, errors='coerce')
                parsed[is_numeric & ~is_ms] = pd.to_datetime(numeric[is_numeric & ~is_ms], unit='s',  utc=True, errors='coerce')
            # Second attempt: parse remaining as ISO strings
            still_nat = parsed.isna()
            if still_nat.any():
                parsed[still_nat] = pd.to_datetime(ts_raw[still_nat], format='ISO8601', utc=True, errors='coerce')
            processed_df['timestamp'] = parsed

            # Sort by device and timestamp for proper window calculations
            processed_df = processed_df.sort_values(by=['deviceId', 'timestamp'])

            # --- Feature Engineering: Window-based aggregations ---
            for col in feature_cols:
                short_name = col.split('.')[-1]
                group = processed_df.groupby('deviceId')[col]

                # Rolling stats
                processed_df[f'feat_{short_name}_rolling_mean_5'] = group.transform(lambda x: x.rolling(window=5, min_periods=1).mean())
                processed_df[f'feat_{short_name}_rolling_std_5'] = group.transform(lambda x: x.rolling(window=5, min_periods=1).std()).fillna(0)
                processed_df[f'feat_{short_name}_rolling_min_5'] = group.transform(lambda x: x.rolling(window=5, min_periods=1).min())
                processed_df[f'feat_{short_name}_rolling_max_5'] = group.transform(lambda x: x.rolling(window=5, min_periods=1).max())

                # Trend detection (change between current and previous value)
                processed_df[f'feat_{short_name}_delta'] = group.diff().fillna(0)

            return processed_df
        except Exception as e:
            logger.error(f"Error preparing data for ML: {e}", exc_info=True)
            return pd.DataFrame()

    def get_features_only(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Returns all generated features for ML model input.

        Args:
            df (pd.DataFrame): Processed data including deviceId, timestamp and engineered features.

        Returns:
            pd.DataFrame: Dataframe containing only feature columns (starting with enrichedData. or feat_).
        """
        try:
            feature_cols = [c for c in df.columns if c.startswith('enrichedData.') or c.startswith('feat_')]
            if not feature_cols:
                logger.warning("No feature columns found in dataframe.")
                return pd.DataFrame()
            return df[feature_cols]
        except Exception as e:
            logger.error(f"Error extracting features: {e}", exc_info=True)
            return pd.DataFrame()

data_processor = DataProcessor()
