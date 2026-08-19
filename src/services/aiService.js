const settingsService = require('./settingsService');

async function callOpenAI({ apiKey, model, systemPrompt, messages }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic({ apiKey, model, systemPrompt, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,  
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.content.map((block) => block.text || '').join('');
}
async function callDeepSeek({ apiKey, model, systemPrompt, messages }) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepSeek request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
} 
function buildSystemPrompt({ rootId, rootTitle, rootAbstract, neighbors }) {
  const neighborLines = (neighbors || [])
    .slice(0, 20)
    .map((n) => `- id ${n.id}: "${n.title}" (similarity ${typeof n.similarity === 'number' ? n.similarity.toFixed(2) : '—'}, ${n.viaCitation ? 'citation link' : 'semantic only'})`)
    .join('\n');

  return `You are a research assistant helping someone explore a citation network built by PaperNet, a tool that maps papers related to a search topic.

The current root paper is:
id ${rootId ?? '—'}: "${rootTitle}"
Abstract: ${rootAbstract || '(no abstract available)'}

It is connected to these related papers:
${neighborLines || '(none loaded)'}

Help the user understand these papers, how they relate to each other and to the root paper, and identify useful directions for further reading. Be concise and specific — reference paper titles directly rather than speaking in generalities. You don't have access to the full text of any paper beyond what's given above.

Whenever you recommend or specifically call out one of the papers above by name, immediately follow that mention with a link in exactly this markdown format: [View paper](#paper-ID), using that paper's id from the list (e.g. [View paper](#paper-42)). Only do this for papers actually listed above — never invent an id. Add at most one such link per paper, right after the first time you mention it in a given reply.

Format your replies in markdown — use bullet points for lists of papers or comparisons, and bold for paper titles or key terms — it renders properly on the user's end.`;
}

async function chat({ netContext, messages }) {
  const provider = await settingsService.resolve('ai_provider', 'AI_PROVIDER');
  const apiKey = await settingsService.resolve('ai_api_key', 'AI_API_KEY');
  const model = await settingsService.resolve('ai_model', 'AI_MODEL');

  if (!apiKey) throw new Error('No AI API key configured. Add one via the settings button.');
  if (!model) throw new Error('No AI model configured. Add one via the settings button.');

  const systemPrompt = buildSystemPrompt(netContext || {});

  if (provider === 'openai') return callOpenAI({ apiKey, model, systemPrompt, messages });
  if (provider === 'anthropic') return callAnthropic({ apiKey, model, systemPrompt, messages });
  if (provider === 'deepseek') return callDeepSeek({ apiKey, model, systemPrompt, messages });

  throw new Error(`Unknown AI provider "${provider}". Set it to "openai" or "anthropic" via settings.`);
}

module.exports = { chat };