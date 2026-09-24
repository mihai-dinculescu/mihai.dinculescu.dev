// View counter for posts and TIL entries: POST /api/views<page path> adds one
// view to the row for that page and today's UTC date in the D1 `views` table
// and answers 204. README.md describes what is and is not counted ("View
// counts"), how the list of accepted paths is produced and how requests reach
// this script ("Deploy").

// Anything shaped like a page path in a section, `/<section>/<slug>/` or
// deeper; whether the page is counted is decided against the manifest below,
// so neither the section names nor the slug alphabet are repeated here.
// `path` is the page path as Zola builds it, slashes included: the same string
// as the beacon's `data-views` attribute, the manifest line and the D1 row.
// Dot segments never reach this regex: `new URL` has already resolved them.
const PAGE_PATH = /^\/api\/views(?<path>\/[^/]+(?:\/[^/]+)+\/)$/;

// Counted page paths from /views.txt, fetched once per isolate. The promise is
// cached, not its result, so a burst of beacons on a cold isolate shares one
// fetch. A deploy replaces every isolate, so there is nothing to invalidate;
// `wrangler dev` reloads on any change under public/, which does the same
// locally. A manifest that cannot be read is dropped from the cache, so the
// next beacon retries, and resolves to null, which the handler answers with
// 503 rather than rejecting the path as not counted.
let pages;
function countedPages(env, url) {
  pages ??= env.ASSETS.fetch(new URL("/views.txt", url))
    .then(async (manifest) => {
      if (!manifest.ok) throw new Error(`status ${manifest.status}`);
      return new Set((await manifest.text()).split(/\r?\n/));
    })
    .catch((err) => {
      pages = undefined;
      console.error("views not counted, /views.txt not readable:", err);
      return null;
    });
  return pages;
}

// Crawlers that render JavaScript and would otherwise pass the same-origin check
// below. This is not a defence against scripted requests: anything that forges
// Sec-Fetch-Site or Origin controls its User-Agent too. `(?<!cu)bot` keeps
// Cubot phones, whose model string in-app browsers still send, out of the match.
// `preview` covers link-preview renderers such as BingPreview, `ptst` is
// WebPageTest, and the two Google entries are its read-aloud and page
// renderers, none of which spell out "bot" or "crawl".
const BOT =
  /(?<!cu)bot|crawl|spider|slurp|headless|lighthouse|inspectiontool|preview|ptst|google-(?:read-aloud|pagerenderer)/i;

// Said once per isolate; see the rate limit below.
let warnedNoAddress = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // The asset layer hands over the misses it does not answer itself
    // (README.md, "Deploy"). Give them back so they get the theme's 404 page;
    // the bare 404 is for unknown paths under /api/.
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    const match = url.pathname.match(PAGE_PATH);
    if (!match) {
      return new Response(null, { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    // Same-origin only. Every browser sends Origin on a POST, but it can be
    // suppressed by a strict referrer policy or a Firefox preference;
    // Sec-Fetch-Site is unconditional but absent on Safari before 16.4.
    const sameOrigin =
      request.headers.get("Sec-Fetch-Site") === "same-origin" ||
      request.headers.get("Origin") === url.origin;
    if (!sameOrigin) {
      return new Response(null, { status: 403 });
    }

    if (BOT.test(request.headers.get("User-Agent") || "")) {
      return new Response(null, { status: 204 });
    }

    // Only count pages in the manifest, so that Zola's routing (section and
    // pagination pages, percent-encoded, re-cased or `index.html/` aliases) is
    // not repeated here. Checked before the rate limit so that a path that is
    // not counted costs no limiter token. Without the manifest nothing can be
    // counted; 503 keeps that apart from the 404 for a path that is not a page.
    const { path } = match.groups;
    const counted = await countedPages(env, url);
    if (!counted) {
      return new Response(null, { status: 503 });
    }
    if (!counted.has(path)) {
      return new Response(null, { status: 404 });
    }

    // Per-IP cap. A reader opens a handful of pages a minute; a script that
    // forges Origin does not stop at that. CF-Connecting-IP is set by the edge
    // and cannot be spoofed by the client. Shared addresses (offices, CGNAT)
    // can trip this, which loses a few views rather than a day's worth. When
    // the header is missing (a local or proxied setup that strips it) the cap
    // is skipped rather than pooling every client under one empty key, and
    // said once. A limiter that cannot be reached is a platform fault, not a
    // reader over the cap, so the view is counted rather than dropped; it is
    // logged because until then nothing is capped.
    const address = request.headers.get("CF-Connecting-IP");
    let success = true;
    if (address) {
      try {
        ({ success } = await env.VIEWS_LIMIT.limit({ key: address }));
      } catch (err) {
        console.error(`view of ${path} not rate limited:`, err);
      }
    } else if (!warnedNoAddress) {
      warnedNoAddress = true;
      console.warn("views not rate limited: no CF-Connecting-IP header");
    }
    if (!success) {
      return new Response(null, { status: 429 });
    }

    // Nothing reads the reply, so send it before the write lands. `day` and
    // `count` come from the column defaults in migrations/0001_views.sql;
    // `path` is the key column's name since migrations/0002_views_by_path.sql.
    ctx.waitUntil(
      env.DB.prepare(
        "INSERT INTO views (path) VALUES (?1) " +
          "ON CONFLICT (path, day) DO UPDATE SET count = count + 1",
      )
        .bind(path)
        .run()
        .catch((err) => console.error(`view of ${path} not counted:`, err)),
    );
    return new Response(null, { status: 204 });
  },
};
