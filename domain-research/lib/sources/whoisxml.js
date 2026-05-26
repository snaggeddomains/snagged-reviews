import { fetchJson } from '../util.js';

export default {
  name: 'whoisxml_lookup',
  description:
    'WhoisXML API lookup (premium). Richer current WHOIS than RDAP, with normalized registrant contact fields. ' +
    'Good corroborating source for registrant identity and registrar.',
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string' } },
    required: ['domain'],
  },
  requiresKey: ['WHOISXML_API_KEY'],
  async run({ domain }, { env }) {
    const url =
      'https://www.whoisxmlapi.com/whoisserver/WhoisService' +
      `?apiKey=${encodeURIComponent(env.WHOISXML_API_KEY)}` +
      `&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`;
    return await fetchJson(url);
  },
};
