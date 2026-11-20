-- Add subscription_tier_id to users table
-- Run in phpMyAdmin after deploying this update

ALTER TABLE users
  ADD COLUMN subscription_tier_id INT DEFAULT NULL,
  ADD FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id) ON DELETE SET NULL;
