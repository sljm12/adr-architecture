ALTER TABLE components
  ADD COLUMN width double precision NOT NULL DEFAULT 180,
  ADD COLUMN height double precision NOT NULL DEFAULT 72;
