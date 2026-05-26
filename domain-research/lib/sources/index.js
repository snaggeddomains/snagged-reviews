import dns from './dns.js';
import rdap from './rdap.js';
import wayback from './wayback.js';
import whoisxml from './whoisxml.js';
import domainiq from './domainiq.js';
import bigdomaindata from './bigdomaindata.js';

// To add a new data source: create a module exporting { name, description,
// parameters, requiresKey?, run(args, { env }) } and register it here.
const ALL = [rdap, dns, wayback, whoisxml, domainiq, bigdomaindata];

function isEnabled(source, env) {
  if (!source.requiresKey) return true;
  return source.requiresKey.every((k) => Boolean(env[k]));
}

// Only expose tools whose keys are configured, so the model never tries to
// call a source it can't actually use.
export function getAvailableTools(env) {
  return ALL.filter((s) => isEnabled(s, env)).map((s) => ({
    type: 'function',
    function: { name: s.name, description: s.description, parameters: s.parameters },
  }));
}

export async function runTool(name, args, env) {
  const source = ALL.find((s) => s.name === name);
  if (!source) return { ok: false, error: `Unknown tool: ${name}` };
  if (!isEnabled(source, env)) return { ok: false, error: `Tool ${name} is not configured on the server` };
  try {
    const data = await source.run(args || {}, { env });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
