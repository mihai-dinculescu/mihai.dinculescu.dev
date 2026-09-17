#!/usr/bin/env sh
# Writes public/posts.txt, the post paths worker/index.js counts views for, from
# the `data-views` attribute of the beacon (templates/apollo/body_end.html) in
# every built page. README.md ("Deploy") describes why and what the checks
# below guard against. Run after `zola build`.
set -eu

# Each match is paired with the path of the page it was found in. The minifier
# drops the quotes around the value, so both forms are accepted.
pairs=$(grep -rHoE '<script data-views="?/[^" >]+' public --include=index.html |
  sed -E 's#^public(/.*/)index\.html:<script data-views="?#\1 #')

# Markdown escapes `<` in code spans and blocks, but a raw HTML block in a post
# is passed through, so a post could carry a beacon for any path. A beacon that
# does not name its own page is therefore never listed; it fails the deploy.
if ! printf '%s\n' "$pairs" |
  awk 'NF && $1 != $2 { print; bad = 1 } END { exit bad }'; then
  echo "beacons above do not name the page they were found in" >&2
  exit 1
fi
printf '%s\n' "$pairs" | awk 'NF { print $1 }' | sort -u > public/posts.txt

if ! test -s public/posts.txt; then
  echo "no built page sends a view beacon" >&2
  exit 1
fi
if grep -vE '^/posts/.+/$' public/posts.txt; then
  echo "beacon paths above are not of the form /posts/<slug>/" >&2
  exit 1
fi
echo "$(wc -l < public/posts.txt | tr -d ' ') post pages send a beacon and are listed"
