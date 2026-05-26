import OpenAI from 'openai';
import { getAvailableTools, runTool } from './sources/index.js';

const SYSTEM_PROMPT = `You are a meticulous domain-ownership research analyst.
Given a domain, determine who owns or controls it, the history of that ownership, and the supporting infrastructure evidence.

How to work:
- Gather evidence with the available tools. Begin with rdap_whois and dns_lookup, then wayback_history, then any premium sources (whoisxml_lookup, domainiq_lookup, bigdomaindata_lookup) that are available for historical WHOIS, reverse-WHOIS and related domains.
- Call independent tools in parallel. Do not ask the user for permission — just gather what you need.
- Cross-reference findings: registrant identity/org, registrar, nameserver/hosting/email provider, creation/expiry/transfer dates, historical registrant changes, and how long content has existed (Wayback).
- Be explicit about privacy redaction (e.g. "Domains By Proxy", "Privacy Protect", "REDACTED FOR PRIVACY"). NEVER invent a registrant when the record is private or a tool returned nothing.

Write the final answer in Markdown with these sections:
1. **Summary** — one plain-English paragraph: who owns this and how confident you are.
2. **Current registration** — registrar, key dates, registrant (or note privacy), status codes.
3. **Infrastructure** — nameservers, hosting, MX, notable TXT records, and what providers they indicate.
4. **History** — registration age, ownership/registrar changes over time, Wayback timeline highlights.
5. **Leads & related domains** — reverse-WHOIS / related domains, if any source provided them.
6. **Confidence & gaps** — High / Medium / Low, and what additional data would raise it.

Cite the source of each key fact inline, e.g. "(RDAP)", "(DNS)", "(Wayback)", "(DomainIQ)". If a tool failed or returned nothing useful, say so rather than guessing.`;

const MAX_TOOL_RESULT_CHARS = 12000;
const MAX_STEPS = 8;

export async function research({ domain, question, history = [], env }) {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const model = env.OPENAI_MODEL || 'gpt-4o';
  const tools = getAvailableTools(env);

  const userPrompt = question
    ? `Research the domain: ${domain}\n\nSpecific question: ${question}`
    : `Research the domain: ${domain}`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userPrompt },
  ];

  const trace = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
    });

    const msg = completion.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { report: msg.content, trace };
    }

    const results = await Promise.all(
      msg.tool_calls.map(async (call) => {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          /* leave args empty; tool will error cleanly */
        }
        const result = await runTool(call.function.name, args, env);
        trace.push({ tool: call.function.name, args, ok: result.ok, error: result.error || null });
        const payload = result.ok ? result.data : { error: result.error };
        return {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(payload).slice(0, MAX_TOOL_RESULT_CHARS),
        };
      }),
    );

    messages.push(...results);
  }

  // Hit the step ceiling — force a final summary from what we have.
  const finalize = await client.chat.completions.create({
    model,
    messages: [...messages, { role: 'user', content: 'Stop researching and write your final report now from the evidence gathered.' }],
    temperature: 0.2,
  });
  return { report: finalize.choices[0].message.content, trace };
}
