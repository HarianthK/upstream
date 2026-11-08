// Serves the folder, opens the page in headless Chrome for a user, prints what it rendered.
// Run: node scripts/check.mjs <username>   (UPSTREAM_TOKEN=... also exercises the detail pass)
// --fixture answers from scripts/fixtures/api.js instead of GitHub; --expect / --reject TEXT
// (repeatable) fail the check unless some pull request's note does, or does not, contain TEXT.
import { spawn } from "node:child_process"
import http from "node:http"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const server = http.createServer((req, res) => {
  const file = req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]
  try { res.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : "text/html"); res.end(readFileSync(ROOT + file)) }
  catch { res.statusCode = 404; res.end() }
}).listen(4177)
const CHROME = "C:/Users/HARIANTH/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"
const args = process.argv.slice(2)
const flagged = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []))
const fixtureMode = args.includes("--fixture")
const user = args.find((a, i) => !a.startsWith("--") && !["--expect", "--reject", "--markdown"].includes(args[i - 1])) || "HarianthK"
const token = fixtureMode ? "fixture" : process.env.UPSTREAM_TOKEN
const chrome = spawn(CHROME, ["--headless", "--disable-gpu", "--remote-debugging-port=9333", token ? "http://localhost:4177/" : `http://localhost:4177/?user=${user}`], { stdio: "ignore" })
await new Promise((r) => setTimeout(r, 1500))
const targets = await (await fetch("http://localhost:9333/json")).json()
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl)
let id = 0
const send = (method, params = {}) => new Promise((resolve) => { const me = ++id; const on = (e) => { const m = JSON.parse(e.data); if (m.id === me) { ws.removeEventListener("message", on); resolve(m.result) } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id: me, method, params })) })
await new Promise((r) => ws.addEventListener("open", r))
// The page's fetch is replaced with one that answers from the fixture, so nothing reaches GitHub.
function fakeFetch(data) {
  window.fetch = async (url) => {
    const json = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body })
    const path = new URL(url).pathname
    const found = new URL(url).searchParams.get("q")?.includes("type:issue") ? data.issues : data.search
    if (path === "/search/issues") return json({ total_count: found.length, items: found })
    const [, repo, number, part] = path.match(/^\/repos\/([^/]+\/[^/]+)\/(?:pulls|issues)\/(\d+)(?:\/(\w+))?$/)
    const pr = data[`${repo}/${number}`]
    return json(part === "comments" ? pr.comments : part === "reviews" ? [] : pr.pull)
  }
}
await new Promise((r) => setTimeout(r, 800))
if (fixtureMode) {
  const { fixture } = await import("./fixtures/api.js")
  const data = fixture((days) => new Date(Date.now() - days * 86400000).toISOString())
  await send("Runtime.evaluate", { expression: `(${fakeFetch})(${JSON.stringify(data)})` })
}
if (token) {
  await send("Runtime.evaluate", { expression: `document.getElementById("token").value = ${JSON.stringify(token)}; document.getElementById("user").value = ${JSON.stringify(user)}; document.getElementById("form").requestSubmit()` })
  await new Promise((r) => setTimeout(r, fixtureMode ? 2000 : 25000))
} else await new Promise((r) => setTimeout(r, 7000))
const r = await send("Runtime.evaluate", { expression: `JSON.stringify({ status: document.getElementById("status").textContent, totals: [...document.querySelectorAll("#totals div")].map(d => d.textContent), repos: [...document.querySelectorAll(".repo h2")].map(h => h.textContent).slice(0, 6), first: document.querySelector(".pr")?.textContent,
  notes: [...document.querySelectorAll(".pr .note")].map(n => n.textContent), title: document.title })`, returnByValue: true })
const out = JSON.parse(r.result.value)
console.log(JSON.stringify({ ...out, notes: out.notes.slice(0, fixtureMode ? 10 : 6) }, null, 1))
const failed = [
  ...flagged("--expect").filter((t) => !out.notes.some((n) => n.includes(t))).map((t) => `no note contains "${t}"`),
  ...flagged("--reject").filter((t) => out.notes.some((n) => n.includes(t))).map((t) => `a note contains "${t}"`),
]
// --markdown LINE: the copied ledger must hold that line; {d:N} is the date N days ago, as in the fixture.
if (flagged("--markdown").length) {
  const c = await send("Runtime.evaluate", { expression: `new Promise((done) => { navigator.clipboard.writeText = async (t) => done(t); document.getElementById("copy").click() })`, awaitPromise: true, returnByValue: true })
  const md = c.result.value ?? ""
  console.log(md)
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  for (const want of flagged("--markdown").map((t) => t.replace(/\{d:(\d+)\}/g, (_, n) => day(Number(n))))) {
    if (!md.split("\n").includes(want)) failed.push(`the markdown has no line "${want}"`)
  }
}
for (const f of failed) console.error(`check: ${f}`)
chrome.kill(); server.close(); process.exit(failed.length ? 1 : 0)
