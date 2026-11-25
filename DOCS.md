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

Those runs have one blind spot: they can only see what my pull requests happen
to look like that day. So the check gained a fixture mode. It replaces the
page's `fetch` with one that answers from four canned pull requests whose
dates are counted back from now, so they never age, and `--expect` and
`--reject` turn the printout into a pass or a fail.

The first thing it caught was a real bug. GitHub logins ignore case, but the
detail pass compared the typed name with each commenter exactly, so looking up
`harianthk` counted HarianthK's own comments as replies from somebody else:
rows said "HarianthK replied", and an author's own nudge reset the stale clock,
which is the one thing the comment-reading clock exists to prevent. Typed in
lower case, the fixture's twenty-days-quiet pull request came out not stale.

## Stale, and why it needs two clocks

The search result carries `updated_at`, the last time anything happened to a
pull request. That is free, so without a token it is the clock: two weeks with
no activity at all and an open pull request is marked stale. But it moves for
the author too. Nudging three quiet pull requests the day this was written
reset all three, and the page showed them as freshly active when each had been
waiting on a maintainer for over two weeks.

The token pass already reads every comment and review, so there the clock is
the last thing written by anyone other than the author and not a bot, or the
day the pull request was opened if nobody has. On my own account that is the
difference between 18 stale and 20: the two that only the token pass can see
are exactly the ones I had nudged. Forcing the token pass back onto the
activity date drops the count to 18 again, which is how the check knows the
second clock is the one in use.

## Your turn

Stale answers "who has gone quiet on me". The other question a list of open
pull requests should answer is "who is waiting on me", and with the comments
already fetched it costs nothing: an open pull request is your turn when the
newest comment or review by anybody but the author is newer than the author's
own last word, the opening of the pull request counting as one.

It came from a real miss. A maintainer asked on one of my pull requests whether
I was still interested, and the page showed that row exactly as it showed the
silent ones. Now it reads "your turn: mikeldking wrote yesterday" in the accent
colour, and the totals count how many are waiting. A your-turn row is never
stale too: if a maintainer asked something twenty days ago and I never
answered, calling that row stale would blame them for my silence.

The fixture has one of each: a reply after mine, a nudge of mine after a reply,
a maintainer's question left unanswered for twenty five days, no replies at all,
and a merge. Never marking your turn, letting a your-turn row be stale, and
matching the author's name by exact case each fail the check.

## Issues, from the close reason

The ledger this page replaced had a second table, the issues I had opened, and
the page had no way to show them. It is the same search with `type:issue`, so it
costs one more unsigned request, two for someone with more than a hundred.

Whether an issue was fixed is GitHub's `state_reason`: `completed`,
`not_planned` or `duplicate`, given in the search result itself, so no
per-issue request. An old issue closed before GitHub had reasons comes back
with none and reads as completed, which is what closing meant then. The page
does not try to find the pull request that fixed it; GitHub's timeline knows,
but that is a request per issue, and "closed as completed" already answers the
question.

The fake fetch in `check.mjs` now answers the issue search from its own list:
one open, one completed, one not planned. Four breakages each fail the check:
the search always asking for pull requests, not planned read as completed, the
days counted up to now instead of to the close, and the second render after the
token pass dropping the issues. Live, the page shows the same two issues the
raw search returns for HarianthK.

## Markdown, the way it started

The page began as a markdown ledger kept by hand, so it can give one back. The
export reuses the page's own note for each row, so the two can never say
different things, and escapes any pipe in a title, which would otherwise end
the table cell early. The check stands in for the clipboard, presses the real
button, and holds the copy to lines written out by hand from the fixture, with
dates given as days ago because the fixture's dates move with the clock. The
fixture gained an issue with a pipe in its title for that reason. Eight
breakages, from leaving pipes alone to copying the page title instead of the
ledger, each fail it.

## A refused request is not an empty thread

With a token, each pull request's comments and reviews are fetched to see who
replied. A request GitHub refused, during a rate limit for instance, came back
as `null`, and `null` was read as no comments at all. So a pull request with a
reply from two days ago showed "no reply yet, stale: nobody else has written in
20 days", which is false on both counts and is the opposite of what the page is for.

Now, when either request fails, the pull request says "replies could not be
read" and keeps the plain activity-date view it had before the detail pass.
The fixture has such a pull request, theta, whose comment requests answer 403.
`node scripts/check.mjs --fixture --reject "no reply yet, stale" --expect "replies could not be read"`
failed before the change and passes after it. The other rows print as before.

## A dropped connection is a failed read too

That fix covered a request GitHub answered with an error. A request that never
got an answer at all, because the connection dropped, makes `fetch` throw
instead, and the throw ran out of the detail pass: the status line turned into
"Failed to fetch" and every pull request lost the detail already read for it.
Now `get` turns a throw into `null`, the same as a refusal, so that one pull
request says "replies could not be read" and the rest keep theirs. The fixture
gained iota, whose comment and review requests throw. With `--expect "+5 -1"`
added to the command above, the check failed before the change and passes
after it.

## One day, one comment, one pull request

Every count was printed with a plural noun, so a pull request merged the day
after it was sent read "merged after 1 days", and someone with a single pull
request upstream saw "1 pull requests" in the status line and the copied
ledger. A small `plural()` now writes each count: days in every note, comments,
pull requests, projects and issues.

In the fixture, delta is now merged one day after it was sent.
`node scripts/check.mjs --fixture --expect "merged after 1 day," --reject "1 days"`
fails before and passes after.
