#!/usr/bin/env sh
# Prints the total views, then a table of the views per page (count, share of
# the total, page type and slug) from the remote D1 database, most viewed
# first. It covers one UTC day, today unless given as YYYY-MM-DD, or every day
# when given `all`. README.md ("View counts") describes what is counted.
set -eu
# wrangler reads wrangler.jsonc from the current directory.
cd "$(dirname "$0")/.."

day=${1:-$(date -u +%Y-%m-%d)}
if test "$day" = all; then
  sql="SELECT path, SUM(count) AS count FROM views GROUP BY path ORDER BY count DESC, path"
# A real calendar date in YYYY-MM-DD, not just the shape: it is inlined into
# the SQL below, and a day that cannot exist would quietly print 0 views.
elif node -e '
  const d = new Date(process.argv[1] + "T00:00:00Z");
  process.exit(!isNaN(d) && d.toISOString().slice(0, 10) === process.argv[1] ? 0 : 1);
' "$day"; then
  sql="SELECT path, count FROM views WHERE day = '$day' ORDER BY count DESC, path"
else
  echo "usage: $0 [YYYY-MM-DD | all]" >&2
  exit 1
fi

# `wrangler d1 execute` fails now and then; a second try usually succeeds, so
# it gets three before giving up. With --json, wrangler reports an API error
# as JSON on stdout, and on Windows it then dies in a libuv assertion, so
# stderr holds only that assertion line: the reason is on stdout when there is
# one. A rejected query or an expired login will not pass on a retry, so those
# stop at once.
err=$(mktemp)
trap 'rm -f "$err"' EXIT
for attempt in 1 2 3; do
  if out=$(npx wrangler d1 execute DB --remote --json --command "$sql" 2> "$err"); then
    break
  fi
  if test "$attempt" = 3 || printf '%s' "$out" | grep -qE 'SQLITE_ERROR|Authentication error'; then
    if printf '%s' "$out" | grep -q '"error"'; then printf '%s\n' "$out" >&2; else cat "$err" >&2; fi
    exit 1
  fi
done

printf '%s' "$out" | node scripts/views-table.mjs "$day"
