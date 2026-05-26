// Strip scheme/path/www and lowercase, so users can paste a full URL.
export function normalizeDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

// Validate as a hostname BEFORE it is ever interpolated into an API URL.
// This is the SSRF / injection guard for the templated premium sources.
export function isValidDomain(domain) {
  return (
    typeof domain === 'string' &&
    /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i.test(domain)
  );
}

// fetch + JSON parse with a hard timeout, so one slow API can't hang the function.
export async function fetchJson(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'domain-research/0.1', ...(opts.headers || {}) },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (!res.ok) {
      const snippet = typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200);
      throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${snippet}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}
