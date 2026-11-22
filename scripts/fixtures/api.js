// Canned GitHub answers for check.mjs --fixture. Times are days before now, so the fixture never ages.
// HarianthK wrote last on beta (a nudge), mike wrote last on alpha, zed wrote on epsilon long ago and
// was never answered; gamma has no replies; delta is merged; theta's replies could not be fetched.
const pr = (repo, number, title, sent, extra = {}) => ({
  repository_url: `https://api.github.com/repos/${repo}`, html_url: `https://github.com/${repo}/pull/${number}`,
  number, title, state: "open", draft: false, comments: 0, created_at: sent, updated_at: sent, closed_at: null,
  pull_request: { merged_at: null }, ...extra,
})
const issue = (repo, number, title, sent, extra = {}) => ({
  repository_url: `https://api.github.com/repos/${repo}`, html_url: `https://github.com/${repo}/issues/${number}`,
  number, title, state: "open", state_reason: null, comments: 0, created_at: sent, closed_at: null, ...extra,
})
const said = (login, ago) => ({ user: { login, type: "User" }, created_at: ago })

export const fixture = (ago) => ({
  issues: [
    issue("owner/alpha", 6, "Alpha crashes", ago(9), { comments: 1 }),
    issue("owner/beta", 7, "Beta is slow", ago(20), { state: "closed", state_reason: "completed", closed_at: ago(15), comments: 3 }),
    issue("owner/gamma", 8, "Gamma could do more", ago(12), { state: "closed", state_reason: "not_planned", closed_at: ago(10), comments: 1 }),
    issue("owner/zeta", 9, "Fails on a | b", ago(2)),
  ],
  search: [
    pr("owner/alpha", 1, "Alpha fix", ago(30), { comments: 2, updated_at: ago(10) }),
    pr("owner/beta", 2, "Beta fix", ago(30), { comments: 2, updated_at: ago(5) }),
    pr("owner/gamma", 3, "Gamma fix", ago(3)),
    pr("owner/epsilon", 5, "Epsilon fix", ago(40), { comments: 1, updated_at: ago(25) }),
    pr("owner/theta", 10, "Theta fix", ago(20), { comments: 3, updated_at: ago(2) }),
    pr("owner/delta", 4, "Delta fix", ago(40), { state: "closed", closed_at: ago(38), updated_at: ago(38), pull_request: { merged_at: ago(38) } }),
  ],
  "owner/alpha/1": { pull: { additions: 5, deletions: 1, merged_by: null }, comments: [said("HarianthK", ago(12)), said("mike", ago(10))] },
  "owner/beta/2": { pull: { additions: 7, deletions: 2, merged_by: null }, comments: [said("mike", ago(20)), said("HarianthK", ago(5))] },
  "owner/epsilon/5": { pull: { additions: 2, deletions: 2, merged_by: null }, comments: [said("zed", ago(25))] },
  "owner/gamma/3": { pull: { additions: 1, deletions: 0, merged_by: null }, comments: [] },
  // GitHub refused the comments and reviews (a rate limit, say), so nothing is known about replies.
  "owner/theta/10": { pull: { additions: 3, deletions: 1, merged_by: null }, comments: [said("tess", ago(2))], fail: true },
  "owner/delta/4": { pull: { additions: 9, deletions: 3, merged_by: { login: "dee" } }, comments: [said("dee", ago(38))] },
})
