# Admin backend (Cloudflare Worker)

This optional backend lets multiple people (e.g. you **and your EA**) manage
reviews with **only a password** — no GitHub token in anyone's browser. The
Worker holds one GitHub token as a server-side secret and commits on your behalf.

You only need this if you want password-only access. Without it, the admin still
works in "token mode" (each person pastes their own token).

## What you'll need

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account.
- Node.js installed locally (for the `wrangler` CLI).
- A GitHub fine-grained token with **Contents: Read and write** on
  `snaggeddomains/snagged-reviews` (same kind the admin describes).

## Deploy (one time, ~5 minutes)

```bash
cd worker

# 1. Log in to Cloudflare (opens a browser)
npx wrangler login

# 2. Store the two secrets (you'll be prompted to paste each value)
npx wrangler secret put GITHUB_TOKEN     # paste the GitHub fine-grained token
npx wrangler secret put ADMIN_PASSWORD   # choose the password admins will type

# 3. Deploy
npx wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://snagged-admin.<your-subdomain>.workers.dev`.

## Point the admin at it

Open **`admin/admin.js`**, set:

```js
var BACKEND_URL = "https://snagged-admin.<your-subdomain>.workers.dev";
```

Commit and push. That's it — now the `/admin` login uses `ADMIN_PASSWORD`, the
token bar disappears, and anyone with the password can publish. Send your EA the
admin URL and the password; nothing else.

## Changing the password later

```bash
cd worker && npx wrangler secret put ADMIN_PASSWORD
```

No redeploy needed — secrets update live.

## Notes

- The password is checked server-side (constant-time), so this is real auth, not
  just the client-side gate that token mode uses.
- CORS is limited to the calling site's origin. Requests without the correct
  `X-Admin-Password` header get a 401.
- The token never leaves Cloudflare. To rotate it: `npx wrangler secret put GITHUB_TOKEN`.
- Custom domain (optional): in the Cloudflare dashboard you can map the Worker to
  something like `admin-api.snaggedreviews.com` and use that as `BACKEND_URL`.
