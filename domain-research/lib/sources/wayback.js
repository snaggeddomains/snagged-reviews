import { fetchJson } from '../util.js';

// Wayback CDX API is free. Snapshot timeline is a strong proxy for how long a
// site has existed and roughly when content (and likely ownership) changed.
export default {
  name: 'wayback_history',
  description:
    'Internet Archive (Wayback Machine) history. Returns total snapshot count, first and most recent snapshot dates, ' +
    'and a sample of snapshots. Use to estimate site age and detect periods where the site went dark or changed hands.',
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string' } },
    required: ['domain'],
  },
  async run({ domain }) {
    const url =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}` +
      `&output=json&fl=timestamp,original,statuscode&collapse=timestamp:8&limit=2000`;
    const cdx = await fetchJson(url);
    const rows = Array.isArray(cdx) ? cdx.slice(1) : []; // first row is a header
    const timestamps = rows.map((r) => r[0]).filter(Boolean).sort();
    return {
      total_snapshots: timestamps.length,
      first_snapshot: timestamps[0] || null,
      last_snapshot: timestamps[timestamps.length - 1] || null,
      sample: rows.slice(0, 25),
    };
  },
};
