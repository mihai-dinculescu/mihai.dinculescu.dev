-- One row per post per UTC day. Totals are SUM(count) GROUP BY slug.
-- The Worker inserts only `slug`; `day` and `count` take their defaults.
CREATE TABLE views (
  slug  TEXT    NOT NULL,
  day   TEXT    NOT NULL DEFAULT (date('now')), -- YYYY-MM-DD, UTC
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (slug, day)
) WITHOUT ROWID;
