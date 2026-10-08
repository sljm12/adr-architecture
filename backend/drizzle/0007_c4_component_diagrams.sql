BEGIN;
-- Add the third C4 level using existing storage. No backfill or artifact writes.
ALTER TABLE diagrams DROP CONSTRAINT diagrams_kind_check;
ALTER TABLE diagrams ADD CONSTRAINT diagrams_kind_check CHECK (kind IN ('general', 'container', 'component'));
ALTER TABLE diagrams DROP CONSTRAINT diagrams_container_scope_check;
ALTER TABLE diagrams ADD CONSTRAINT diagrams_container_scope_check CHECK (
  (kind = 'general' AND parent_diagram_id IS NULL AND owner_component_id IS NULL
    AND scope_x IS NULL AND scope_y IS NULL AND scope_width IS NULL AND scope_height IS NULL)
  OR (kind IN ('container', 'component') AND parent_diagram_id IS NOT NULL AND parent_diagram_id <> id AND owner_component_id IS NOT NULL
    AND scope_x IS NOT NULL AND scope_y IS NOT NULL AND scope_width IS NOT NULL AND scope_height IS NOT NULL
    AND scope_x > '-Infinity'::double precision AND scope_x < 'Infinity'::double precision
    AND scope_y > '-Infinity'::double precision AND scope_y < 'Infinity'::double precision
    AND scope_width > 0 AND scope_width < 'Infinity'::double precision
    AND scope_height > 0 AND scope_height < 'Infinity'::double precision)
);
ALTER TABLE components DROP CONSTRAINT components_c4_role_check;
ALTER TABLE components ADD CONSTRAINT components_c4_role_check CHECK (
  (role = 'element' AND container_type IS NULL AND technology IS NULL AND source_component_id IS NULL)
  OR (role = 'container' AND type IS NOT NULL AND type = 'container' AND container_type IS NOT NULL
    AND container_type IN ('application', 'datastore') AND description IS NOT NULL AND length(btrim(description)) > 0
    AND technology IS NOT NULL AND length(btrim(technology)) > 0 AND source_component_id IS NULL)
  OR (role = 'component' AND type IS NOT NULL AND type = 'component' AND container_type IS NULL
    AND description IS NOT NULL AND length(btrim(description)) > 0
    AND technology IS NOT NULL AND length(btrim(technology)) > 0 AND source_component_id IS NULL)
  OR (role = 'external' AND source_component_id IS NOT NULL AND type IS NOT NULL AND (
    (type IN ('person', 'software-system') AND container_type IS NULL AND technology IS NULL)
    OR (type = 'container' AND container_type IS NOT NULL AND container_type IN ('application', 'datastore')
      AND description IS NOT NULL AND length(btrim(description)) > 0 AND technology IS NOT NULL AND length(btrim(technology)) > 0)
  ))
);
COMMIT;
