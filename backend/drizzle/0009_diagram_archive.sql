BEGIN;
-- Local coordination survives permanent deletion and historical UUID reintroduction.
CREATE TABLE diagram_confirmation_epochs (
  diagram_id uuid PRIMARY KEY,
  epoch bigint NOT NULL DEFAULT 0 CHECK (epoch >= 0)
);
DROP INDEX components_diagram_source_unique;
ALTER TABLE components ADD CONSTRAINT components_diagram_source_unique
  UNIQUE (diagram_id, source_component_id) DEFERRABLE INITIALLY IMMEDIATE;
COMMIT;
