# Domain Research

AI-assisted domain **ownership** research. Enter a domain and an OpenAI-powered
agent fans out to multiple data sources — WHOIS/RDAP, DNS/nameservers, the
Wayback Machine, and any premium APIs you configure (WhoisXML, DomainIQ, Big
Domain Data) — then cross-references the results into a single report with
confidence levels and inline citations.

## How it works

```
Browser (public/)  ──POST /api/research──►  Vercel function (api/research.js)
                                                  │
                                                  ▼
                                        Agent loop (lib/agent.js)
                                     OpenAI tool-calling: the model
                                     decides which lookups to run,
                                     reads the JSON, and writes the report
                                                  │
                          ┌───────────────┬───────┴───────┬────────────────┐
                          ▼               ▼               ▼                ▼
                    rdap_whois       dns_lookup     wayback_history   premium APIs
                     (free)            (free)          (free)        (key-gated)
```

- **Keys never reach the browser.** All third-party calls and the OpenAI call
  happen server-side in the Vercel function.
- **Sources are pluggable.** Each source in `lib/sources/` is exposed to the
  model as a "tool". A source only appears to the model when its required env
  vars are present, so the free sources work immediately and premium ones light
  up as you add keys.

## Setup

```bash
npm install
cp .env.example .env        # fill in OPENAI_API_KEY (minimum)
npx vercel dev              # local dev at http://localhost:3000
```

Only `OPENAI_API_KEY` is required to get a working result from the free
sources. Add premium keys whenever you're ready.

## Wiring up DomainIQ / Big Domain Data

You said you'd supply the URL structures — that's exactly what these env vars
are for, so no code changes are needed:

```
DOMAINIQ_URL_TEMPLATE=https://www.domainiq.com/api?key={key}&service=whois&domain={domain}&format=json
DOMAINIQ_API_KEY=your-key
```

`{domain}` and `{key}` are substituted at request time (the domain is
URL-encoded and validated first). Big Domain Data uses the same pattern via
`BIGDOMAINDATA_URL_TEMPLATE` / `BIGDOMAINDATA_API_KEY`.

If a real API returns a shape the model struggles with, the cleanest fix is to
add a small `summarize`/parse step in that source module — tell the assistant
and it can do it.

## Deploy (Vercel)

1. Push this folder to its own GitHub repo.
2. Import it in Vercel (zero-config: `public/` is served statically, `api/`
   becomes the function).
3. Add the env vars from `.env.example` in the Vercel project settings.

## Adding a new data source

Create `lib/sources/yoursource.js`:

```js
export default {
  name: 'yoursource_lookup',
  description: 'What it returns and when the model should use it.',
  parameters: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
  requiresKey: ['YOURSOURCE_API_KEY'], // omit if free
  async run({ domain }, { env }) { /* fetch + return JSON */ },
};
```

Then register it in `lib/sources/index.js`. That's it — it's now a tool the AI
can choose to call.

## Notes & next steps

- **Rate limiting / auth:** there's none yet. Before exposing this publicly, add
  a rate limit (e.g. Vercel KV / Upstash) and/or gate the endpoint, or your
  OpenAI + premium-API spend is open to the world.
- **Streaming:** responses are returned in one shot. Server-sent events would
  let the UI show the report as it's written.
- **Caching:** identical lookups could be cached for a TTL to cut cost/latency.
