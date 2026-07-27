/**
 * Snagged Reviews — admin backend (Cloudflare Worker).
 *
 * Holds the GitHub token as a server-side secret so admins (e.g. an EA) only
 * need the PASSWORD — no token ever touches the browser. The /admin page talks
 * to this Worker; the Worker reads/writes data/reviews.json in the repo, which
 * triggers the "Build site" Action to republish index.html.
 *
 * Secrets (set with `wrangler secret put ...`):
 *   GITHUB_TOKEN    fine-grained PAT with Contents: Read and write on the repo
 *   ADMIN_PASSWORD  the password admins type to sign in
 *
 * Optional vars (wrangler.toml [vars], defaults shown):
 *   REPO_OWNER=snaggeddomains  REPO_NAME=snagged-reviews
 *   BRANCH=main                FILE_PATH=data/reviews.json
 *
 * Endpoints (both require header  X-Admin-Password):
 *   GET  /reviews  -> { reviews: [...] }
 *   PUT  /reviews  -> body { reviews: [...] }  commits and returns { ok: true }
 */

const DEFAULTS = { owner: "snaggeddomains", name: "snagged-reviews", branch: "main", path: "data/reviews.json" };

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // --- auth (constant-time) ---
    const supplied = request.headers.get("X-Admin-Password") || "";
    if (!env.ADMIN_PASSWORD || !timingSafeEqual(supplied, env.ADMIN_PASSWORD)) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    const url = new URL(request.url);
    const cfg = {
      owner: env.REPO_OWNER || DEFAULTS.owner,
      name: env.REPO_NAME || DEFAULTS.name,
      branch: env.BRANCH || DEFAULTS.branch,
      path: env.FILE_PATH || DEFAULTS.path,
    };

    try {
      if (url.pathname.replace(/\/$/, "").endsWith("/reviews")) {
        if (request.method === "GET") {
          const file = await getFile(env, cfg);
          return json({ reviews: JSON.parse(file) }, 200, cors);
        }
        if (request.method === "PUT") {
          const body = await request.json().catch(() => ({}));
          if (!Array.isArray(body.reviews)) return json({ error: "body.reviews (array) required" }, 400, cors);
          const content = JSON.stringify(body.reviews, null, 2) + "\n";
          await putFile(env, cfg, content, body.message || "Update reviews via admin");
          return json({ ok: true, count: body.reviews.length }, 200, cors);
        }
      }
      return json({ error: "not found" }, 404, cors);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502, cors);
    }
  },
};

// --- GitHub helpers ---
function gh(env, path, opts = {}) {
  opts.headers = Object.assign({
    Authorization: "Bearer " + env.GITHUB_TOKEN,
    Accept: "application/vnd.github+json",
    "User-Agent": "snagged-admin-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  }, opts.headers || {});
  return fetch("https://api.github.com" + path, opts);
}

async function getFile(env, cfg) {
  const res = await gh(env, `/repos/${cfg.owner}/${cfg.name}/contents/${cfg.path}?ref=${cfg.branch}&t=${Date.now()}`);
  if (!res.ok) throw new Error("GitHub GET " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  return b64decode(data.content);
}

async function putFile(env, cfg, content, message) {
  // Fetch the current blob sha so the update is a clean, conflict-safe commit.
  let sha;
  const cur = await gh(env, `/repos/${cfg.owner}/${cfg.name}/contents/${cfg.path}?ref=${cfg.branch}&t=${Date.now()}`);
  if (cur.ok) sha = (await cur.json()).sha;
  const res = await gh(env, `/repos/${cfg.owner}/${cfg.name}/contents/${cfg.path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: b64encode(content), sha, branch: cfg.branch }),
  });
  if (!res.ok) throw new Error("GitHub PUT " + res.status + ": " + (await res.text()).slice(0, 200));
  return res.json();
}

// --- utils ---
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ "Content-Type": "application/json" }, cors) });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob((b64 || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
