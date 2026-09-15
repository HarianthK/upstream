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

## What it does not know

The search does not say how big a pull request is, whether a maintainer
replied, or who merged it; each of those is another request per pull request,
which would burn the unsigned limit in one look-up. The comment count it shows
includes the author's own comments. Pull requests to repositories inside an
organisation the user belongs to still count as upstream, since the search
only excludes repositories the user owns outright.

## Running it

Static files, no build. Open `index.html` from any local web server; the
GitHub API refuses `file://` pages.

    npx serve .

`node scripts/deploy.mjs` deploys to Vercel and then checks that the live site
is serving exactly the files in this folder.

## Notes

See [DOCS.md](DOCS.md) for the reasoning behind the choices above.
