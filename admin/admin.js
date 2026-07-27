/* Snagged Reviews — admin app.
   Static-site admin: password-gates the UI, then reads/writes data/reviews.json
   through the GitHub Contents API. Committing to main triggers the "Build site"
   Action, which runs scripts/build.py and republishes index.html.

   The card rendering below is a faithful JS port of scripts/build.py so the live
   preview is identical to production. If you change build.py's card markup,
   mirror it here. */
(function () {
  "use strict";

  // ---- config ----
  var REPO = { owner: "snaggeddomains", name: "snagged-reviews", branch: "main", path: "data/reviews.json" };

  // BACKEND MODE (recommended for multiple users, e.g. an EA):
  // Deploy worker/admin-worker.js (see worker/README.md) and paste its URL here.
  // When set, the admin publishes through the Worker and users only need the
  // PASSWORD — no GitHub token in the browser. Leave "" to use token mode.
  var BACKEND_URL = "";

  // TOKEN MODE only: SHA-256 of the admin password. Default is "snagged2026".
  // To change it, run:  printf '%s' 'YOUR NEW PASSWORD' | shasum -a 256
  // and paste the hex digest here. (In backend mode the password is the
  // Worker's ADMIN_PASSWORD secret, and this hash is not used.)
  var PASS_HASH = "5c3c8d0aec5f4ae73b9e78dee5fe8c86d0c4daa0b623241f7cc2960e07e13c15";
  var TOKEN_KEY = "sr_admin_token";
  var MODE = BACKEND_URL ? "backend" : "token";

  // ---- state ----
  var token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
  var adminPassword = sessionStorage.getItem("sr_admin_pw") || ""; // backend mode only
  var reviews = [];      // working copy
  var baseline = "[]";   // JSON of last-loaded/last-published state (for dirty check)
  var fileSha = null;    // git blob sha of data/reviews.json (needed to PUT)
  var editing = null;    // index being edited, or null when adding

  var $ = function (id) { return document.getElementById(id); };

  // ---- SVG (copied from build.py) ----
  var SVG = {
    star: '<svg viewBox="0 0 24 24" fill="#f5a623" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.9 6.1 21l1.1-6.45-4.7-4.6 6.5-.95z"/></svg>',
    vbadge: '<svg class="vbadge" viewBox="0 0 24 24" aria-label="Verified account" role="img"><path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/><path fill="#fff" d="M9.8 16.3l-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 1.6h3.5l-7.6 8.7 9 11.9h-7l-5.5-7.2-6.3 7.2H1.5l8.1-9.3L1 1.6h7.2l5 6.6zM17.7 20h1.9L7.1 3.6H5z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>',
    quote: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.5 6C5 6 3 8 3 10.6 3 13 4.8 15 7.2 15c.2 0 .5 0 .7-.1-.5 1.6-1.9 2.8-3.6 3.2l.6 1.9c3.4-.8 6-3.8 6-7.6V10.6C10.9 8 8.9 6 7.5 6zm9.3 0c-2.5 0-4.5 2-4.5 4.6 0 2.4 1.8 4.4 4.2 4.4.2 0 .5 0 .7-.1-.5 1.6-1.9 2.8-3.6 3.2l.6 1.9c3.4-.8 6-3.8 6-7.6V10.6C20.2 8 18.2 6 16.8 6z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'
  };
  var SRC_ICON = { x: SVG.x, email: SVG.email, text: SVG.text, direct: SVG.quote };
  var SRC_LABEL = { x: "X (Twitter)", email: "Email", text: "Text message", direct: "Direct testimonial" };

  // ---- render helpers (ports of build.py) ----
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  var DOMAIN_RE = /\b([A-Za-z0-9][A-Za-z0-9-]*\.(?:com|ai|net|st|gg|so|io))\b(\/[^\s<]*)?/gi;
  var MENTION_RE = /@([A-Za-z0-9_]+)/g;

  function inline(t) {
    t = esc(t); // escape only & < > (matches html.escape(quote=False))
    t = t.replace(MENTION_RE, '<span class="mention">@$1</span>');
    t = t.replace(DOMAIN_RE, function (m) { return '<span class="domain">' + m + "</span>"; });
    return t;
  }
  function renderText(text) {
    var paras = text.trim().split(/\n\s*\n/);
    return paras.map(function (p) {
      return "<p>" + inline(p).replace(/\n/g, "<br>") + "</p>";
    }).join("\n");
  }
  function initials(name) {
    var parts = name.split(/[\s—·]+/).filter(function (p) { return p && /[A-Za-z0-9]/.test(p[0]); });
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function avatarColors(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
    var hue = h % 360;
    return ["hsl(" + hue + " 62% 54%)", "hsl(" + ((hue + 28) % 360) + " 66% 44%)"];
  }

  function cardHTML(t) {
    var src = t.source;
    var c = avatarColors(t.name || "");
    var avatar = t.anon
      ? '<div class="avatar" style="--a:' + c[0] + ";--b:" + c[1] + '">' + SVG.quote + "</div>"
      : '<div class="avatar" style="--a:' + c[0] + ";--b:" + c[1] + '">' + esc(initials(t.name || "")) + "</div>";

    var meta = [];
    if (t.handle) meta.push('<span class="handle">@' + esc(t.handle) + "</span>");
    if (t.role) meta.push('<span class="role">' + esc(t.role) + "</span>");
    var nameHTML = esc(t.name || "") + (t.verified ? SVG.vbadge : "");

    var actions = [];
    if (t.url) actions.push('<a class="linkbtn" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + SVG.x + "View on X</a>");
    if (t.shot && !t.url) actions.push('<button type="button" class="linkbtn">' + SVG.eye + "View screenshot</button>");
    var actionsHTML = actions.length ? '<div class="card__actions">' + actions.join("") + "</div>" : "<span></span>";

    var dateHTML = '<span class="card__date">' + (t.date ? esc(t.date) : "") + "</span>";
    var domainTag = t.domain ? '\n<span class="tag-domain">' + SVG.arrow + "Acquired " + esc(t.domain) + "</span>" : "";

    return '<article class="card" data-source="' + src + '" data-featured="' + (t.featured ? "true" : "false") + '">' +
      '<div class="card__head">' + avatar +
      '<div class="card__id"><div class="card__name">' + nameHTML + "</div>" +
      '<div class="card__meta">' + meta.join(" · ") + "</div></div>" +
      '<div class="src src--' + src + '" title="' + SRC_LABEL[src] + '" aria-label="' + SRC_LABEL[src] + '">' + SRC_ICON[src] + "</div></div>" +
      '<div class="card__body">' + renderText(t.text || "") + "</div>" + domainTag +
      '<div class="card__foot">' + dateHTML + actionsHTML + "</div></article>";
  }

  // ---- base64 (unicode-safe) ----
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---- toast ----
  var toastTimer;
  function toast(msg, kind) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "a-toast" + (kind ? " is-" + kind : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, kind === "err" ? 6000 : 3500);
  }

  // ---- GitHub API ----
  function gh(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }, opts.headers || {});
    return fetch("https://api.github.com" + path, opts);
  }

  function apiBase() {
    return "/repos/" + REPO.owner + "/" + REPO.name + "/contents/" + REPO.path;
  }
  function backendBase() { return BACKEND_URL.replace(/\/$/, ""); }
  function isAuthed() { return MODE === "backend" ? !!adminPassword : !!token; }

  // Fetch the current reviews array. Throws Error with .status on failure.
  async function apiGet() {
    if (MODE === "backend") {
      var res = await fetch(backendBase() + "/reviews", { headers: { "X-Admin-Password": adminPassword } });
      if (!res.ok) { var e = new Error("HTTP " + res.status); e.status = res.status; throw e; }
      var j = await res.json();
      fileSha = null;
      return j.reviews;
    }
    var r = await gh(apiBase() + "?ref=" + REPO.branch + "&t=" + Date.now());
    if (!r.ok) { var e2 = new Error("HTTP " + r.status); e2.status = r.status; throw e2; }
    var data = await r.json();
    fileSha = data.sha;
    return JSON.parse(b64decode(data.content));
  }

  // Commit the working reviews array. Returns the fetch Response.
  async function apiPut() {
    if (MODE === "backend") {
      return fetch(backendBase() + "/reviews", {
        method: "PUT",
        headers: { "X-Admin-Password": adminPassword, "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: reviews, message: "Update reviews via admin" })
      });
    }
    var body = JSON.stringify(reviews, null, 2) + "\n";
    return gh(apiBase(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Update reviews via admin", content: b64encode(body), sha: fileSha, branch: REPO.branch })
    });
  }

  async function loadReviews() {
    if (!isAuthed()) { renderList(); return; }
    try {
      reviews = await apiGet();
      baseline = JSON.stringify(reviews);
      editing = null;
      renderList();
      renderPreview();
      toast("Loaded " + reviews.length + " reviews.", "ok");
    } catch (e) {
      if (e.status === 401) toast("Not authorized (401). Check the password" + (MODE === "token" ? "/token." : "."), "err");
      else if (e.status === 404) toast("Could not find data/reviews.json in the repo.", "err");
      else toast("Load failed: " + e.message, "err");
    }
  }

  async function publish() {
    if (!isAuthed()) { toast(MODE === "backend" ? "Sign in first." : "Add a GitHub token first.", "err"); return; }
    var btn = $("btn-publish");
    btn.disabled = true; btn.textContent = "Publishing…";
    try {
      var res = await apiPut();
      if (res.status === 409) { toast("Conflict — data changed. Reloading…", "err"); await loadReviews(); return; }
      if (!res.ok) { var t = await res.text(); toast("Publish failed (" + res.status + "): " + t.slice(0, 140), "err"); return; }
      if (MODE === "token") { var j = await res.json(); fileSha = j.content.sha; }
      baseline = JSON.stringify(reviews);
      updateDirty();
      toast("Published! The site rebuilds in ~1 minute.", "ok");
    } catch (e) {
      toast("Publish error: " + e.message, "err");
    } finally {
      btn.textContent = "Publish to site";
      updateDirty();
    }
  }

  // ---- dirty tracking ----
  function isDirty() { return JSON.stringify(reviews) !== baseline; }
  function updateDirty() {
    var dirty = isDirty();
    $("dirty-flag").hidden = !dirty;
    $("btn-discard").hidden = !dirty;
    $("btn-publish").disabled = !dirty || !isAuthed();
    $("count-label").textContent = reviews.length + (reviews.length === 1 ? " review" : " reviews");
  }

  // ---- list ----
  function renderList() {
    var ul = $("review-list");
    ul.innerHTML = "";
    reviews.forEach(function (t, i) {
      var li = document.createElement("li");
      li.className = "a-item" + (editing === i ? " is-editing" : "");
      var short = (t.text || "").replace(/\s+/g, " ").trim();
      li.innerHTML =
        '<span class="a-item__badge src--' + t.source + '" title="' + SRC_LABEL[t.source] + '">' + SRC_ICON[t.source] + "</span>" +
        '<div class="a-item__body"><div class="a-item__name">' + esc(t.name || "(no name)") +
          (t.featured ? " ★" : "") + '</div><div class="a-item__text">' + esc(short) + "</div></div>" +
        '<div class="a-item__ctrls">' +
          '<button class="a-iconbtn" data-act="up" title="Move up">↑</button>' +
          '<button class="a-iconbtn" data-act="down" title="Move down">↓</button>' +
          '<button class="a-iconbtn" data-act="edit" title="Edit">✎</button>' +
          '<button class="a-iconbtn a-iconbtn--del" data-act="del" title="Delete">✕</button>' +
        "</div>";
      li.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", function () { listAction(b.getAttribute("data-act"), i); });
      });
      ul.appendChild(li);
    });
    updateDirty();
  }

  function listAction(act, i) {
    if (act === "up" && i > 0) { swap(i, i - 1); }
    else if (act === "down" && i < reviews.length - 1) { swap(i, i + 1); }
    else if (act === "del") {
      if (!confirm("Delete this review from " + (reviews[i].name || "this entry") + "?")) return;
      reviews.splice(i, 1);
      if (editing === i) resetForm();
      renderList();
    } else if (act === "edit") {
      loadIntoForm(i);
    }
  }
  function swap(a, b) {
    var t = reviews[a]; reviews[a] = reviews[b]; reviews[b] = t;
    if (editing === a) editing = b; else if (editing === b) editing = a;
    renderList();
  }

  // ---- form <-> object ----
  function formToObject() {
    var o = {};
    o.name = $("f-name").value.trim();
    var handle = $("f-handle").value.trim().replace(/^@/, "");
    if (handle) o.handle = handle;
    var role = $("f-role").value.trim(); if (role) o.role = role;
    o.source = $("f-source").value;
    o.verified = $("f-verified").checked;
    o.featured = $("f-featured").checked;
    if ($("f-anon").checked) o.anon = true;
    var date = $("f-date").value.trim(); if (date) o.date = date;
    var iso = $("f-iso").value.trim(); if (iso) o.iso = iso;
    var url = $("f-url").value.trim(); if (url) o.url = url;
    var domain = $("f-domain").value.trim(); if (domain) o.domain = domain;
    var shot = $("f-shot").value.trim(); if (shot) o.shot = shot;
    o.text = $("f-text").value.replace(/\r\n/g, "\n").trim();
    return o;
  }

  function loadIntoForm(i) {
    var t = reviews[i];
    editing = i;
    $("f-source").value = t.source || "x";
    $("f-name").value = t.name || "";
    $("f-handle").value = t.handle || "";
    $("f-role").value = t.role || "";
    $("f-url").value = t.url || "";
    $("f-date").value = t.date || "";
    $("f-iso").value = t.iso || "";
    $("f-domain").value = t.domain || "";
    $("f-shot").value = t.shot || "";
    $("f-verified").checked = !!t.verified;
    $("f-featured").checked = !!t.featured;
    $("f-anon").checked = !!t.anon;
    $("f-text").value = t.text || "";
    $("form-title").textContent = "Edit review — " + (t.name || "");
    $("btn-apply").textContent = "Update review";
    $("btn-cancel").hidden = false;
    $("pos-field").hidden = true;
    syncSourceFields();
    renderPreview();
    renderList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    editing = null;
    $("review-form").reset();
    $("f-source").value = "x";
    $("form-title").textContent = "Add a review / tweet";
    $("btn-apply").textContent = "Add to list";
    $("btn-cancel").hidden = true;
    $("pos-field").hidden = false;
    syncSourceFields();
    renderPreview();
    renderList();
  }

  function applyForm(e) {
    e.preventDefault();
    var o = formToObject();
    if (!o.name) { toast("Name is required.", "err"); return; }
    if (!o.text) { toast("Testimonial text is required.", "err"); return; }
    if (editing === null) {
      if ($("f-pos").value === "top") reviews.unshift(o);
      else reviews.push(o);
      toast("Added — remember to Publish.", "ok");
    } else {
      reviews[editing] = o;
      toast("Updated — remember to Publish.", "ok");
    }
    resetForm();
  }

  // ---- preview ----
  function renderPreview() {
    var o = formToObject();
    if (!o.name && !o.text) {
      $("preview-wall").innerHTML = '<p style="color:#cfe3ec;font-family:var(--body)">Start typing to preview the card…</p>';
      return;
    }
    $("preview-wall").innerHTML = cardHTML(o);
  }

  // ---- source-conditional fields ----
  function syncSourceFields() {
    var src = $("f-source").value;
    document.querySelectorAll(".a-field[data-only]").forEach(function (f) {
      var only = f.getAttribute("data-only");
      var show = only === "x" ? src === "x" : src !== "x";
      f.hidden = !show;
    });
  }

  // ---- token ui ----
  function refreshTokenUI() {
    // In backend mode no token is needed — the Worker holds it. Hide the bar.
    if (MODE === "backend") { $("token-bar").hidden = true; updateDirty(); return; }
    var has = !!token;
    $("token-status").textContent = has ? "Token saved" : "No GitHub token";
    $("token-status").className = "a-pill " + (has ? "a-pill--ok" : "a-pill--warn");
    $("btn-forgettoken").hidden = !has;
    $("token-input").value = "";
    $("token-input").placeholder = has ? "Token saved (paste a new one to replace)" : "Paste GitHub token (ghp_… or github_pat_…)";
    updateDirty();
  }

  function saveToken() {
    var v = $("token-input").value.trim();
    if (!v) { toast("Paste a token first.", "err"); return; }
    token = v;
    sessionStorage.setItem(TOKEN_KEY, v);
    if ($("token-remember").checked) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
    refreshTokenUI();
    loadReviews();
  }
  function forgetToken() {
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    refreshTokenUI();
    toast("Token forgotten.", "ok");
  }

  // Pure-JS SHA-256 (UTF-8 safe) — fallback when SubtleCrypto is unavailable.
  function sha256hexJS(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, maxWord = mp(2, 32), result = "", words = [], bitLen;
    var hash = [], k = [], primeCounter = 0, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mp(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mp(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    var bytes = [];
    for (var ci = 0; ci < ascii.length; ci++) {
      var cc = ascii.charCodeAt(ci);
      if (cc < 0x80) bytes.push(cc);
      else if (cc < 0x800) bytes.push(0xc0 | (cc >> 6), 0x80 | (cc & 0x3f));
      else if (cc < 0xd800 || cc >= 0xe000) bytes.push(0xe0 | (cc >> 12), 0x80 | ((cc >> 6) & 0x3f), 0x80 | (cc & 0x3f));
      else { ci++; var cp = 0x10000 + (((cc & 0x3ff) << 10) | (ascii.charCodeAt(ci) & 0x3ff)); bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
    }
    ascii = String.fromCharCode.apply(null, bytes);
    bitLen = ascii.length * 8;
    ascii += "\x80";
    while (ascii.length % 64 - 56) ascii += "\x00";
    for (var j = 0; j < ascii.length; j++) words[j >> 2] |= ascii.charCodeAt(j) << ((3 - j) % 4) * 8;
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (var jj = 0; jj < words.length;) {
      var w = words.slice(jj, jj += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (var it = 0; it < 64; it++) {
        var w15 = w[it - 15], w2 = w[it - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[it] +
          (w[it] = it < 16 ? w[it] : (w[it - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[it - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (var ir = 0; ir < 8; ir++) hash[ir] = (hash[ir] + oldHash[ir]) | 0;
    }
    for (var n = 0; n < 8; n++) for (var ii = 3; ii + 1; ii--) { var b = (hash[n] >> (ii * 8)) & 255; result += ((b < 16) ? 0 : "") + b.toString(16); }
    return result;
  }

  // ---- auth gate ----
  // Prefer the native SubtleCrypto; fall back to a pure-JS SHA-256 so login also
  // works in non-secure contexts (plain http://, file://, before HTTPS is ready).
  async function sha256hex(s) {
    try {
      if (self.crypto && self.crypto.subtle) {
        var buf = await self.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
      }
    } catch (e) { /* fall through to JS implementation */ }
    return sha256hexJS(s);
  }

  function showGateErr(msg) {
    var el = $("gate-err");
    el.textContent = msg || "Incorrect password.";
    el.hidden = false;
    $("gate-pass").value = "";
  }

  function showApp() {
    $("gate").hidden = true;
    $("app").hidden = false;
    refreshTokenUI();
    syncSourceFields();
    renderPreview();
    loadReviews();
  }

  async function tryLogin(e) {
    e.preventDefault();
    $("gate-err").hidden = true;
    var pass = $("gate-pass").value;
    try {
      if (MODE === "backend") {
        // The Worker is the real authority: verify the password by loading data.
        adminPassword = pass;
        var res = await fetch(backendBase() + "/reviews", { headers: { "X-Admin-Password": pass } });
        if (res.status === 401) { adminPassword = ""; showGateErr(); return; }
        if (!res.ok) { adminPassword = ""; showGateErr("Backend error (" + res.status + "). Try again."); return; }
        sessionStorage.setItem("sr_admin_ok", "1");
        sessionStorage.setItem("sr_admin_pw", pass);
        showApp();
      } else {
        var hex = await sha256hex(pass);
        if (hex === PASS_HASH) { sessionStorage.setItem("sr_admin_ok", "1"); showApp(); }
        else showGateErr();
      }
    } catch (err) {
      showGateErr("Login error: " + err.message);
    }
  }

  // ---- wire up ----
  function init() {
    if (MODE === "backend") {
      $("gate-note").textContent = "Passwords are verified securely on the server. Ask the site owner for the admin password.";
    }
    $("gate-form").addEventListener("submit", tryLogin);
    $("btn-signout").addEventListener("click", function () {
      sessionStorage.removeItem("sr_admin_ok");
      sessionStorage.removeItem("sr_admin_pw");
      adminPassword = "";
      location.reload();
    });
    $("btn-reload").addEventListener("click", function () {
      if (isDirty() && !confirm("Reload from GitHub and discard unpublished changes?")) return;
      loadReviews();
    });
    $("btn-savetoken").addEventListener("click", saveToken);
    $("btn-forgettoken").addEventListener("click", forgetToken);
    $("review-form").addEventListener("submit", applyForm);
    $("review-form").addEventListener("input", renderPreview);
    $("f-source").addEventListener("change", function () { syncSourceFields(); renderPreview(); });
    $("btn-cancel").addEventListener("click", resetForm);
    $("btn-clear").addEventListener("click", resetForm);
    $("btn-today").addEventListener("click", function () {
      var d = new Date();
      $("f-iso").value = d.toISOString().slice(0, 10);
      $("f-date").value = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      renderPreview();
    });
    $("btn-publish").addEventListener("click", publish);
    $("btn-discard").addEventListener("click", function () {
      if (!confirm("Discard all unpublished changes?")) return;
      loadReviews();
    });

    if (sessionStorage.getItem("sr_admin_ok") === "1") showApp();
  }

  init();
})();
