# mihai.dinculescu.dev

Personal site built with [Zola](https://www.getzola.org) and the
[apollo](https://github.com/not-matthias/apollo) theme, served as a Cloudflare
Worker that only carries static assets. Comments are this repository's GitHub
Discussions, rendered by [giscus](https://giscus.app).

| Piece          | Where                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Content        | `content/` (`posts/` for articles; `_index.md` is the homepage)                |
| Theme          | `themes/apollo` git submodule, pinned to the commit recorded in this repo      |
| Site config    | `config.toml`                                                                  |
| Comments embed | `templates/_giscus_script.html` (overrides the theme's utterances placeholder) |
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
+++
```

`zola check` validates internal and external links before pushing.

## Deploy

Pushing to `main` builds the site on a GitHub-hosted runner and runs
`wrangler deploy`. The Worker is assets-only: `wrangler.jsonc` has no `main`,
so requests never execute code and asset requests are not billed. Zola emits
`<page>/index.html`, matched by `html_handling = "auto-trailing-slash"`; the
theme's `404.html` is served for unknown paths.

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
   - Account > **Account Settings: Read**
   - User > **User Details: Read**
   - User > **Memberships: Read**
   - Zone > **Zone: Read**
   - Zone > **Workers Routes: Read**
   - Account Resources: only this account. Zone Resources: only
     `dinculescu.dev`.

   Workers Scripts uploads the assets and, because `custom_domain = true` uses
   the account-level Workers domains API, also creates the custom domain, its
   DNS record and its certificate. No DNS or SSL permission is needed. The
   zone rights are for wrangler's pre-deploy checks: it resolves the zone for
   the hostname and lists the zone's Worker routes to detect conflicts, and
   fails with `Authentication error [code: 10000]` on
   `/zones/<id>/workers/routes` without them. The read rights on the account
   and user are what wrangler uses to verify the token and resolve the
   account. Do not reuse the home-lab token; it has far more rights than a
   blog needs.
2. Add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   (Settings > Secrets and variables > Actions).
3. Install the [giscus GitHub app](https://github.com/apps/giscus) on this
   repository; the app cannot be installed through the API. Discussions are
   already enabled and the **Announcements** category is used so only giscus
   and maintainers can open threads; readers reply inside them.
4. Push to `main`, or run the **Deploy** workflow by hand.

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
