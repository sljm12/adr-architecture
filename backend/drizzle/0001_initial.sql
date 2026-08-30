CREATE TYPE diagram_status AS ENUM ('active','trashed');
CREATE TYPE relationship_direction AS ENUM ('directed','undirected');
CREATE TABLE diagrams (id uuid PRIMARY KEY, name varchar(200) NOT NULL, status diagram_status NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, trashed_at timestamptz);
CREATE TABLE components (id uuid PRIMARY KEY, diagram_id uuid NOT NULL REFERENCES diagrams(id), name varchar(200) NOT NULL, description text, type varchar(100), x double precision NOT NULL, y double precision NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE relationships (id uuid PRIMARY KEY, diagram_id uuid NOT NULL REFERENCES diagrams(id), source_component_id uuid NOT NULL REFERENCES components(id), target_component_id uuid NOT NULL REFERENCES components(id), direction relationship_direction NOT NULL, label text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE INDEX components_diagram_idx ON components(diagram_id); CREATE INDEX relationships_diagram_idx ON relationships(diagram_id);
