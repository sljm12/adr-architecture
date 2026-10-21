# Data Model

No domain entities, fields, UUIDs, relationships, or SQL migrations change. The bundled database
stores the existing schema in a named PostgreSQL volume. Existing databases retain their schema
and artifacts. Environment files contain deployment configuration only and are never domain archives.
