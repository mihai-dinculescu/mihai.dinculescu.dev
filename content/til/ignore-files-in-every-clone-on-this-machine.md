+++
title = "Ignore files in every clone on this machine"
date = 2026-09-23
description = "Git reads ~/.config/git/ignore on top of every repository's .gitignore."

[taxonomies]
tags = ["git"]
+++

Git reads a global excludes file in addition to each repository's `.gitignore`.
By default it is `~/.config/git/ignore`, read automatically if it exists, so
editor and OS clutter never needs to go in a project's `.gitignore`:

```sh
mkdir -p ~/.config/git
echo '.DS_Store' >> ~/.config/git/ignore
echo '.idea/' >> ~/.config/git/ignore
```

The longer story is in [Two git ignore files nobody told me
about](/posts/two-git-ignore-files-nobody-told-me-about/).
