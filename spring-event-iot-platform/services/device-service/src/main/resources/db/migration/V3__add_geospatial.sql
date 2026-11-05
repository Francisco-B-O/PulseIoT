-- Add geolocation columns to devices
ALTER TABLE devices ADD COLUMN latitude  DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN longitude DOUBLE PRECISION;

-- Areas table
CREATE TABLE areas (
    id         UUID          PRIMARY KEY,
    name       CHARACTER VARYING(255)  NOT NULL,
    polygon    TEXT          NOT NULL,
    created_at TIMESTAMP     NOT NULL
);

-- Join table: area ↔ device (device_id references devices.id UUID PK)
CREATE TABLE area_devices (
    area_id   UUID NOT NULL,
    device_id UUID NOT NULL,
    PRIMARY KEY (area_id, device_id),
    CONSTRAINT fk_area_devices_area   FOREIGN KEY (area_id)   REFERENCES areas(id)   ON DELETE CASCADE,
    CONSTRAINT fk_area_devices_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
