import { Resolver } from 'node:dns/promises';

// Uses the platform resolver (works on Vercel's Node runtime). No key needed.
export default {
  name: 'dns_lookup',
  description:
    'Resolve live DNS records for a domain: nameservers (NS), A/AAAA, MX, TXT (SPF/DKIM hints) and SOA. ' +
    'Use this to identify the DNS/hosting/email provider and to spot infrastructure shared with other domains.',
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string', description: 'Domain name, e.g. example.com' } },
    required: ['domain'],
  },
  async run({ domain }) {
    const r = new Resolver();
    const lookups = {
      ns: r.resolveNs(domain),
      a: r.resolve4(domain),
      aaaa: r.resolve6(domain),
      mx: r.resolveMx(domain),
      txt: r.resolveTxt(domain),
      soa: r.resolveSoa(domain),
    };
    const out = { domain };
    await Promise.all(
      Object.entries(lookups).map(async ([key, p]) => {
        try {
          out[key] = await p;
        } catch (e) {
          out[key] = { error: e.code || String(e.message) };
        }
      }),
    );
    return out;
  },
};
