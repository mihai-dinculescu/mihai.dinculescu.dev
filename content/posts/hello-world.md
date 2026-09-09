+++
title = "Hello, world"
date = 2026-09-09
description = "How this site is built and published."

[taxonomies]
tags = ["meta"]

[extra]
comment = true
+++

This site is a [Zola](https://www.getzola.org) build using the
[apollo](https://github.com/not-matthias/apollo) theme. The source is
[on GitHub](https://github.com/mihai-dinculescu/mihai.dinculescu.dev), and
every push to `main` builds the site and publishes it as a
[Cloudflare Worker](https://developers.cloudflare.com/workers/static-assets/)
that serves nothing but static files.

Comments are that repository's GitHub Discussions rendered by
[giscus](https://giscus.app), so you need a GitHub account to leave one. Each
post gets its own thread the first time somebody comments.
