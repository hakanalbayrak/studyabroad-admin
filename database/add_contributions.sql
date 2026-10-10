-- Epic 8, part 1: Contribution Review Queue.
-- Holds proposed data (from the future AI data agent, or manual entry) for
-- admin review before it ever touches the live entities/programs tables.
-- The agent itself is a separate, not-yet-built piece — this table and the
-- admin review UI are useful on their own regardless of when/whether the
-- agent exists.
CREATE TABLE IF NOT EXISTS contributions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('entity','program','ranking') NOT NULL,
  target_id     INT DEFAULT NULL COMMENT 'NULL = proposing a brand-new record',
  payload       JSON NOT NULL,
  source_url    VARCHAR(500) NOT NULL,
  submitted_by  VARCHAR(100) DEFAULT NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   DATETIME DEFAULT NULL,
  INDEX idx_status (status),
  INDEX idx_type   (type)
);
