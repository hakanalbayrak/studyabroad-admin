-- Migration: add programme detail fields
-- Run in cPanel > phpMyAdmin

ALTER TABLE programs
  ADD COLUMN placement_year         BOOLEAN      DEFAULT FALSE       AFTER scholarship_available,
  ADD COLUMN internship_available    BOOLEAN      DEFAULT FALSE       AFTER placement_year,
  ADD COLUMN international_eligible  BOOLEAN      DEFAULT TRUE        AFTER internship_available,
  ADD COLUMN internship_paid         VARCHAR(20)  DEFAULT NULL        AFTER international_eligible,
  ADD COLUMN employer_partnerships   TEXT         DEFAULT NULL        AFTER internship_paid,
  ADD COLUMN live_industry_projects  BOOLEAN      DEFAULT FALSE       AFTER employer_partnerships,
  ADD COLUMN professional_accreditation VARCHAR(500) DEFAULT NULL     AFTER live_industry_projects,
  ADD COLUMN graduate_outcome_source VARCHAR(255) DEFAULT NULL        AFTER professional_accreditation,
  ADD COLUMN graduate_outcome_date   VARCHAR(50)  DEFAULT NULL        AFTER graduate_outcome_source,
  ADD COLUMN scholarship_amount      VARCHAR(255) DEFAULT NULL        AFTER graduate_outcome_date,
  ADD COLUMN scholarship_conditions  TEXT         DEFAULT NULL        AFTER scholarship_amount,
  ADD COLUMN application_deadline    VARCHAR(100) DEFAULT NULL        AFTER scholarship_conditions,
  ADD COLUMN deposit_deadline        VARCHAR(100) DEFAULT NULL        AFTER application_deadline,
  ADD COLUMN scholarship_deadline    VARCHAR(100) DEFAULT NULL        AFTER deposit_deadline;
