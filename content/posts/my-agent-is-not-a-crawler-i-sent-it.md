+++
title = "My agent is not a crawler. I sent it."
date = 2026-09-17
description = "robots.txt was written for crawlers that traverse the web unattended, not for an agent fetching one page because a human asked. Cloudflare's new Search, Training and Agent controls finally let site owners say which one they mean."

[taxonomies]
tags = ["ai", "agents", "claude", "cloudflare", "robots-txt"]

[extra]
comment = true
read_time = true
+++

Last week I published [A better web fetch for your AI agent, for
free*](https://mihai.dinculescu.dev/posts/better-web-fetch-for-your-ai-agent/),
and a chunk of the internet was not pleased.

The backstory: I asked Claude to fetch a page for me, it refused because of the
site's robots.txt, and I wasn't OK with that. So I set up my own fetch tool that
drives a real browser. A real browser doesn't consult robots.txt, exactly like
the one you're reading this in.

Some of the replies on Reddit:

> Congrats, you made a tool to fuck over website owners who don't want your bot
> accessing it. There's a reason they put it there. Just respect it.

> Awesome you made an add on to steal from websites to use with your not-at-all
> self-hosted claude account. You're being so entitled that I can't even

> It's unethical to do things like this. They didn't want your agent on the
> site, and you bypassed it. They'd preferably ban your account.

Me getting abuse isn't the point. The point is that I think this view is
outdated, and that it doesn't help anyone, site owners included.

Six days after my post, Cloudflare published [Have it both ways: stay
discoverable in search while disallowing AI
training](https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/#new-security-setting-options).
I think it moves this argument forward, constructively, and it's worth
explaining why.

## robots.txt predates the thing we're arguing about

robots.txt dates from the 90s. It was designed to give site owners some say over
crawlers: systems that, by design, work their way through large swathes of the
internet unattended. One line, `User-agent: *`, addresses all of them at once,
because back then "robot" meant one thing.

It doesn't any more. Cloudflare classifies bots by behaviour and gives site
owners controls for three of them. I think it's the right lens:

- **Training:** crawling to feed a model.
- **Search:** crawling to build an index.
- **Agent:** a user-directed visit to a page on behalf of a human. Chat fetch
  tools and browser-driving agents live here.

Most people, me included, agree that creators should be able to keep their work
out of training sets. Most of those same creators want to be found in search.
Cloudflare's own numbers back this up: fewer than 1% of their sites block search
bots, while 17% block training. And I'd argue that, more often than not, they're
also fine with an agent fetching a page because a human specifically asked it
to. That isn't crawling. It's one person reading one page, with a tool in
between.

Your browser is the same arrangement: software fetching a page because a person
asked it to. That's why browsers have never checked robots.txt, and why nobody
thinks they should. The [original 1994
standard](https://www.robotstxt.org/orig.html) is explicit about who it's for.
It defines robots as programs that "traverse many pages" by recursively
following links. One page, fetched once, at a person's request, was never the
thing it set out to govern.

The argument isn't new, either. In 2002, someone complained on the W3C validator
mailing list that its tool didn't follow robots.txt. [One
reply](https://lists.w3.org/Archives/Public/www-validator/2002Dec/0200.html)
drew the line exactly where I'm drawing it: a tool that recursively follows
links should obey the protocol, but for a single check requested by a user, "I
don't think it's really acting as a robot". W3C's recursive link checker gained
robots.txt support in 2004.

A blanket Disallow can't tell these three apart. Cloudflare says as much: the
Internet, they write, "does not yet have a well-established directive for
expressing Disallow preferences to agents", which is why their new Disallow
setting exists for training only.

## My case

Garmin's forum [robots.txt](https://forums.garmin.com/robots.txt) has a single
rule block, addressed to `User-agent: *`. It lists the usual housekeeping paths
(search results, tag pages, member profiles, admin screens) and, at the bottom,
the beta programme. No AI crawler is named anywhere. It's a file written to keep
indexers out of places that shouldn't be indexed, and I completely understand
why the beta section is on that list.

Run it through the three behaviours. Training: presumably Garmin doesn't want
it, fair enough. Search: same. Agent: the file can't say. A wildcard written for
indexers is all there is.

My request was squarely the third kind: "Hey Phoebe (that's what my Claude calls
itself), go and fetch the release notes for beta version 23.32." I don't believe
whoever wrote that Disallow line had this in mind, and I can't see what it costs
Garmin. So no, I don't feel I screwed anyone over.

## What Cloudflare changed

I won't rehash the whole post, but the shape of it: site owners get separate
controls for Search, Training and Agent, each of which can be set to allow,
block, or block only on pages serving ads. New this week is a Disallow AI
Training option that keeps you in search while opting out of training, even for
crawlers like Googlebot that do both jobs.

Two details stood out. The default Cloudflare recommends for a new site without
ads is to allow agents. For ad-funded sites, it's to block agents only on pages
that serve ads, and that's fair: an agent fetches the page with nobody there to
see the ad. That's a real cost, and a far better reason to turn an agent away
than a wildcard written decades before agents existed.

This cuts both ways, and I'll say it before someone else does. If a site owner
goes into that dashboard and sets Agent to Block, that's an informed, specific
"no" aimed at exactly my use case, and it deserves respect in a way a legacy
wildcard doesn't. Once owners can say precisely what they mean, agents can
honour precisely what they said.

That's the conversation worth having. "Just respect robots.txt" isn't it.

{{<ai_disclaimer />}}
