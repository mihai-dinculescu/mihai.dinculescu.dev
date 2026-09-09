+++
title = "Give your AI agent a better web fetch capability for free*"
date = 2026-09-09
description = "Claude's built-in web fetch bows to robots.txt and can't run JavaScript. A self-hosted Playwright MCP server behind a free Cloudflare MCP portal fixes both."

[taxonomies]
tags = ["ai", "mcp", "claude", "playwright", "cloudflare", "kubernetes"]

[extra]
comment = true
+++

## Why this suddenly became important to me

I was chilling in bed when my Garmin watch buzzed. New firmware. I don't know
about you, but I always get excited about new software versions, even though I
know deep down that the odds are it's a boring set of changes that won't make
my day any better. Still, an engineer like me put work into shipping it. I
want to know what it brings.

So I open the Claude app on my phone and ask Phoebe (the name Claude goes by
for me) what's new in that version. The reply was unhelpful. Phoebe couldn't
fetch the Garmin forum page that holds the release notes, because the forum's
`robots.txt` forbids it. I tried explaining that she's my personal assistant,
not a crawler, and got nowhere: Claude can't change that setting. Along the
way she admitted a second incriminating fact: she can't run JavaScript either.

## What

Web fetch is the second most important tool an agent has, right after web
search. And the default one that ships with Claude on the web and on the
desktop has two big downsides.

- **It's held to ransom by `robots.txt`.** That mechanism was invented to
  instruct crawlers that sweep an entire site. I'd argue it's the wrong
  instrument for an agent fetching one specific page at the express request of
  a human. The page is public; the human could open it in a tab. The agent is
  just a slower way of reading it.
- **It can't run JavaScript.** A plain fetch is a single HTTP GET. Anything
  rendered client-side, which is a lot of the web, comes back as an empty
  shell.

The solution is surprisingly simple: use a tool that browses the web the way a
human does. And what better candidate than the one we already use to test
modern web apps end to end, by imitating real users as closely as possible?

Enter [Playwright MCP](https://github.com/microsoft/playwright-mcp). It ticks
every box:

- it drives a real browser, so it can click around and wait for JavaScript to
  finish populating the page;
- it's not affected by `robots.txt`, because it's a real (and heavy) browser
  rather than a lightweight crawler;
- it's free and open source, Apache-2.0;
- it can be self-hosted, so nobody else gets your browsing history (or,
  better said, your assistant's 🙃).

There's a bonus I didn't expect. Instead of screenshots, the default output is
an accessibility snapshot: a compact text tree of what's on the page, with
reference ids the model can act on. It's far smaller than raw HTML and it
turns "fetch this page" into "fetch this page, then click Release notes and
scroll".

## How

If you have a Raspberry Pi gathering dust (like I do), or something even
geekier, like a Kubernetes cluster built from a stack of Raspberry Pis that
you struggle to find useful workloads for (like I also do), you can run
Playwright MCP completely for free. One container, half a gigabyte of RAM at
rest, arm64 is fine.

I won't give step-by-step instructions, because your preferred agent can
figure those out. What follows are the points worth handing to it up front,
the ones that cost me time or nearly cost me more. Or just have it read this
page: it renders without JavaScript and its `robots.txt` welcomes everyone.

**Playwright MCP has no authentication of its own, and Claude can't add any.**
The server's README says plainly that it "is not a security boundary".
Anyone who can reach the port owns a browser inside your network. You'd think
a bearer token in front would do, but the connector settings in claude.ai and
Claude Desktop accept a URL and, optionally, OAuth. No custom headers, no
static tokens, no client certificates. So the missing piece is an OAuth layer
you don't have to write.

**Cloudflare's MCP server portal can be that layer, and its free tier is
generous.** It's part of Zero Trust, which is free for up to fifty users. You
register your upstream MCP server with the portal, and the portal publishes it
at a Cloudflare-hosted URL such as `https://mcp.your-domain/mcp`. Cloudflare
Access acts as the OAuth provider, so the login flow is exactly what claude.ai,
Claude Desktop and Claude Code expect. On every call the portal adds a service
token to the upstream request, and an Access application on the upstream
hostname admits only that token. The result is that your server is reachable
through the portal and through nothing else. You also get per-tool
enable/disable and a request log for free.

**cloudflared, another Cloudflare service with a generous free tier, can keep
the server off the internet.** It opens an outbound tunnel from your network
to Cloudflare, so the upstream hostname resolves to Cloudflare and there is no
inbound port on your router. Point the tunnel straight at the Playwright
service. Don't route it through a shared ingress controller, for a reason
that's coming up.

**Playwright MCP drives a real Chromium, without its sandbox, so give the
container as little as possible.** The official image runs headless Chromium
with `--no-sandbox`, which is normal in containers but means a renderer
exploit lands straight in the container's user context. Run it as a non-root
user with a read-only root filesystem, all capabilities dropped, no privilege
escalation, the runtime's default seccomp profile, and no Kubernetes
service-account token mounted, because the server never talks to the API.
Chromium tolerates all of that with three exceptions: it needs a writable
`/tmp`, a `/dev/shm` bigger than the 64 MiB container default or tabs crash,
and a writable home directory or its crash handler aborts the browser on
launch.

**Above all, keep it away from your local network.** Its job is to fetch web
pages from the internet. It has no business reaching anything at home. A
browser will happily open `http://10.43.0.1/` and it will follow redirects
there too; Playwright's own `--blocked-origins` flag is documented as not
being a security boundary. This one bit me. My first version was reachable
through the cluster's ingress controller, which also has an address on the
LAN. Any phone, smart plug or guest on the Wi-Fi could send a request with
the right `Host` header, get an unauthenticated browser session, and drive it
wherever it liked. I proved it with one navigate call to my Vault server's
internal address, which cheerfully returned its health JSON, cluster id and
all. That's server-side request forgery from anything on the Wi-Fi, and the
carefully locked front door was irrelevant because there was a second door.

The fix is network policy in both directions:

- **Ingress:** only from the tunnel pod, only on the server's port.
- **Egress:** cluster DNS, then the whole internet with the private ranges
  carved out: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
  `169.254.0.0/16` and `100.64.0.0/10`.

Then verify it by attacking it. Ask the browser, through the portal, to open
that same internal URL. Before: Vault's JSON. After:
`net::ERR_CONNECTION_REFUSED`. That's the answer you want.

## Was it worth it?

Phoebe now reads Garmin release notes, and everything else I point her at,
including pages that need a login or a scroll. The difference is not speed; a
round trip through Cloudflare to a Raspberry Pi and back takes a few seconds.
The difference is that pages which used to return nothing now return their
content. Given that the whole thing costs nothing beyond electricity for a Pi
that was already plugged in, I'd say the watch firmware was the most
productive boring update I've ever installed.

\* Free as in you already own something to run it on and don't count the
electricity.
