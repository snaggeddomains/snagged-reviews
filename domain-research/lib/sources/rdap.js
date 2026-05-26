import { fetchJson } from '../util.js';

// RDAP is the modern, structured, free replacement for port-43 WHOIS.
// rdap.org bootstraps to the authoritative registry/registrar server.
export default {
  name: 'rdap_whois',
  description:
    'Free RDAP/WHOIS lookup for the CURRENT registration. Returns registrar, creation/expiry/last-changed dates, ' +
    'registrant org/handle when public, domain status codes (e.g. clientTransferProhibited) and nameservers. ' +
    'Note when the registrant is hidden behind a privacy/proxy service.',
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string' } },
    required: ['domain'],
  },
  async run({ domain }) {
    return await fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  },
};
