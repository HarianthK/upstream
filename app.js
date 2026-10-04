// Asks GitHub's search for a user's pull requests outside their own repositories,
// then groups them by project. See DOCS.md for what the search can and cannot say.
const form = document.getElementById("form")
const userBox = document.getElementById("user")
const tokenBox = document.getElementById("token")
const go = document.getElementById("go")
const status = document.getElementById("status")
const totals = document.getElementById("totals")
const list = document.getElementById("list")

const API = "https://api.github.com/search/issues"
const PAGE = 100
const DAY = 86400000
// An open pull request nobody has moved for this long is marked stale.
const STALE_DAYS = 14

function say(text, bad = false) {
  status.textContent = text
  status.classList.toggle("bad", bad)
}

async function page(user, n, token) {
  const q = `author:${user} type:pr -user:${user}`
  const url = `${API}?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=${PAGE}&page=${n}`
  const headers = { Accept: "application/vnd.github+json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000
    const wait = reset ? Math.max(1, Math.round((reset - Date.now()) / 60000)) : "a few"
    throw new Error(`GitHub is asking this browser to wait about ${wait} minute(s). A token in the box below lifts the limit.`)
  }
  if (res.status === 422) throw new Error(`GitHub does not know a user called ${user}.`)
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`)
  return res.json()
}

// The search stops at a thousand results; nobody sends more upstream than that.
async function fetchAll(user, token) {
  const items = []
  for (let n = 1; n <= 10; n++) {
    const data = await page(user, n, token)
    items.push(...data.items)
    say(`${items.length} of ${data.total_count} pull requests read`)
    if (items.length >= data.total_count || data.items.length < PAGE) break
  }
  return items
}

function describe(pr) {
  const repo = pr.repository_url.replace("https://api.github.com/repos/", "")
  const sent = new Date(pr.created_at)
  const merged = pr.pull_request?.merged_at ? new Date(pr.pull_request.merged_at) : null
  const closed = pr.closed_at ? new Date(pr.closed_at) : null
  const state = merged ? "merged" : pr.state === "open" ? "open" : "closed"
  const days = (a, b) => Math.max(0, Math.round((b - a) / DAY))
  let note
  if (merged) note = days(sent, merged) === 0 ? "merged the same day" : `merged after ${days(sent, merged)} days`
  else if (closed) note = `closed without merging after ${days(sent, closed)} days`
  else note = `open for ${days(sent, Date.now())} days, ${pr.comments} ${pr.comments === 1 ? "comment" : "comments"}`
  if (pr.draft) note = `draft, ${note}`
  // Without a token the only clock is the last activity of any kind, the author's own included.
  const quiet = state === "open" ? days(new Date(pr.updated_at), Date.now()) : 0
  return { repo, owner: repo.split("/")[0], title: pr.title, url: pr.html_url, sent, merged, closed, state, note, number: pr.number, quiet, stale: quiet >= STALE_DAYS }
}

// With a token the budget allows two requests per pull request: its size and
// who merged it, and whether anyone other than the author has written on it.
async function enrich(prs, token, user) {
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` }
  const get = async (path) => { const r = await fetch(`https://api.github.com/${path}`, { headers }); return r.ok ? r.json() : null }
  let done = 0
  const queue = [...prs]
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const [pull, comments, reviews] = await Promise.all([
        get(`repos/${p.repo}/pulls/${p.number}`),
        get(`repos/${p.repo}/issues/${p.number}/comments?per_page=100`),
        get(`repos/${p.repo}/pulls/${p.number}/reviews?per_page=100`),
      ])
      if (pull) { p.size = `+${pull.additions} -${pull.deletions}`; p.mergedBy = pull.merged_by?.login ?? null }
      // Bots do not count as a reply; the CLA one has a plain user account, so it is named.
      const isBot = (c) => c.user?.type === "Bot" || /\[bot\]$|^CLAassistant$/i.test(c.user?.login ?? "")
      const others = [...(comments || []), ...(reviews || [])].filter((c) => !isBot(c) && c.user?.login && c.user.login !== user)
      const voices = others.map((c) => c.user.login)
      p.answered = voices.length > 0
      p.voices = [...new Set(voices)]
      // With the comments in hand, stale means nobody but the author has written for a while:
      // an author's own nudge resets the activity date but is not an answer.
      if (p.state === "open") {
        const last = Math.max(p.sent.getTime(), ...others.map((c) => Date.parse(c.created_at ?? c.submitted_at)))
        p.waiting = Math.max(0, Math.round((Date.now() - last) / DAY))
        p.stale = p.waiting >= STALE_DAYS
      }
      say(`${++done} of ${prs.length} pull requests read in detail`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}

function fullNote(p) {
  const bits = [p.note]
  if (p.size) bits.push(p.size)
  if (p.mergedBy) bits.push(`by ${p.mergedBy}`)
  else if (p.answered) bits.push(`${p.voices.slice(0, 2).join(" and ")} replied`)
  else if (p.answered === false && p.state === "open") bits.push("no reply yet")
  if (p.stale && p.waiting !== undefined) bits.push(`stale: nobody else has written in ${p.waiting} days`)
  else if (p.stale) bits.push(`stale: quiet for ${p.quiet} days`)
  return bits.join(", ")
}

function median(values) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v
    else if (k === "text") node.textContent = v
    else node.setAttribute(k, v)
  }
  node.append(...children)
  return node
}

function render(user, prs) {
  const byRepo = new Map()
  for (const pr of prs) {
    if (!byRepo.has(pr.repo)) byRepo.set(pr.repo, [])
    byRepo.get(pr.repo).push(pr)
  }
  const mergedDays = prs.filter((p) => p.merged).map((p) => (p.merged - p.sent) / DAY)
  const count = (state) => prs.filter((p) => p.state === state).length
  const cards = [
    [prs.length, "sent"],
    [count("merged"), "merged"],
    [count("open"), "open"],
    [prs.filter((p) => p.stale).length, "stale"],
    [count("closed"), "closed"],
    [byRepo.size, byRepo.size === 1 ? "project" : "projects"],
    [new Set(prs.map((p) => p.owner)).size, "maintainers"],
  ]
  const med = median(mergedDays)
  if (med !== null) cards.push([med < 1 ? "same day" : `${Math.round(med)}d`, "median merge"])
  if (prs.some((p) => p.answered !== undefined)) cards.push([prs.filter((p) => p.answered || p.mergedBy).length, "answered"])
  totals.replaceChildren(...cards.map(([n, label]) => el("div", {}, el("b", { text: String(n) }), el("small", { text: label }))))
  totals.hidden = false

  // Projects in the order of their newest pull request, and each project's list newest first.
  const repos = [...byRepo.entries()].sort((a, b) => b[1][0].sent - a[1][0].sent)
  list.replaceChildren(...repos.map(([repo, items]) => {
    const merged = items.filter((p) => p.state === "merged").length
    const summary = `${items.length} sent, ${merged} merged`
    const head = el("h2", {}, el("a", { href: `https://github.com/${repo}`, target: "_blank", rel: "noopener", text: repo }), el("small", { text: summary }))
    const rows = items.map((p) => el("div", { class: p.stale ? "pr stale" : "pr" },
      el("span", { class: `state ${p.state}`, text: p.state }),
      el("a", { class: "title", href: p.url, target: "_blank", rel: "noopener", text: `#${p.number} ${p.title}` }),
      el("span", { class: "when", text: p.sent.toISOString().slice(0, 10) }),
      el("span", { class: "note", text: fullNote(p) }),
    ))
    return el("section", { class: "repo" }, head, ...rows)
  }))
  say(prs.length ? `${user} has sent ${prs.length} pull requests to ${byRepo.size} ${byRepo.size === 1 ? "project" : "projects"} they do not own.` : `${user} has not sent any pull requests to other people's projects.`)
}

async function lookup(user) {
  user = user.trim().replace(/^@/, "")
  if (!user) return
  go.disabled = true
  totals.hidden = true
  list.replaceChildren()
  say("asking GitHub")
  try {
    const token = tokenBox.value.trim()
    const prs = (await fetchAll(user, token)).map(describe)
    render(user, prs)
    history.replaceState(null, "", `?user=${encodeURIComponent(user)}`)
    document.title = `Upstream: ${user}`
    if (token && prs.length) {
      const summary = status.textContent
      await enrich(prs, token, user)
      render(user, prs)
      say(summary)
    }
  } catch (err) {
    say(err.message, true)
  } finally {
    go.disabled = false
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault()
  lookup(userBox.value)
})

const asked = new URLSearchParams(location.search).get("user")
if (asked) {
  userBox.value = asked
  lookup(asked)
}
