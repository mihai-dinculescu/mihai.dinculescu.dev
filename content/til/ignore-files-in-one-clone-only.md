+++
title = "Ignore files in one clone only"
date = 2026-09-23
description = "Patterns in .git/info/exclude work like .gitignore but are never committed."

[taxonomies]
tags = ["git"]

[extra]
comment = true
+++

`.git/info/exclude` takes the same patterns as `.gitignore`, but it lives
inside `.git`, so it is never committed and nobody else sees it. Use it for
scratch files the project doesn't need to know about:

```sh
echo 'plans/' >> .git/info/exclude
```

In a linked worktree `.git` is a file, not a directory. This resolves to the
right file from the main repository and from any worktree:

```sh
echo 'plans/' >> "$(git rev-parse --git-common-dir)/info/exclude"
```

The longer story is in [Two git ignore files nobody told me
about](/posts/two-git-ignore-files-nobody-told-me-about/).
