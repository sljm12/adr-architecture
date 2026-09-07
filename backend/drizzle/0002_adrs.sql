CREATE TYPE adr_status AS ENUM ('draft','accepted','superseded','rejected');
CREATE TABLE adrs (
  id uuid PRIMARY KEY,
  diagram_id uuid NOT NULL REFERENCES diagrams(id),
  title varchar(300) NOT NULL,
  context text NOT NULL,
  decision text NOT NULL,
  consequences text NOT NULL,
  alternatives_or_constraints text,
  status adr_status NOT NULL DEFAULT 'draft',
  replacement_adr_id uuid REFERENCES adrs(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE adr_component_links (
  adr_id uuid NOT NULL REFERENCES adrs(id),
  component_id uuid NOT NULL REFERENCES components(id),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (adr_id, component_id)
);
CREATE INDEX adrs_diagram_idx ON adrs(diagram_id);
CREATE INDEX adrs_updated_idx ON adrs(updated_at);
CREATE INDEX adrs_replacement_idx ON adrs(replacement_adr_id);
CREATE INDEX adr_component_links_component_idx ON adr_component_links(component_id);
