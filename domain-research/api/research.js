import { research } from '../lib/agent.js';
import { isValidDomain, normalizeDomain } from '../lib/util.js';

// Allow longer runs: the agent loop makes several API calls in sequence.
// (Honored on Vercel plans that permit it; safe to keep otherwise.)
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST' });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'Server is missing OPENAI_API_KEY' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const domain = normalizeDomain(body.domain);
    if (!isValidDomain(domain)) {
      res.status(400).json({ error: 'Please provide a valid domain, e.g. example.com' });
      return;
    }

    const question = typeof body.question === 'string' ? body.question.slice(0, 1000) : '';
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    const result = await research({ domain, question, history, env: process.env });
    res.status(200).json({ domain, report: result.report, trace: result.trace });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
