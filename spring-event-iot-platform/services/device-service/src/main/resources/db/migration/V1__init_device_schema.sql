CREATE TABLE devices (
    id UUID PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL
);
