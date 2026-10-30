-- Student applications + uploaded documents (Epic 3)
CREATE TABLE IF NOT EXISTS applications (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status                   VARCHAR(30) NOT NULL DEFAULT 'submitted',
  upload_token             VARCHAR(64) DEFAULT NULL,
  user_id                  INT DEFAULT NULL,
  university_id            INT DEFAULT NULL,
  university_name          VARCHAR(300),
  program_id               INT DEFAULT NULL,
  program_name             VARCHAR(300),
  country                  VARCHAR(100),
  -- applicant identity
  first_name               VARCHAR(120),
  last_name                VARCHAR(120),
  email                    VARCHAR(200) NOT NULL,
  phone                    VARCHAR(50),
  date_of_birth            DATE DEFAULT NULL,
  place_of_birth           VARCHAR(150),
  nationality              VARCHAR(100),
  residence_country        VARCHAR(100),
  address                  TEXT,
  -- passport
  passport_no              VARCHAR(60),
  passport_issue_date      DATE DEFAULT NULL,
  passport_expiry_date     DATE DEFAULT NULL,
  passport_issued_by       VARCHAR(120),
  -- education
  high_school              VARCHAR(255),
  graduation_gpa           VARCHAR(50),
  field_of_interest        VARCHAR(80),
  english_test_type        VARCHAR(40),
  english_test_score       VARCHAR(40),
  english_test_planned_date DATE DEFAULT NULL,
  desired_intake           VARCHAR(100),
  notes                    TEXT,
  INDEX idx_status  (status),
  INDEX idx_email   (email),
  INDEX idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS application_documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  application_id  INT NOT NULL,
  doc_type        VARCHAR(50) NOT NULL,
  original_name   VARCHAR(255),
  stored_name     VARCHAR(255) NOT NULL,
  mime            VARCHAR(100),
  size_bytes      INT,
  uploaded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app (application_id),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
