// Serves the folder, opens the page in headless Chrome for a user, prints what it rendered.
// Run: node scripts/check.mjs <username>
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
const user = process.argv[2] || "HarianthK"
const chrome = spawn(CHROME, ["--headless", "--disable-gpu", "--remote-debugging-port=9333", `http://localhost:4177/?user=${user}`], { stdio: "ignore" })
await new Promise((r) => setTimeout(r, 1500))
const targets = await (await fetch("http://localhost:9333/json")).json()
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl)
let id = 0
const send = (method, params = {}) => new Promise((resolve) => { const me = ++id; const on = (e) => { const m = JSON.parse(e.data); if (m.id === me) { ws.removeEventListener("message", on); resolve(m.result) } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id: me, method, params })) })
await new Promise((r) => ws.addEventListener("open", r))
await new Promise((r) => setTimeout(r, 7000))
const r = await send("Runtime.evaluate", { expression: `JSON.stringify({ status: document.getElementById("status").textContent, totals: [...document.querySelectorAll("#totals div")].map(d => d.textContent), repos: [...document.querySelectorAll(".repo h2")].map(h => h.textContent).slice(0, 6), first: document.querySelector(".pr")?.textContent, title: document.title })`, returnByValue: true })
console.log(JSON.stringify(JSON.parse(r.result.value), null, 1))
chrome.kill(); server.close(); process.exit(0)
