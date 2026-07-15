/**
 * EVOLVEEARTH NERVOUS SYSTEM — self-hosted adapter.
 * ---------------------------------------------------------------
 * Runs the SAME worker.js on any Node 18+ machine: a Hostinger VPS,
 * a Raspberry Pi, your laptop. No dependencies, no build step.
 *
 *   node server.mjs                     # http://localhost:8787
 *   PORT=3000 node server.mjs           # custom port
 *
 * Storage: the ./data folder stands in for Cloudflare KV.
 * Secrets:  a .env file next to this script (KEY=value lines), or
 *           real environment variables. NEVER commit .env.
 *
 * Production (Hostinger VPS quick path):
 *   1) VPS with Node 20 (Ubuntu template is fine; `apt install nodejs npm`
 *      or use nvm). 2) copy this folder up. 3) create .env. 4) keep it
 *      alive: `npm i -g pm2 && pm2 start server.mjs --name evolveearth`
 *   5) put your domain in front with the panel's reverse proxy or nginx +
 *      certbot for HTTPS. Point the app's ⚙ gear at https://api.yourdomain.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
mkdirSync(DATA, { recursive: true });

// ── .env loader (no dependency) ──
const envFile = join(HERE, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ── file-backed KV, same interface the worker expects ──
const fname = (key) => join(DATA, Buffer.from(key).toString("base64url") + ".kv");
const EE_KV = {
  async get(key, type) {
    const f = fname(key);
    if (!existsSync(f)) return null;
    const buf = readFileSync(f);
    if (type === "arrayBuffer") return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return buf.toString("utf8");
  },
  async put(key, value) {
    if (typeof value === "string") writeFileSync(fname(key), value);
    else writeFileSync(fname(key), Buffer.from(value));
  },
  async delete(key) { try { unlinkSync(fname(key)); } catch (e) {} },
};

// ── the same brain, unmodified ──
const worker = (await import("./worker.js")).default;
const env = new Proxy({ EE_KV }, { get: (t, k) => (k in t ? t[k] : process.env[k]) });

const PORT = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: body && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
    });
    const out = await worker.fetch(request, env);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(e).slice(0, 300) }));
  }
}).listen(PORT, () => console.log(`EvolveEarth Nervous System alive on http://localhost:${PORT}\ndata: ${DATA}`));
