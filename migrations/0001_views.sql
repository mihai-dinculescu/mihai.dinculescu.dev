-- One row per page per UTC day. Totals are SUM(count) GROUP BY the key.
-- The Worker inserts only the key; `day` and `count` take their defaults.
-- `slug` is renamed to `path` in 0002_views_by_path.sql.
CREATE TABLE views (
  slug  TEXT    NOT NULL,
  day   TEXT    NOT NULL DEFAULT (date('now')), -- YYYY-MM-DD, UTC
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (slug, day)
) WITHOUT ROWID;
