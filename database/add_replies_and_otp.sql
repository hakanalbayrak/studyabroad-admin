-- Lead reply history (admin replies to student inquiries)
CREATE TABLE IF NOT EXISTS lead_replies (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  lead_id     INT NOT NULL,
  body        TEXT NOT NULL,
  sent_by     VARCHAR(255) DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead (lead_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Passwordless email OTP sign-in codes
CREATE TABLE IF NOT EXISTS login_otps (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code        VARCHAR(10) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used        TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);
