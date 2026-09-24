-- The key is now the page path as built (`/posts/<slug>/`, `/til/<slug>/`),
-- the same string as the beacon's data-views attribute and the manifest line,
-- so that TIL entries are counted beside posts. Rows written before this hold
-- a bare post slug; give them their path. Between this migration and the
-- Worker that follows it in the same deploy, the running Worker's inserts
-- fail and are logged (README.md, "View counts").
ALTER TABLE views RENAME COLUMN slug TO path;
UPDATE views SET path = '/posts/' || path || '/' WHERE path NOT LIKE '/%';
