-- C4 container diagrams are additive. Existing general diagrams and free-form types stay intact.
ALTER TABLE diagrams
  ADD COLUMN kind text NOT NULL DEFAULT 'general',
  ADD COLUMN parent_diagram_id uuid REFERENCES diagrams(id) ON DELETE RESTRICT,
  ADD COLUMN owner_component_id uuid,
  ADD COLUMN scope_x double precision,
  ADD COLUMN scope_y double precision,
  ADD COLUMN scope_width double precision,
  ADD COLUMN scope_height double precision,
  ADD COLUMN trash_batch_id uuid,
  ADD COLUMN trash_root_diagram_id uuid REFERENCES diagrams(id) ON DELETE RESTRICT;

ALTER TABLE components
  ADD COLUMN role text NOT NULL DEFAULT 'element',
  ADD COLUMN technology varchar(200),
  ADD COLUMN source_component_id uuid REFERENCES components(id) ON DELETE RESTRICT;

ALTER TABLE relationships
  ADD COLUMN protocol varchar(200);

ALTER TABLE components
  ADD CONSTRAINT components_id_diagram_unique UNIQUE (id, diagram_id),
  ADD CONSTRAINT components_c4_role_check CHECK (
    (role = 'element' AND technology IS NULL AND source_component_id IS NULL)
    OR (role = 'container' AND type = 'container' AND description IS NOT NULL AND length(btrim(description)) > 0 AND technology IS NOT NULL AND length(btrim(technology)) > 0 AND source_component_id IS NULL)
    OR (role = 'external' AND type IN ('person', 'software-system') AND technology IS NULL AND source_component_id IS NOT NULL)
  ),
  ADD CONSTRAINT components_finite_layout_check CHECK (
    x > '-Infinity'::double precision AND x < 'Infinity'::double precision
    AND y > '-Infinity'::double precision AND y < 'Infinity'::double precision
    AND width > 0 AND width < 'Infinity'::double precision
    AND height > 0 AND height < 'Infinity'::double precision
  );

ALTER TABLE diagrams
  ADD CONSTRAINT diagrams_kind_check CHECK (kind IN ('general', 'container')),
  ADD CONSTRAINT diagrams_container_scope_check CHECK (
    (kind = 'general' AND parent_diagram_id IS NULL AND owner_component_id IS NULL AND scope_x IS NULL AND scope_y IS NULL AND scope_width IS NULL AND scope_height IS NULL)
    OR (kind = 'container' AND parent_diagram_id IS NOT NULL AND owner_component_id IS NOT NULL
      AND scope_x > '-Infinity'::double precision AND scope_x < 'Infinity'::double precision
      AND scope_y > '-Infinity'::double precision AND scope_y < 'Infinity'::double precision
      AND scope_width > 0 AND scope_width < 'Infinity'::double precision
      AND scope_height > 0 AND scope_height < 'Infinity'::double precision)
  );

ALTER TABLE diagrams
  ADD CONSTRAINT diagrams_container_owner_parent_fk
    FOREIGN KEY (owner_component_id, parent_diagram_id)
    REFERENCES components (id, diagram_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX diagrams_owner_component_unique ON diagrams(owner_component_id) WHERE owner_component_id IS NOT NULL;
CREATE INDEX diagrams_parent_diagram_idx ON diagrams(parent_diagram_id);
CREATE INDEX diagrams_trash_root_batch_idx ON diagrams(trash_root_diagram_id, trash_batch_id);
CREATE UNIQUE INDEX components_diagram_source_unique ON components(diagram_id, source_component_id);
CREATE INDEX components_source_component_idx ON components(source_component_id);
CREATE INDEX components_id_diagram_idx ON components(id, diagram_id);
