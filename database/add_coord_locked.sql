-- Add coord_locked flag to orbit_configs
-- Run this in phpMyAdmin before deploying the orbit coordinate lock feature
ALTER TABLE orbit_configs
  ADD COLUMN coord_locked TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'When 1, bulk geo-lookup will not overwrite orbit_center_lat/lng';
