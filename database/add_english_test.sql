-- Epic 6: English level test results
CREATE TABLE IF NOT EXISTS english_test_results (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(200) NOT NULL,
  level      VARCHAR(10) NOT NULL,  -- A1, A2, B1, B2, C1, C2
  score      INT NOT NULL,          -- raw correct answers (0-20)
  answers    JSON,                  -- array of chosen answer indices
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email   (email),
  INDEX idx_created (created_at)
);
