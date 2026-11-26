-- Epic 5: document review status column
ALTER TABLE application_documents ADD COLUMN review_status VARCHAR(20) DEFAULT 'pending';
