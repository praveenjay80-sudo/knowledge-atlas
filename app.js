const ROOT_DEFINITIONS = [
  {
    name: "Formal sciences",
    summary: "Abstract, symbolic, mathematical, computational, and logical systems of knowledge.",
    keywords: ["formal sciences", "logic", "mathematics", "computation", "formal systems"],
  },
  {
    name: "Natural sciences",
    summary: "Empirical study of matter, energy, life, Earth, space, and natural processes.",
    keywords: ["natural sciences", "physics", "chemistry", "biology", "earth science"],
  },
  {
    name: "Social sciences",
    summary: "Systematic study of human behavior, institutions, economies, societies, and culture.",
    keywords: ["social sciences", "society", "institutions", "human behavior", "culture"],
  },
  {
    name: "Humanities",
    summary: "Interpretive study of language, history, literature, art, religion, and human meaning.",
    keywords: ["humanities", "history", "literature", "language", "culture"],
  },
  {
    name: "Applied sciences and professions",
    summary: "Knowledge organized around design, intervention, practice, technology, health, and professional work.",
    keywords: ["applied sciences", "engineering", "medicine", "technology", "professional practice"],
  },
  {
    name: "Philosophy",
    summary: "Critical inquiry into reality, knowledge, value, reason, mind, language, and science.",
    keywords: ["philosophy", "metaphysics", "epistemology", "ethics", "logic"],
  },
];

const LEVEL_LABELS = {
  1: "Level 1 Domain",
  2: "Level 2 Field",
  3: "Level 3 Subfield",
  4: "Level 4 Specialty",
};

const SEARCH_PROVIDERS = {
  worldcat: {
    label: "WorldCat",
    url: (query) => `https://search.worldcat.org/search?q=${encodeURIComponent(query)}`,
  },
  scholar: {
    label: "Google Scholar",
    url: (query) => `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
  },
  eth: {
    label: "ETH Library",
    url: (query) => `https://eth.swisscovery.slsp.ch/discovery/search?query=any,contains,${encodeURIComponent(query)}&tab=discovery_network&search_scope=DiscoveryNetwork&vid=41SLSP_ETH:ETH&lang=en&offset=0`,
  },
  michigan: {
    label: "Uni Michigan Library",
    url: (query) => `https://search.lib.umich.edu/catalog?query=${encodeURIComponent(query)}`,
  },
};

const refs = {
  apiStatus: document.querySelector("#apiStatus"),
  nodeCount: document.querySelector("#nodeCount"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  breadthSelect: document.querySelector("#breadthSelect"),
  focusInput: document.querySelector("#focusInput"),
  loadRootsButton: document.querySelector("#loadRootsButton"),
  resetButton: document.querySelector("#resetButton"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  selectedLevel: document.querySelector("#selectedLevel"),
  selectedName: document.querySelector("#selectedName"),
  selectedSummary: document.querySelector("#selectedSummary"),
  selectedPath: document.querySelector("#selectedPath"),
  selectedKeywords: document.querySelector("#selectedKeywords"),
  expandButton: document.querySelector("#expandButton"),
  moreButton: document.querySelector("#moreButton"),
  expandBranchButton: document.querySelector("#expandBranchButton"),
  searchAllButton: document.querySelector("#searchAllButton"),
  selectedStatus: document.querySelector("#selectedStatus"),
  levels: {
    1: document.querySelector("#level1List"),
    2: document.querySelector("#level2List"),
    3: document.querySelector("#level3List"),
    4: document.querySelector("#level4List"),
  },
  nodeTemplate: document.querySelector("#nodeTemplate"),
  resultTemplate: document.querySelector("#resultTemplate"),
};

const state = {
  health: "Checking API...",
  serverKeyReady: false,
  roots: [],
  selectedId: "",
  activePathIds: [],
  search: "",
  loadingIds: new Set(),
};

function makeId(path) {
  return path.join(" > ");
}

function createNode(item, path) {
  return {
    id: makeId(path),
    path,
    name: item.name,
    summary: item.summary || "",
    whyItBelongs: item.why_it_belongs || "",
    keywords: uniqueStrings(item.keywords || path),
    aliases: uniqueStrings(item.aliases || []),
    likelyHasChildren: item.likely_has_children ?? path.length < 4,
    taxonomyRole: item.taxonomy_role || roleForLevel(path.length),
    confidence: item.confidence || "high",
    cautionNote: item.caution_note || "",
    children: [],
    status: "",
    remainingNote: "",
  };
}

function roleForLevel(level) {
  if (level === 1) return "domain";
  if (level === 2) return "field";
  if (level === 3) return "subfield";
  return "specialty";
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

function flatten(nodes = state.roots) {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function findNode(id, nodes = state.roots) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNode(id, node.children);
    if (child) return child;
  }
  return null;
}

function selectedNode() {
  return state.selectedId ? findNode(state.selectedId) : null;
}

function setSelected(node) {
  state.selectedId = node.id;
  state.activePathIds = node.path.map((_, index) => makeId(node.path.slice(0, index + 1)));
  render();
}

function apiKey() {
  return refs.apiKeyInput.value.trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function refreshHealth() {
  try {
    const payload = await fetchJson("/api/health");
    state.serverKeyReady = Boolean(payload.apiKeyConfigured);
    state.health = state.serverKeyReady
      ? `Server API ready (${payload.model})`
      : "Enter an API key to generate dynamically";
  } catch {
    state.health = "API route unavailable";
  }
  render();
}

function loadRoots() {
  state.roots = ROOT_DEFINITIONS.map((item) => createNode(item, [item.name]));
  if (state.roots[0]) {
    setSelected(state.roots[0]);
  }
  render();
}

function mergeChildren(node, items) {
  const existing = new Map(node.children.map((child) => [child.name.toLowerCase(), child]));
  for (const item of items || []) {
    const name = String(item.name || "").trim();
    if (!name || existing.has(name.toLowerCase())) continue;
    const child = createNode(
      {
        ...item,
        likely_has_children: node.path.length + 1 < 4 && (item.likely_has_children ?? true),
      },
      [...node.path, name],
    );
    node.children.push(child);
    existing.set(name.toLowerCase(), child);
  }
  node.children.sort((left, right) => left.name.localeCompare(right.name));
}

async function expandNode(node, mode = "initial", options = {}) {
  const { selectFirstChild = true } = options;
  if (!node || node.path.length >= 4) return;
  state.loadingIds.add(node.id);
  node.status = mode === "find_more"
    ? `Searching for missing ${LEVEL_LABELS[node.path.length + 1].toLowerCase()} keywords...`
    : `Generating ${LEVEL_LABELS[node.path.length + 1].toLowerCase()} keywords...`;
  render();

  try {
    const payload = await fetchJson("/api/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        existingChildren: node.children.flatMap((child) => [child.name, ...child.aliases]),
        breadth: refs.breadthSelect.value,
        customFocus: refs.focusInput.value.trim(),
        mode,
        maxDepth: 4,
        apiKey: apiKey(),
      }),
    });
    mergeChildren(node, payload.items || []);
    node.status = payload.overview || `Loaded ${node.children.length} children.`;
    node.remainingNote = payload.remaining_note || "";
    if (selectFirstChild && node.children[0]) {
      setSelected(node.children[0]);
    }
  } catch (error) {
    node.status = error.message || "Generation failed.";
  } finally {
    state.loadingIds.delete(node.id);
    render();
  }
}

async function fillBranchToLevelFour(root) {
  if (!root || state.loadingIds.has(root.id)) return;
  const queue = [root];

  while (queue.length) {
    const node = queue.shift();
    if (!node || node.path.length >= 4) continue;

    if (!node.children.length) {
      await expandNode(node, "initial", { selectFirstChild: false });
    }

    if (node.remainingNote && !/not set|failed|unavailable/i.test(node.remainingNote)) {
      await expandNode(node, "find_more", { selectFirstChild: false });
    }

    queue.push(...node.children.filter((child) => child.path.length < 4));
  }

  setSelected(root);
}

function contextualTerms(node) {
  if (!node) return [];
  const level = node.path.length;
  const ownTerms = uniqueStrings([node.name, ...node.keywords, ...node.aliases]).slice(0, 5);
  const parentContext = level >= 3 ? node.path.slice(0, -1) : node.path.slice(0, Math.max(1, level - 1));
  return uniqueStrings([...ownTerms, ...parentContext]).slice(0, 8);
}

function searchQuery(node) {
  return contextualTerms(node)
    .map((term) => (/\s/.test(term) ? `"${term}"` : term))
    .join(" ");
}

function openProvider(providerKey, node) {
  const provider = SEARCH_PROVIDERS[providerKey];
  if (!provider || !node) return;
  window.open(provider.url(searchQuery(node)), "_blank", "noopener,noreferrer");
}

function clear(element) {
  element.replaceChildren();
}

function createKeywordChips(node, target) {
  clear(target);
  for (const term of contextualTerms(node)) {
    const chip = document.createElement("button");
    chip.className = "keyword-chip";
    chip.type = "button";
    chip.textContent = term;
    chip.title = `Search with context: ${searchQuery(node)}`;
    chip.addEventListener("click", () => openProvider("scholar", node));
    target.appendChild(chip);
  }
}

function visibleChildrenForLevel(level) {
  if (level === 1) return state.roots;
  const parentId = state.activePathIds[level - 2];
  const parent = parentId ? findNode(parentId) : null;
  return parent ? parent.children : [];
}

function renderNodeCard(node) {
  const fragment = refs.nodeTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".node-card");
  const main = fragment.querySelector(".node-main");
  const inlineExpand = fragment.querySelector(".expand-inline");
  const level = node.path.length;

  card.classList.toggle("selected", node.id === state.selectedId);
  card.classList.toggle("in-path", state.activePathIds.includes(node.id));
  fragment.querySelector(".node-level").textContent = LEVEL_LABELS[level];
  fragment.querySelector(".node-name").textContent = node.name;
  fragment.querySelector(".node-summary").textContent = node.summary;

  createKeywordChips(node, fragment.querySelector(".node-keywords"));

  main.addEventListener("click", () => setSelected(node));
  for (const button of fragment.querySelectorAll(".search-button")) {
    button.addEventListener("click", () => openProvider(button.dataset.provider, node));
  }

  inlineExpand.hidden = level >= 4;
  inlineExpand.disabled = state.loadingIds.has(node.id);
  inlineExpand.textContent = state.loadingIds.has(node.id) ? "Generating..." : `Generate Level ${level + 1}`;
  inlineExpand.addEventListener("click", () => expandNode(node));

  return fragment;
}

function renderLevels() {
  for (const [levelText, list] of Object.entries(refs.levels)) {
    const level = Number(levelText);
    clear(list);
    const nodes = visibleChildrenForLevel(level);
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = level === 1 ? "Load Level 1 to begin." : "Select and generate the parent level.";
      list.appendChild(empty);
      continue;
    }
    for (const node of nodes) {
      list.appendChild(renderNodeCard(node));
    }
  }
}

function renderSelected() {
  const node = selectedNode();
  if (!node) {
    refs.selectedLevel.textContent = "No Selection";
    refs.selectedName.textContent = "Load the top-level domains to begin";
    refs.selectedSummary.textContent = "Generate a structured four-level taxonomy of human knowledge, then search any keyword with scholarly context.";
    refs.selectedPath.textContent = "";
    clear(refs.selectedKeywords);
    refs.expandButton.disabled = true;
    refs.searchAllButton.disabled = true;
    refs.selectedStatus.textContent = "";
    return;
  }

  refs.selectedLevel.textContent = LEVEL_LABELS[node.path.length];
  refs.selectedName.textContent = node.name;
  refs.selectedSummary.textContent = node.summary;
  refs.selectedPath.textContent = node.path.join(" > ");
  refs.expandButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.moreButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.expandBranchButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.expandButton.textContent = state.loadingIds.has(node.id)
    ? "Generating..."
    : node.path.length >= 4
      ? "Level 4 reached"
      : `Generate Level ${node.path.length + 1}`;
  refs.moreButton.textContent = node.path.length >= 4 ? "Level 4 reached" : "Find More Siblings";
  refs.expandBranchButton.textContent = node.path.length >= 4 ? "Branch Complete" : "Fill Branch to Level 4";
  refs.searchAllButton.disabled = false;
  refs.selectedStatus.textContent = [node.status, node.remainingNote, node.cautionNote].filter(Boolean).join(" ");
  createKeywordChips(node, refs.selectedKeywords);
}

function renderSearch() {
  clear(refs.searchResults);
  const query = state.search.toLowerCase().trim();
  if (!query) return;

  const matches = flatten()
    .filter((node) =>
      [node.name, node.summary, node.path.join(" "), node.keywords.join(" "), node.aliases.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
    .slice(0, 20);

  for (const node of matches) {
    const fragment = refs.resultTemplate.content.cloneNode(true);
    fragment.querySelector(".result-path").textContent = node.path.join(" > ");
    fragment.querySelector(".result-name").textContent = node.name;
    fragment.querySelector(".result-item").addEventListener("click", () => setSelected(node));
    refs.searchResults.appendChild(fragment);
  }
}

function render() {
  refs.apiStatus.textContent = apiKey() ? "Browser API key ready" : state.health;
  refs.nodeCount.textContent = `${flatten().length} keywords`;
  renderSelected();
  renderLevels();
  renderSearch();
}

refs.loadRootsButton.addEventListener("click", loadRoots);
refs.resetButton.addEventListener("click", () => {
  state.roots = [];
  state.selectedId = "";
  state.activePathIds = [];
  state.search = "";
  refs.searchInput.value = "";
  render();
});
refs.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderSearch();
});
refs.apiKeyInput.addEventListener("input", render);
refs.expandButton.addEventListener("click", () => expandNode(selectedNode()));
refs.moreButton.addEventListener("click", () => expandNode(selectedNode(), "find_more"));
refs.expandBranchButton.addEventListener("click", () => fillBranchToLevelFour(selectedNode()));
refs.searchAllButton.addEventListener("click", () => openProvider("scholar", selectedNode()));

render();
refreshHealth();
