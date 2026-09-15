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
  return { repo, owner: repo.split("/")[0], title: pr.title, url: pr.html_url, sent, merged, closed, state, note, number: pr.number }
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
    [count("closed"), "closed"],
    [byRepo.size, byRepo.size === 1 ? "project" : "projects"],
    [new Set(prs.map((p) => p.owner)).size, "maintainers"],
  ]
  const med = median(mergedDays)
  if (med !== null) cards.push([med < 1 ? "same day" : `${Math.round(med)}d`, "median merge"])
  totals.replaceChildren(...cards.map(([n, label]) => el("div", {}, el("b", { text: String(n) }), el("small", { text: label }))))
  totals.hidden = false

  // Projects in the order of their newest pull request, and each project's list newest first.
  const repos = [...byRepo.entries()].sort((a, b) => b[1][0].sent - a[1][0].sent)
  list.replaceChildren(...repos.map(([repo, items]) => {
    const merged = items.filter((p) => p.state === "merged").length
    const summary = `${items.length} sent, ${merged} merged`
    const head = el("h2", {}, el("a", { href: `https://github.com/${repo}`, target: "_blank", rel: "noopener", text: repo }), el("small", { text: summary }))
    const rows = items.map((p) => el("div", { class: "pr" },
      el("span", { class: `state ${p.state}`, text: p.state }),
      el("a", { class: "title", href: p.url, target: "_blank", rel: "noopener", text: `#${p.number} ${p.title}` }),
      el("span", { class: "when", text: p.sent.toISOString().slice(0, 10) }),
      el("span", { class: "note", text: p.note }),
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
    const items = await fetchAll(user, tokenBox.value.trim())
    render(user, items.map(describe))
    history.replaceState(null, "", `?user=${encodeURIComponent(user)}`)
    document.title = `Upstream: ${user}`
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
