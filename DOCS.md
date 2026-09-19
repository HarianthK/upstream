# Notes on Upstream

## One search, no per-item requests

The first version was going to fetch each pull request for its size and its
reviews. That is one request per pull request, and GitHub gives an unsigned
browser sixty of those an hour. A user with thirty pull requests would spend
half the hour's budget on one look-up, and the page would be useless without a
token. So the page uses only what the search itself returns: title, dates,
state, merged date, comment count. Everything on the page can be produced
from a single search, which is ten requests a minute unsigned and enough for
anyone to try it once.

## Why `-user:USER` and not `-owner:USER`

The search qualifier `user:` matches repositories owned by a user or an
organisation; negating it drops the user's own repositories and keeps
everything else, including repositories in organisations they belong to. That
is the right line for "upstream": a pull request into your employer's
organisation is still one somebody else had to accept.

## Merged, open, closed

GitHub reports a pull request as `open` or `closed`; a merged one is also
`closed`. The search result carries `pull_request.merged_at`, so merged is
read from that and "closed" on the page means closed without merging, which
is the case a person wants to see separately.

## The median

The median time to a merge is over merged pull requests only. A mean would be
dragged by one that sat for a year; the median says what usually happens.
Under a day is shown as "same day" because the search only gives dates to the
second and rounding a few hours to "0d" reads as nothing.

## The second pass

Three requests per pull request: the pull itself for its size and who merged
it, its issue comments, and its reviews. Six run at a time, and the page
renders from the search first so a person sees the list while the pass
runs, then renders again when it finishes. "Replied" means a person who is
not the author wrote a comment or a review; accounts GitHub marks as bots
are skipped, and so is the CLA assistant, which posts from a plain account
on every first pull request and would otherwise make every one look
answered. The rate limit with a token is five thousand an hour, so even a
few hundred pull requests fit in one look-up.

## Rate limit messages

When GitHub answers 403 or 429 it sends the reset time in a header. The page
turns that into "wait about N minutes" rather than a bare error, because the
first thing a person does with a bare error is press the button again, which
makes the wait longer.

## Checked by driving the page

`scripts/check.mjs` serves the folder, opens the page in headless Chrome for a
username, and prints what was rendered: the status line, the totals and the
first rows. It was run on my own account and compared line by line against
the ledger I kept by hand, on a busier account with closed pull requests, and
on a name that does not exist. The page is only as right as those three runs.
