const graphEl = document.getElementById('graph');
const statusEl = document.getElementById('status');
const form = document.getElementById('search-form');
const input = document.getElementById('keyword-input');
const panel = document.getElementById('detail-panel');
const panelContent = document.getElementById('detail-content');
const closeBtn = document.getElementById('close-panel');

let network = null;
let currentNet = null; // last search() response — feeds the chat's netContext

// Neighbor-to-neighbor edges (net.edges with scope === 'neighbor') are kept
// out of the graph by default and only added in per-node on click. This
// flag is the global override for people who just want to see everything
// at once — it persists across searches, same as the filter popover does.
let showAllEdges = false;
let activeEdges = null;          // the vis.DataSet currently on screen
let activeNeighborEdges = [];    // full list of this net's neighbor-scope edge specs
let expandedNodeIds = new Set(); // per-node click-expand state, only meaningful when showAllEdges is false

function truncate(str, n) {
  return str && str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toVisEdge(e) {
  return {
    id: e.id,
    from: e.from,
    to: e.to,
    color: { color: e.type === 'cites' ? '#A8433D' : '#5A9385', opacity: 0.55 },
    dashes: e.type !== 'cites',
    smooth: { type: 'continuous' },
    width: 1.25,
  };
}

function renderNet(net) {
  graphEl.innerHTML = '';

  const LABEL_THRESHOLD = 0.5; // below this, node shows as an unlabeled dot until hovered

  const nodes = new vis.DataSet(
    net.nodes.map((n) => ({
      id: n.id,
      label: n.isRoot || (n.similarity || 0) >= LABEL_THRESHOLD ? truncate(n.title, 24) : undefined,
      title: n.title,
      shape: 'dot',
      size: n.isRoot ? 26 : 8 + (n.similarity || 0) * 14,
      font: {
        color: '#E8E1D0',
        face: 'IBM Plex Sans',
        size: n.isRoot ? 15 : 10,
      },
      color: n.isRoot
        ? { background: '#C9A257', border: '#C9A257', highlight: { background: '#C9A257', border: '#E8E1D0' } }
        : {
            background: '#1E1B15',
            border: n.viaCitation ? '#A8433D' : '#5A9385',
            highlight: { background: '#1E1B15', border: '#C9A257' },
          },
      borderWidth: n.isRoot ? 3 : 2,
    }))
  );

  // Root-to-neighbor edges render immediately, as before. Neighbor-to-neighbor
  // edges get added in either per-node (click) or all at once (the "Show all
  // connections" button) — with 40+ nodes they get dense fast and bog down
  // the physics if left on by default.
  const edgeId = (e, i) => `${e.from}-${e.to}-${e.type}-${i}`;

  const rootEdgeSpecs = net.edges
    .map((e, i) => ({ ...e, id: edgeId(e, i) }))
    .filter((e) => e.scope !== 'neighbor');
  const neighborEdgeSpecs = net.edges
    .map((e, i) => ({ ...e, id: edgeId(e, i) }))
    .filter((e) => e.scope === 'neighbor');

  const initialSpecs = showAllEdges ? [...rootEdgeSpecs, ...neighborEdgeSpecs] : rootEdgeSpecs;
  const edges = new vis.DataSet(initialSpecs.map(toVisEdge));

  activeEdges = edges;
  activeNeighborEdges = neighborEdgeSpecs;
  expandedNodeIds = new Set();

  network = new vis.Network(
    graphEl,
    { nodes, edges },
    {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -140,
          springLength: 220,
          springConstant: 0.035,
          damping: 0.45,
          avoidOverlap: 1,
        },
        stabilization: { iterations: 300 },
      },
      interaction: { hover: true, tooltipDelay: 150 },
    }
  );

  network.on('click', (params) => {
    if (params.nodes.length === 0) return;
    const nodeId = params.nodes[0];
    openDetail(nodeId);

    if (showAllEdges) return; // everything's already on screen, nothing to toggle per-node

    const connected = neighborEdgeSpecs.filter((e) => e.from === nodeId || e.to === nodeId);
    if (connected.length === 0) return;

    if (expandedNodeIds.has(nodeId)) {
      // Collapse — but only remove edges that aren't also touching some
      // OTHER still-expanded node, so two expanded neighbors sharing an
      // edge don't make it vanish while the other node is still open.
      expandedNodeIds.delete(nodeId);
      connected.forEach((e) => {
        const otherEnd = e.from === nodeId ? e.to : e.from;
        if (!expandedNodeIds.has(otherEnd) && edges.get(e.id)) {
          edges.remove(e.id);
        }
      });
    } else {
      expandedNodeIds.add(nodeId);
      connected.forEach((e) => {
        if (!edges.get(e.id)) edges.add(toVisEdge(e));
      });
    }
  });
}

async function openDetail(paperId) {
  panelContent.innerHTML = '<p class="meta">loading…</p>';
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');

  try {
    const res = await fetch(`/papers/${paperId}`);
    if (!res.ok) throw new Error('not found');
    const paper = await res.json();

    panelContent.innerHTML = `
      <p class="meta">${escapeHtml(paper.openalex_id)}${paper.publication_year ? ` · ${paper.publication_year}` : ''}</p>
      <h2 class="paper-title">${escapeHtml(paper.title)}</h2>
      ${paper.venue ? `<p class="meta">${escapeHtml(paper.venue)}</p>` : ''}
      <p class="abstract">${escapeHtml(paper.abstract) || 'No abstract available for this paper.'}</p>
      <p class="meta">${paper.cited_by_count ?? 0} citations on OpenAlex</p>
      ${paper.doi ? `<p><a class="mono" href="${escapeHtml(paper.doi)}" target="_blank" rel="noopener">${escapeHtml(paper.doi)}</a></p>` : ''}
    `;
  } catch (err) {
    panelContent.innerHTML = '<p class="meta">Couldn\'t load this paper.</p>';
  }
}

closeBtn.addEventListener('click', () => {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const keyword = input.value.trim();
  if (!keyword) return;

  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  graphEl.classList.add('loading');
  statusEl.textContent = 'charting the net…';

  const minYear = document.getElementById('filter-min-year').value;
  const maxYear = document.getElementById('filter-max-year').value;
  const maxNodes = document.getElementById('filter-max-nodes').value;
  const threshold = document.getElementById('filter-threshold').value;

  const params = new URLSearchParams({ keyword });
  if (minYear) params.set('minYear', minYear);
  if (maxYear) params.set('maxYear', maxYear);
  if (maxNodes) params.set('maxNodes', maxNodes);
  if (threshold) params.set('threshold', threshold);

  try {
    const res = await fetch(`/search?${params.toString()}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `request failed (${res.status})`);
    }
    const net = await res.json();
    currentNet = net;
    renderNet(net);

    const root = net.nodes.find((n) => n.isRoot);
    const simText = typeof net.rootSimilarity === 'number' ? net.rootSimilarity.toFixed(3) : '—';
    const filterBits = [];
    if (minYear || maxYear) filterBits.push(`${minYear || 'any'}–${maxYear || 'any'}`);
    if (maxNodes) filterBits.push(`max ${maxNodes}`);
    if (threshold) filterBits.push(`threshold ${threshold}`);
    const filterText = filterBits.length ? ` [${filterBits.join(', ')}]` : '';
    statusEl.textContent = `${net.nodes.length} papers, ${net.edges.length} connections — rooted at "${root ? root.title : '—'}" · similarity ${simText} (${net.rootSource})${filterText}`;
  } catch (err) {
    statusEl.textContent = `Couldn't chart that: ${err.message}`;
  } finally {
    graphEl.classList.remove('loading');
  }
});

/* ---------- Settings ---------- */

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const settingsForm = document.getElementById('settings-form');

async function openSettings() {
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
  settingsForm.reset(); // never pre-fill real or masked secrets into an editable field

  try {
    const res = await fetch('/settings');
    const current = await res.json();
    document.getElementById('hint-openalex').textContent = current.openalex_api_key ? `currently: ${current.openalex_api_key}` : 'not set';
    document.getElementById('hint-ai-key').textContent = current.ai_api_key ? `currently: ${current.ai_api_key}` : 'not set';
    document.getElementById('hint-model').textContent = current.ai_model ? `currently: ${current.ai_model}` : '';
    if (current.ai_provider) settingsForm.ai_provider.value = current.ai_provider;
  } catch {
    // non-fatal — hints just stay blank
  }
}

function closeSettings() {
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
}

settingsToggle.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(settingsForm).entries());

  try {
    const res = await fetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`save failed (${res.status})`);
    closeSettings();
  } catch (err) {
    alert(`Couldn't save settings: ${err.message}`);
  }
});

/* ---------- Chat ---------- */

const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let chatHistory = []; // [{role: 'user'|'assistant', content: '...'}]

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;

  if (role === 'assistant') {
    // The model's reply is markdown — render it properly instead of showing
    // raw ** and - characters. Sanitized because the source markdown can
    // include paper titles/abstracts pulled from OpenAlex, which this app
    // doesn't fully control the content of.
    el.innerHTML = DOMPurify.sanitize(marked.parse(text));

    // The system prompt asks the model to link paper mentions as
    // [View paper](#paper-ID). Turn those into buttons that open the same
    // detail popup a graph node click opens — much easier to find "that
    // paper the AI just mentioned" than hunting for it in the graph.
    el.querySelectorAll('a[href^="#paper-"]').forEach((a) => {
      const id = parseInt(a.getAttribute('href').slice('#paper-'.length), 10);
      if (Number.isNaN(id)) return;
      a.classList.add('paper-link');
      a.href = '#';
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        openDetail(id);
      });
    });
  } else {
    el.textContent = text;
  }

  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setChatOpen(isOpen) {
  chatPanel.classList.toggle('open', isOpen);
  chatPanel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  chatToggle.classList.toggle('is-hidden', isOpen);
  // #graph's width now depends on chat-panel's width, which is mid-transition —
  // nudge vis-network to recompute its canvas size once the transition settles.
  setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
}

chatToggle.addEventListener('click', () => {
  setChatOpen(!chatPanel.classList.contains('open'));
});
chatClose.addEventListener('click', () => setChatOpen(false));

function buildNetContext(net) {
  const root = net.nodes.find((n) => n.isRoot);
  return {
    rootId: root ? root.id : null,
    rootTitle: root ? root.title : null,
    rootAbstract: root ? root.abstract : null,
    neighbors: net.nodes
      .filter((n) => !n.isRoot)
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .map((n) => ({ id: n.id, title: n.title, similarity: n.similarity, viaCitation: n.viaCitation })),
  };
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  if (!currentNet) {
    appendMessage('error', 'Search a topic first — there\'s nothing to discuss yet.');
    return;
  }

  chatInput.value = '';
  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ netContext: buildNetContext(currentNet), messages: chatHistory }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `request failed (${res.status})`);

    appendMessage('assistant', body.reply);
    chatHistory.push({ role: 'assistant', content: body.reply });
  } catch (err) {
    appendMessage('error', `Couldn't get a reply: ${err.message}`);
  }
});

/* ---------- Filter popover ---------- */

const filterToggle = document.getElementById('filter-toggle');
const filterPopover = document.getElementById('filter-popover');
const filterClear = document.getElementById('filter-clear');

filterToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  filterPopover.classList.toggle('open');
  filterPopover.setAttribute('aria-hidden', filterPopover.classList.contains('open') ? 'false' : 'true');
});

document.addEventListener('click', (e) => {
  if (!filterPopover.contains(e.target) && e.target !== filterToggle) {
    filterPopover.classList.remove('open');
    filterPopover.setAttribute('aria-hidden', 'true');
  }
});

filterClear.addEventListener('click', () => {
  document.getElementById('filter-min-year').value = '';
  document.getElementById('filter-max-year').value = '';
  document.getElementById('filter-max-nodes').value = '';
  document.getElementById('filter-threshold').value = '';
});

/* ---------- Show all connections toggle ---------- */

const toggleAllEdgesBtn = document.getElementById('toggle-all-edges');

toggleAllEdgesBtn.addEventListener('click', () => {
  showAllEdges = !showAllEdges;
  toggleAllEdgesBtn.textContent = showAllEdges ? 'Hide extra connections' : 'Show all connections';
  toggleAllEdgesBtn.classList.toggle('active', showAllEdges);

  if (!activeEdges) return; // no net rendered yet — just flips the label for next time

  if (showAllEdges) {
    activeNeighborEdges.forEach((e) => {
      if (!activeEdges.get(e.id)) activeEdges.add(toVisEdge(e));
    });
  } else {
    activeNeighborEdges.forEach((e) => {
      if (activeEdges.get(e.id)) activeEdges.remove(e.id);
    });
    expandedNodeIds.clear();
  }
});