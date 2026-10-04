# Upstream

Every pull request a GitHub user has sent to somebody else's project, and what
became of it. Type a username and you get the list grouped by project, with
each one marked merged, open or closed, how long it took, and the totals at
the top: sent, merged, open, closed, how many projects and maintainers, and
the median time to a merge.

Live at [upstream-prs.vercel.app](https://upstream-prs.vercel.app). The address
bar carries the username, so `?user=HarianthK` is a link you can send.

## Why

GitHub's own profile counts contributions, but it counts everything: commits
to your own repositories, issues, comments. It does not answer the question
that matters when you are trying to work on other people's projects: which
of my pull requests did a maintainer actually take? I kept that record by hand
in a markdown file for a week and wanted it as a page anybody could open.

## How it works

One request type, GitHub's issue search, asked from your browser:

    author:USER type:pr -user:USER

That is every pull request written by the user in a repository the user does
not own. The search says when each was sent, whether it is open, and when it
was merged or closed, which is all the page needs. Nothing is stored anywhere;
there is no server of mine in between.

Two limits come with that. GitHub allows ten unsigned searches a minute and
stops any search at a thousand results, so a very busy account is cut off at
its newest thousand. A fine-grained token with no permissions at all lifts the
rate limit; the box for it is on the page, and the token is only ever sent to
`api.github.com`.

## With a token

Without a token the page uses only the search, because anything more is a
request per pull request and the unsigned budget is sixty an hour. With a
token in the box it does a second pass, three requests per pull request, and
each row gains its size, who merged it, or who has replied (people only;
bots and the CLA assistant do not count), with "no reply yet" on the open
ones nobody has touched. The totals gain an "answered" count: pull requests
a person other than the author has written on or merged. The list is shown
from the search first and updated when the pass finishes.

## Stale

An open pull request that nobody has moved for two weeks is marked stale, in
amber, and counted in the totals. Without a token the clock is GitHub's last
activity date, which an author's own comment resets, so a nudge makes a pull
request look fresh. With a token the clock is the last time anyone other than
the author wrote on it, which is the question that matters: is it waiting on
them?

## What it does not know

The comment count in the search includes the author's own comments, which is
why the token pass reads who actually replied. Pull requests to repositories inside an
organisation the user belongs to still count as upstream, since the search
only excludes repositories the user owns outright.

## Running it

Static files, no build. Open `index.html` from any local web server; the
GitHub API refuses `file://` pages.

    npx serve .

`node scripts/check.mjs <user>` renders the page in headless Chrome and prints
what it showed; with `UPSTREAM_TOKEN` set it exercises the detail pass too.
`node scripts/deploy.mjs` deploys to Vercel and then checks that the live site
is serving exactly the files in this folder.

## Notes

See [DOCS.md](DOCS.md) for the reasoning behind the choices above.
