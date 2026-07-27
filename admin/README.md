# Snagged Reviews — Admin

A password-gated admin panel for adding/editing the reviews and tweets that show
up on **snaggedreviews.com**. It lives at **`/admin/`** on the live site.

## How it works

This is a static GitHub Pages site, so there's no server. The admin runs entirely
in your browser and publishes by committing to the repo via the GitHub API:

```
/admin  ──(you add a review)──▶  data/reviews.json  ──(GitHub Action)──▶  index.html  ──▶  live site
```

1. You unlock the admin with a password (a lightweight, client-side gate).
2. You paste a GitHub token once (stored only in your browser).
3. You add / edit / reorder reviews with a **live preview** that matches the site.
4. **Publish to site** commits `data/reviews.json`. The **Build site** GitHub
   Action (`.github/workflows/build.yml`) runs `scripts/build.py` and republishes
   `index.html` automatically — usually within a minute.

Reviews are the single source of truth in **`data/reviews.json`**. You can also
edit that file by hand; the Action rebuilds either way.

## Two modes

The admin works in either of two modes, chosen by the `BACKEND_URL` constant at
the top of `admin/admin.js`:

- **Token mode** (default, `BACKEND_URL = ""`): each person signs in with the
  password and pastes their own GitHub token once per browser.
- **Backend mode** (recommended for more than one person, e.g. an **EA**): set
  `BACKEND_URL` to a deployed Cloudflare Worker and everyone signs in with **only
  the password** — no token in anyone's browser. See [`worker/README.md`](../worker/README.md)
  for the ~5-minute deploy. In this mode the password is verified server-side, so
  it's real auth rather than a client-side gate.

## Signing in

- **URL:** https://snaggedreviews.com/admin/
- **Default password (token mode):** `snagged2026`
- **Backend mode password:** whatever you set as the Worker's `ADMIN_PASSWORD`.

### Change the password

The password is checked against a SHA-256 hash in `admin/admin.js` (`PASS_HASH`).
Generate a new hash and paste it in:

```bash
printf '%s' 'your new password' | shasum -a 256
```

Copy the hex digest into `PASS_HASH` and commit. (This gate only hides the UI —
the real protection on publishing is your GitHub token.)

## GitHub token

The admin needs a token that can write `data/reviews.json`:

1. GitHub → **Settings → Developer settings → Fine-grained personal access tokens → Generate new**.
2. **Resource owner:** `snaggeddomains`.
3. **Repository access:** Only select repositories → `snaggeddomains/snagged-reviews`.
4. **Permissions → Repository permissions → Contents: Read and write.** (Nothing else.)
5. Generate, copy, and paste it into the admin. Tick "Remember on this device" to
   keep it in this browser; use **Forget token** to clear it.

Give the token a short expiry and regenerate when it lapses — the admin will say
`Token rejected (401)` when it's time.

## Review fields

| Field | Notes |
|-------|-------|
| Source | `X / Twitter`, `Email`, `Text`, or `Direct`. Sets the card icon. |
| Name * | Required. |
| Handle | Without the `@`. |
| Role / title | e.g. "CEO, Y Combinator". |
| X post URL | For X sources — adds the "View on X" link. |
| Date label | Free text shown on the card (e.g. "Aug 27, 2025"). |
| Date | Machine date for SEO/structured data. "Use today's date" fills both. |
| Acquired domain | Optional — adds the "Acquired <domain>" badge. |
| Screenshot filename | Optional. Upload the image to `assets/screenshots/` separately. |
| Verified / Featured / Anonymous | Verified badge · coral border · quote-mark avatar. |
| Testimonial text * | Required. A blank line starts a new paragraph. `@mentions` and domains are auto-highlighted. |

Nothing publishes until you click **Publish to site**. **Discard** reverts to the
last published state.
