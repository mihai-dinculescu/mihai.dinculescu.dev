// Formats the JSON of `wrangler d1 execute --json` (rows of `path` and
// `count`) from stdin as the total views, then a table of the views per page.
// Called by scripts/views.sh with the day (YYYY-MM-DD or `all`) as the only
// argument.
import { text } from "node:stream/consumers";

const TYPES = { posts: "Post", til: "TIL" };

const raw = await text(process.stdin);
const data = JSON.parse(raw);
if (!Array.isArray(data) || !Array.isArray(data[0]?.results)) {
  console.error("unexpected wrangler output:", raw);
  process.exit(1);
}
const rows = data[0].results;
const day = process.argv[2];
const total = rows.reduce((sum, { count }) => sum + count, 0);
console.log(`Views ${day === "all" ? "all time" : `on ${day}`}: ${total} total`);

if (rows.length) {
  // A path like /posts/<slug>/ shows as type Post and page <slug>; any other
  // path shows in full with no type.
  const table = rows.map(({ path, count }) => {
    const m = path.match(/^\/([^/]+)\/(.+?)\/?$/);
    const type = m && TYPES[m[1]];
    return [
      String(count),
      `${((count / total) * 100).toFixed(1)}%`,
      type || "",
      type ? m[2] : path,
    ];
  });
  const header = ["Views", "Share", "Type", "Page"];
  const widths = header.map((h, i) => Math.max(h.length, ...table.map((r) => r[i].length)));
  // Numbers are right-aligned, text left-aligned.
  const line = (r) =>
    r.map((c, i) => (i < 2 ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join("  ").trimEnd();
  console.log();
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of table) console.log(line(r));
}
