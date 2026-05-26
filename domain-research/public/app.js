const $ = (id) => document.getElementById(id);

const els = {
  form: $('search'),
  domain: $('domain'),
  question: $('question'),
  go: $('go'),
  status: $('status'),
  report: $('report'),
  evidence: $('evidence'),
  trace: $('trace'),
  followup: $('followup'),
  followupInput: $('followup-input'),
};

// Conversation history sent back to the server for follow-up questions.
let history = [];
let currentDomain = '';

function setStatus(text, isError = false) {
  if (!text) {
    els.status.hidden = true;
    return;
  }
  els.status.hidden = false;
  els.status.textContent = text;
  els.status.classList.toggle('error', isError);
}

// Escape first, then apply a tiny, safe subset of Markdown. The report comes
// from our own model, but we still never inject raw HTML from it.
function renderMarkdown(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc(md || '').split('\n');
  let html = '';
  let inList = false;
  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = h[1].length + 1;
      html += `<h${level}>${inline(h[2])}</h${level}>`;
    } else if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
    } else if (line === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function renderTrace(trace) {
  if (!trace || !trace.length) {
    els.evidence.hidden = true;
    return;
  }
  els.evidence.hidden = false;
  els.trace.innerHTML = trace
    .map((t) => {
      const dot = t.ok ? 'ok' : 'bad';
      const arg = t.args && t.args.domain ? ` ${t.args.domain}` : '';
      const err = t.ok ? '' : ` <span class="err">— ${(t.error || 'failed').replace(/</g, '&lt;')}</span>`;
      return `<li><span class="dot ${dot}"></span>${t.tool}${arg}${err}</li>`;
    })
    .join('');
}

async function callResearch({ domain, question }) {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain, question, history }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function run({ domain, question, isFollowup }) {
  els.go.disabled = true;
  setStatus(isFollowup ? 'Thinking…' : `Researching ${domain}…`);
  try {
    const data = await callResearch({ domain, question });
    currentDomain = data.domain;
    els.report.hidden = false;
    els.report.innerHTML = renderMarkdown(data.report);
    renderTrace(data.trace);
    history.push({ role: 'user', content: question || `Research the domain: ${data.domain}` });
    history.push({ role: 'assistant', content: data.report });
    els.followup.hidden = false;
    setStatus('');
  } catch (e) {
    setStatus(e.message || String(e), true);
  } finally {
    els.go.disabled = false;
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const domain = els.domain.value.trim();
  if (!domain) return;
  history = []; // fresh investigation
  run({ domain, question: els.question.value.trim(), isFollowup: false });
});

els.followup.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = els.followupInput.value.trim();
  if (!q) return;
  els.followupInput.value = '';
  run({ domain: currentDomain, question: q, isFollowup: true });
});
