ALTER TABLE diagrams ADD COLUMN deletion_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE diagrams ADD CONSTRAINT diagrams_deletion_revision_check CHECK (deletion_revision >= 0);
