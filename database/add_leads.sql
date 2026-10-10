CREATE TABLE IF NOT EXISTS leads (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  student_name     VARCHAR(150) NOT NULL,
  email            VARCHAR(200) NOT NULL,
  phone            VARCHAR(50),
  message          TEXT,
  program_id       INT,
  program_name     VARCHAR(300),
  university_id    INT,
  university_name  VARCHAR(300),
  country          VARCHAR(100),
  status           ENUM('new','contacted','converted','closed') DEFAULT 'new',
  notes            TEXT,
  INDEX idx_status  (status),
  INDEX idx_created (created_at),
  INDEX idx_email   (email)
);
