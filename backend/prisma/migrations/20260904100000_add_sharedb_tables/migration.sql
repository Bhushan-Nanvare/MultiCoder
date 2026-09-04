-- ShareDB tables for sharedb-postgres adapter (Stage 9.1)
-- These tables store OT operations and document snapshots.
-- Table names must match sharedb-postgres expectations.

CREATE TABLE IF NOT EXISTS ops (
  collection character varying(255) NOT NULL,
  doc_id character varying(255) NOT NULL,
  version integer NOT NULL,
  operation jsonb NOT NULL,
  PRIMARY KEY (collection, doc_id, version)
);

CREATE TABLE IF NOT EXISTS snapshots (
  collection character varying(255) NOT NULL,
  doc_id character varying(255) NOT NULL,
  version integer NOT NULL,
  doc_type character varying(255) NOT NULL,
  data jsonb NOT NULL,
  metadata jsonb,
  PRIMARY KEY (collection, doc_id)
);
