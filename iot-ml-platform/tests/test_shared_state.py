from ml import shared_state


def test_state_round_trip(tmp_path):
    path = str(tmp_path / "state.json")
    shared_state.prediction_history.clear()
    shared_state.prediction_history.append({"device_id": "s1", "is_anomaly": True, "score": 0.9})
    shared_state.autotrain_config.update({"enabled": True, "interval_hours": 3.0})
    shared_state.last_train_time = 1234.5
    assert shared_state.save_state(path)

    shared_state.prediction_history.clear()
    shared_state.autotrain_config.update({"enabled": False, "interval_hours": 6.0})
    shared_state.last_train_time = None
    assert shared_state.load_state(path)

    assert list(shared_state.prediction_history) == [{"device_id": "s1", "is_anomaly": True, "score": 0.9}]
    assert shared_state.autotrain_config["enabled"] is True
    assert shared_state.autotrain_config["interval_hours"] == 3.0
    assert shared_state.last_train_time == 1234.5
    shared_state.prediction_history.clear()


def test_load_missing_or_corrupt_is_safe(tmp_path):
    assert shared_state.load_state(str(tmp_path / "nope.json")) is False
    bad = tmp_path / "bad.json"
    bad.write_text("{not json")
    assert shared_state.load_state(str(bad)) is False
