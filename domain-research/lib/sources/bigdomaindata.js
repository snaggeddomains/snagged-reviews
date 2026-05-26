import { fetchJson } from '../util.js';

// Template-driven, same pattern as DomainIQ. Set BIGDOMAINDATA_URL_TEMPLATE
// to your exact endpoint, using {domain} and {key} placeholders.
export default {
  name: 'bigdomaindata_lookup',
  description:
    'Big Domain Data lookup (premium). Bulk/historical WHOIS and domain ownership records. Useful as a second ' +
    'opinion on registrant history and for filling gaps when RDAP/WhoisXML are redacted.',
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string' } },
    required: ['domain'],
  },
  requiresKey: ['BIGDOMAINDATA_URL_TEMPLATE', 'BIGDOMAINDATA_API_KEY'],
  async run({ domain }, { env }) {
    const url = env.BIGDOMAINDATA_URL_TEMPLATE.replaceAll('{domain}', encodeURIComponent(domain)).replaceAll(
      '{key}',
      encodeURIComponent(env.BIGDOMAINDATA_API_KEY),
    );
    return await fetchJson(url);
  },
};
