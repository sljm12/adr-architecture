BEGIN;
ALTER TABLE components ADD COLUMN container_type text;
-- Existing generic containers become Application; never infer subtype from labels.
UPDATE components SET container_type = 'application' WHERE role = 'container';
ALTER TABLE components DROP CONSTRAINT components_c4_role_check;
ALTER TABLE components ADD CONSTRAINT components_c4_role_check CHECK (
  (role = 'element' AND container_type IS NULL AND technology IS NULL AND source_component_id IS NULL)
  OR (role = 'container' AND type = 'container' AND container_type IS NOT NULL
      AND container_type IN ('application', 'datastore')
      AND description IS NOT NULL AND length(btrim(description)) > 0
      AND technology IS NOT NULL AND length(btrim(technology)) > 0 AND source_component_id IS NULL)
  OR (role = 'external' AND type IN ('person', 'software-system') AND container_type IS NULL
      AND technology IS NULL AND source_component_id IS NOT NULL)
);
COMMIT;
