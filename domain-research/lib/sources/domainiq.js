import { fetchJson } from '../util.js';

// Template-driven so you can wire up DomainIQ without touching code:
// set DOMAINIQ_URL_TEMPLATE to your exact endpoint, using {domain} and {key}.
// The domain is URL-encoded before substitution (it is validated upstream too).
export default {
  name: 'domainiq_lookup',
  description:
    'DomainIQ lookup (premium). Typically provides historical WHOIS, reverse-WHOIS (other domains by the same ' +
    'registrant) and related-domain intelligence. Strong for tracking ownership changes and discovering a ' +
    "registrant's wider portfolio.",
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string' } },
    required: ['domain'],
  },
  requiresKey: ['DOMAINIQ_URL_TEMPLATE', 'DOMAINIQ_API_KEY'],
  async run({ domain }, { env }) {
    const url = env.DOMAINIQ_URL_TEMPLATE.replaceAll('{domain}', encodeURIComponent(domain)).replaceAll(
      '{key}',
      encodeURIComponent(env.DOMAINIQ_API_KEY),
    );
    return await fetchJson(url);
  },
};
