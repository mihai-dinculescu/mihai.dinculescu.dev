# mihai.dinculescu.dev

Personal site built with [Zola](https://www.getzola.org) and the
[apollo](https://github.com/not-matthias/apollo) theme, served as a Cloudflare
Worker with static assets. The only code that runs is a view counter for posts
and TIL entries, backed by a D1 database. Comments are this repository's GitHub
Discussions, rendered by [giscus](https://giscus.app).

| Piece          | Where                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Content        | `content/` (`posts/`, `til/` for TIL entries, `_index.md` the homepage)        |
| TIL index      | `templates/til.html` (tags with entry counts, then entries newest first)       |
| Theme          | `themes/apollo` git submodule, pinned to the commit recorded in this repo      |
| Site config    | `config.toml`                                                                  |
| Comments embed | `templates/_giscus_script.html` (overrides the theme's utterances placeholder) |
| Head hook      | `templates/apollo/head_end.html` (canonical link for republished posts)        |
| Body hook      | `templates/apollo/body_end.html` (view counter beacon on posts and entries)    |
| Components     | `templates/components/` (Tera 2 components callable from post markdown)        |
| View counter   | `worker/index.js` (`/api/views/<section>/<slug>/`), `migrations/` (D1 schema)  |
| View manifest  | `scripts/views-manifest.sh` (paths the view counter accepts, from the build)   |
| Worker config  | `wrangler.jsonc`                                                               |
| Deploy         | `.github/workflows/deploy.yml`, on every push to `main`                        |

## Writing

```sh
git submodule update --init          # first checkout only
zola serve                           # http://127.0.0.1:1111, live reload
```

New posts go in `content/posts/<slug>.md`. Front matter:

```toml
+++
title = "Title"
date = 2026-09-09
description = "One line for the listing, feed and meta tags."

[taxonomies]
tags = ["tag"]

[extra]
comment = true   # omit to publish without a comment thread
read_time = true # show the estimated reading time in the post header
+++
```

A post republished from elsewhere also sets `canonical_url` under `[extra]` to
the original's address. `templates/apollo/head_end.html` turns it into a
`<link rel="canonical">` so search engines credit the original.

Posts whose English was polished by AI end with the disclaimer component,
defined in `templates/components/ai_disclaimer.html`. Put this on its own
line, just before any title footnote:

```
{{<ai_disclaimer />}}
```

`zola check` validates internal and external links before pushing.

`zola serve` does not run the Worker, so the view counter beacon fails quietly.
To exercise it locally, build the site and run the Worker against a local D1
database (state lives in the gitignored `.wrangler/`):

```sh
npx wrangler d1 migrations apply DB --local   # after each new migration
zola build -u http://localhost:8787 && sh scripts/views-manifest.sh
npx wrangler dev                              # http://localhost:8787
```

`DB` is the binding name from `wrangler.jsonc`; `-u` overrides `base_url` so the
page links stay on localhost instead of pointing at the live site. The script
writes `public/views.txt`, without which the Worker answers every beacon with
503. `wrangler dev` reloads on any change under `public/`, so rebuilding while
it runs is picked up without restarting it.

### TIL entries

`content/til/` holds "today I learned" entries: one problem and what solved
it, any length. They take the same front matter as posts minus the `[extra]`
keys, and tags are the taxonomy shared with posts, so a tag page and its feed
list articles and entries together. The index at `/til` (`templates/til.html`)
lists the tags that have entries, with entry counts, then the entries newest
first in the theme's post list rows. Entries are not listed on the homepage,
but the site feed and the search index include them, `/til/atom.xml` is a
feed of entries only, and their views are counted like those of posts.

## View counts

Every post and TIL entry page sends `POST /api/views/<section>/<slug>/`, its
own path after `/api/views`, the first time it is visible in a tab, so a page
opened in a background tab and never shown is not counted. The beacon in
`templates/apollo/body_end.html` sets a flag in `sessionStorage` before
sending, so reloads, back/forward and a closed tab that the browser restores
do not recount; a new tab does, unless it was duplicated from a tab that
already counted or opened by `window.open`, which copy `sessionStorage`. A
request lost in transit is not retried; a reply that says the view was not
counted (429 or 503 below) clears the flag, so the next load in that tab tries
again. Visitors whose browser blocks `sessionStorage` are not counted at all.
The Worker in `worker/index.js` only accepts same-origin requests, ignores
crawlers that render JavaScript, and checks the path against the manifest of
counted pages described under "Deploy". Views past ten a
minute from one address are dropped with 429, so a script cannot inflate a
count or use up the D1 write quota from a single machine; the cap is counted
per Cloudflare location, not globally, and when the edge does not supply the
address it is skipped and logged. It then replies and adds one to the row
for that page and UTC day in the D1 table `views`. Nothing about the visitor is
stored in D1. Workers Logs (enabled in `wrangler.jsonc`) keeps an invocation
log per request, with its URL, headers and status, for its retention period
(three days on the Free plan, seven on Paid). A write that fails is logged,
not retried, as is a rate limiter that cannot be reached (the view is then
counted uncapped). A `views.txt` the Worker cannot read is logged and answered
with 503, so those views are lost. The log is the only sign that views are not
being counted.

The row's key, `path`, is the page path as Zola builds it: `/posts/<slug>/`
for a post, `/til/<slug>/` for an entry, `/posts/<sub>/<slug>/` for a post in
a subsection. It is the same string as the beacon's `data-views` attribute and
the manifest line, so nothing is derived from anything else.

Totals per page:

```sh
npx wrangler d1 execute DB --remote \
  --command "SELECT path, SUM(count) AS views FROM views GROUP BY path ORDER BY views DESC"
```

Daily history for one page:

```sh
npx wrangler d1 execute DB --remote \
  --command "SELECT day, count FROM views WHERE path = '/posts/<slug>/' ORDER BY day"
```

Daily history for every page, newest day first:

```sh
npx wrangler d1 execute DB --remote \
  --command "SELECT day, path, SUM(count) AS views FROM views GROUP BY day, path ORDER BY day DESC, views DESC"
```

The same SQL works in the Cloudflare dashboard (Storage & Databases > D1), and
`npx wrangler d1 export DB --remote --output views.sql` dumps the whole table.
Schema changes are new files in `migrations/`, applied by the deploy workflow
just before `wrangler deploy`. There is no rollback. Between the two steps the
Worker already deployed runs against the new schema. A migration it can still
write to costs nothing; one it cannot (`0002_views_by_path.sql` renamed the
key column) costs the views of that window, each logged as a failed write.
That is accepted for the seconds a deploy takes. A failed deploy leaves the
old Worker under the new schema for as long as it takes to notice, so it is
fixed forward, not left.

## Deploy

Pushing to `main` builds the site on a GitHub-hosted runner, writes the view
counter manifest with `scripts/views-manifest.sh`, applies pending D1
migrations and runs `wrangler deploy`.

The manifest, `public/views.txt`, is the list of pages the Worker counts views
for. The script takes it from the `data-views` attribute of the beacon
`<script>` in every built page (the beacon itself reads the path from that
attribute), so a page is listed exactly when it sends a beacon and section,
pagination and alias paths are never on it. Page content cannot add to it:
Markdown escapes `<` in code spans and blocks, and a raw HTML block, which
Zola passes through, can only produce a beacon that does not name its own
page, which fails the deploy. The script also fails it if no page sends a
beacon or a path is not of the form `/posts/<slug>/` or `/til/<slug>/`, the
two ways the beacon template could drift and make views silently stop being
counted or start being counted on every page. The sections are listed twice
on purpose, in the beacon's condition and in the script's check, so that a
change to one is caught by the other; a new section gets both.

`run_worker_first` in `wrangler.jsonc` sends `/api/*` to the script and
everything else to the asset layer, which serves hits without executing code.
A miss on a navigation request (a stale link) gets the theme's `404.html` from
the asset layer through `not_found_handling`; a miss on any other request (a
scanner, a missing image) is handed to the script, which passes it straight
back to the asset layer, so it gets the same `404.html` at the cost of one
Worker request. Zola emits `<page>/index.html`, matched by
`html_handling = "auto-trailing-slash"`.

The custom domain is created by wrangler on the first deploy, including the
DNS record and certificate. Nothing else may create a DNS record for
`mihai.dinculescu.dev` (an existing record blocks the custom domain).

This repository is public, so its workflow runs and logs are too. Secrets are
masked in logs and are not available to workflows triggered by forks. Keep the
deploy on `push` to `main` only; never add `pull_request_target`.

## One-time setup

1. Create a Cloudflare API token for this site only (Cloudflare dashboard >
   My Profile > API Tokens > Create Token > Create Custom Token):
   - Account > **Workers Scripts: Edit**
   - Account > **D1: Edit**
   - Account > **Account Settings: Read**
   - User > **User Details: Read**
   - User > **Memberships: Read**
   - Zone > **Zone: Read**
   - Zone > **Workers Routes: Read**
   - Account Resources: only this account. Zone Resources: only
     `dinculescu.dev`.

   Workers Scripts uploads the assets and, because `custom_domain = true` uses
   the account-level Workers domains API, also creates the custom domain, its
   DNS record and its certificate. No DNS or SSL permission is needed. D1 is
   for applying migrations to the view counter database. The zone rights are
   for wrangler's pre-deploy checks: it resolves the zone for
   the hostname and lists the zone's Worker routes to detect conflicts, and
   fails with `Authentication error [code: 10000]` on
   `/zones/<id>/workers/routes` without them. The read rights on the account
   and user are what wrangler uses to verify the token and resolve the
   account. Do not reuse the home-lab token; it has far more rights than a
   blog needs.
2. Add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   (Settings > Secrets and variables > Actions).
3. Create the view counter database once, logged in with `npx wrangler login`,
   and put the printed id in `database_id` under `d1_databases` in
   `wrangler.jsonc`. The deploy needs the id in the committed config and the
   command fails if the name already exists, which is why it is not part of the
   workflow.

   ```sh
   npx wrangler d1 create mihai-dinculescu-dev-views
   ```

4. Install the [giscus GitHub app](https://github.com/apps/giscus) on this
   repository; the app cannot be installed through the API. Discussions are
   already enabled and the **Announcements** category is used so only giscus
   and maintainers can open threads; readers reply inside them.
5. Push to `main`, or run the **Deploy** workflow by hand.

## Looking up the giscus IDs again

```sh
gh api graphql -f query='{
  repository(owner:"mihai-dinculescu", name:"mihai.dinculescu.dev") {
    id
    discussionCategories(first:10) { nodes { id name } }
  }
}'
```

Put `repository.id` in `repo_id` and the Announcements node id in
`category_id` under `[extra.giscus]` in `config.toml`.

## Upgrading

- Zola: bump `ZOLA_VERSION` in the workflow and rebuild locally with the same
  version.
- Theme: `git -C themes/apollo pull origin main`, run `zola build`, then commit
  the new submodule pointer. Check `templates/_giscus_script.html` still lines
  up with the theme's `base.html` (it looks for `page.extra.comment` and a
  `<div class="giscus">` mount point) and that the toggle script still exposes
  `updateItemToggleTheme` and the `#darkModeStyle` stylesheet.
