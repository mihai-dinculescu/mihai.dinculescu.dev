+++
title = "Two git ignore files nobody told me about"
date = 2026-09-23
description = "Git reads ignore patterns from .gitignore, .git/info/exclude and a global excludes file. The second one never gets committed, so your scratch files and agent plans can stop dirtying the working tree without anyone else seeing them."

[taxonomies]
tags = ["git", "claude-code"]

[extra]
comment = true
read_time = true
+++

One of my many bad habits is carrying untracked files around in the
repositories I work on.

I did learn, some time ago, that those files must never contain secrets,
because sooner or later they get committed by mistake. I learned it the easy
way, by watching a colleague learn it the hard way: furiously rewriting history
to cover his tracks, then rotating cloud credentials in a panic.

These days the untracked files are harmless. Random markdown notes and, more
often than not, agent plans. I haven't started committing those yet. They go
stale fast, and I'm not convinced they're worth the effort.

So why put up with a permanently dirty working tree? Because until very
recently, the only way I knew to ignore a file in git was to add it to
`.gitignore`. And `.gitignore` gets committed. That's exactly right for things
everyone cloning the repo will have, like the classic `.env`, but pushing the
silly filename I picked for my private notes to a remote repository feels
unclean. So I did nothing, and the untracked files piled up. About ten plans at
the last count.

But then Claude asked, out of the blue, something along the lines of "would you
like me to add these files to `.git/info/exclude`?"

Wait, what? What's that?

## The three ignore files

It turns out git reads ignore patterns from three places, all with the same
syntax.

| Where                                                                              | Who it affects                        | Committed? | Typical use                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `.gitignore`, in any directory                                                     | Everyone who clones the repo          | Yes        | Build output and local environments: `target/`, `__pycache__/`, `.venv/`    |
| `.git/info/exclude`                                                                | Only this clone                       | No         | Your own scratch files that the project doesn't need to know about          |
| Global excludes file, set by `core.excludesFile` (default `~/.config/git/ignore`) | Every repo you work in, on this machine | No         | Editor and OS clutter: `.idea/`, `.vscode/`, `Thumbs.db`, `.DS_Store`       |

The per-repo one, `.git/info/exclude`, is the one I'm giddy about. It lives
inside `.git`, so it can't be committed even by accident, and nobody else ever
sees it. I'll probably move some things into `~/.config/git/ignore` soon too;
editor clutter has no business in any project's `.gitignore`, and yet there it
is, in most of them.

Of course, all of this is laid out very nicely in the [official
documentation](https://git-scm.com/docs/gitignore), if only I'd thought to read
it, or even to search for it. I didn't, and I'd wager that git is the tool most
of us learned by accident.

## Using them

The two new ones are plain text files that take the same patterns as
`.gitignore`. There's no dedicated git command; you just append to them.

Per repo, from the repository root:

```sh
echo 'plans/' >> .git/info/exclude
echo '*.notes.md' >> .git/info/exclude
```

Patterns are matched relative to the repository root, exactly as they would be
in a top-level `.gitignore`. The file is usually already there, with a few
commented-out examples in it. One catch: in a linked git worktree, `.git` is a
file rather than a directory, so the path above won't work. The exclude file
lives in the main repository's `.git/info/exclude` and covers every worktree.
This resolves to the right file from the main repository and from any linked
worktree:

```sh
echo 'plans/' >> "$(git rev-parse --git-common-dir)/info/exclude"
```

Globally:

```sh
mkdir -p ~/.config/git
echo '.DS_Store' >> ~/.config/git/ignore
echo '.idea/' >> ~/.config/git/ignore
```

Git reads `~/.config/git/ignore` automatically if it exists (or
`$XDG_CONFIG_HOME/git/ignore`, if you set that variable); nothing to
configure. If you'd rather keep it somewhere else, point git at it once:

```sh
git config --global core.excludesFile ~/.gitignore_global
```

Whichever file you use, `git status` stops listing the files immediately, as long as they
weren't already tracked; ignore rules never apply to tracked files.

## A note on Claude Code

Since ignoring agent plans has been the running example: by default, Claude
Code leaves ignored files out of the autocomplete you get when you reference a
file with `@`, so the moment your plans go into `.git/info/exclude` they vanish
from the picker.

To get them back, add this to your `settings.json` (or flip **Respect
.gitignore in file picker** in `/config`):

```json
{
  "respectGitignore": false
}
```

This is only about the `@` autocomplete. Claude Code can read the files
regardless of the setting; it just won't offer them as you type. The
[settings reference](https://code.claude.com/docs/en/settings-reference#respectgitignore)
has the details.

So yeah, there you go. If, like me, you only knew about `.gitignore` and were
skittish about sharing your note-taking habits with everyone on the project,
you can now have a clean working tree without feeling exposed.

{{<ai_disclaimer />}}
