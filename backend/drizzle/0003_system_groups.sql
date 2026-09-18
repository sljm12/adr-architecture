CREATE TABLE system_groups (
  id uuid PRIMARY KEY,
  diagram_id uuid NOT NULL REFERENCES diagrams(id),
  name varchar(200) NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision NOT NULL,
  height double precision NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX system_groups_diagram_idx ON system_groups(diagram_id);

CREATE TABLE system_group_members (
  group_id uuid NOT NULL REFERENCES system_groups(id),
  component_id uuid NOT NULL REFERENCES components(id),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (group_id, component_id)
);

CREATE INDEX system_group_members_group_idx ON system_group_members(group_id);
CREATE INDEX system_group_members_component_idx ON system_group_members(component_id);
