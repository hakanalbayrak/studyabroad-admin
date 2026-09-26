-- Pre-acceptance (ön kabul) fields on applications (Epic 4)
ALTER TABLE applications ADD COLUMN preaccept_ref VARCHAR(40) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN preaccept_conditions TEXT;
ALTER TABLE applications ADD COLUMN preaccept_issued_at DATETIME DEFAULT NULL;
