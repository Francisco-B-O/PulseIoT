CREATE TABLE IF NOT EXISTS idempotency_records (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL
);
