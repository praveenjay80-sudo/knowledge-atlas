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
    name: "Humanities and arts",
    summary: "Interpretive and creative study of history, language, literature, religion, art, music, and meaning.",
    keywords: ["humanities", "arts", "history", "literature", "religion"],
  },
  {
    name: "Health sciences",
    summary: "Knowledge of health, disease, care, prevention, public health, and clinical practice.",
    keywords: ["health sciences", "medicine", "nursing", "public health", "clinical care"],
  },
  {
    name: "Engineering and technology",
    summary: "Design, construction, optimization, and governance of technical systems and artifacts.",
    keywords: ["engineering", "technology", "design", "systems", "infrastructure"],
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
  {
    name: "Interdisciplinary and integrative studies",
    summary: "Cross-domain knowledge areas that combine methods, evidence, and problems from multiple traditions.",
    keywords: ["interdisciplinary studies", "systems", "cognitive science", "environment", "data"],
  },
];

const LEVEL_LABELS = {
  1: "Level 1 Domain",
  2: "Level 2 Field",
  3: "Level 3 Subfield",
  4: "Level 4 Concept",
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
  exhaustButton: document.querySelector("#exhaustButton"),
  expandBranchButton: document.querySelector("#expandBranchButton"),
  explainButton: document.querySelector("#explainButton"),
  clearLevelButton: document.querySelector("#clearLevelButton"),
  clearAllButton: document.querySelector("#clearAllButton"),
  searchAllButton: document.querySelector("#searchAllButton"),
  selectedStatus: document.querySelector("#selectedStatus"),
  explanationPanel: document.querySelector("#explanationPanel"),
  explanationContent: document.querySelector("#explanationContent"),
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
    explanation: null,
    explanationStatus: "idle",
  };
}

function roleForLevel(level) {
  if (level === 1) return "domain";
  if (level === 2) return "field";
  if (level === 3) return "subfield";
  return "concept_family";
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
    const before = node.children.length;
    mergeChildren(node, payload.items || []);
    const added = node.children.length - before;
    node.status = added
      ? payload.overview || `Loaded ${added} new children.`
      : payload.overview || "No reliable new children were returned.";
    node.remainingNote = payload.remaining_note || "";
    if (selectFirstChild && added && node.children[0]) {
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

function mayHaveMoreChildren(node, gained) {
  if (gained <= 0) return false;
  const note = `${node.status} ${node.remainingNote}`.toLowerCase();
  return /more|beyond|additional|missing|omitted|not exhaustive|not complete|continue|remaining/.test(note);
}

async function expandUntilExhausted(node) {
  if (!node || node.path.length >= 4 || state.loadingIds.has(node.id)) return;

  let stagnantRounds = 0;
  let shouldContinue = true;

  while (shouldContinue && stagnantRounds < 2) {
    const before = node.children.length;
    await expandNode(node, before ? "find_more" : "initial", { selectFirstChild: false });
    const gained = node.children.length - before;
    stagnantRounds = gained > 0 ? 0 : stagnantRounds + 1;
    shouldContinue = mayHaveMoreChildren(node, gained);

    if (!apiKey() && !state.serverKeyReady) {
      break;
    }
  }

  node.status = `Loaded ${node.children.length} direct children${stagnantRounds ? "; no new unique siblings were returned." : "."}`;
  setSelected(node);
}

function fallbackExplanation(node) {
  const path = node.path.join(" > ");
  const parent = node.path.length > 1 ? node.path[node.path.length - 2] : "human knowledge";
  const examples = contextualTerms(node).slice(0, 3);

  return {
    simple_definition: `${node.name} is a topic in ${parent}. In school-level terms, it is a way of organizing ideas so you can ask clearer questions and find better sources.`,
    why_it_matters: `It matters because ${node.name} gives you vocabulary for searching, comparing examples, and understanding how this part of knowledge connects to the wider path ${path}.`,
    example: examples.length
      ? `For example, if you search for ${examples.map((item) => `"${item}"`).join(" + ")}, you are more likely to find material that is about this exact topic rather than a vague nearby subject.`
      : `For example, a student could start by asking what the main objects, problems, and uses of ${node.name} are.`,
    analogy: `Think of it like a labeled drawer in a large library cabinet: the label helps you know what belongs there and what probably belongs somewhere else.`,
    study_questions: [
      `What does ${node.name} study?`,
      `What are two examples of ${node.name}?`,
      `How does ${node.name} connect to ${parent}?`,
    ],
  };
}

async function explainSelectedNode() {
  const node = selectedNode();
  if (!node) return;

  node.explanationStatus = "loading";
  render();

  try {
    const payload = await fetchJson("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        summary: node.summary,
        keywords: contextualTerms(node),
        apiKey: apiKey(),
      }),
    });
    node.explanation = payload.explanation || fallbackExplanation(node);
    node.explanationStatus = "success";
  } catch {
    node.explanation = fallbackExplanation(node);
    node.explanationStatus = "success";
  }

  render();
}

function clearNextLevel(node) {
  if (!node) return;
  node.children = [];
  node.status = "Cleared the next level under this item.";
  node.remainingNote = "";
  setSelected(node);
}

function clearAllLevels() {
  state.roots = [];
  state.selectedId = "";
  state.activePathIds = [];
  state.search = "";
  refs.searchInput.value = "";
  render();
}

function contextualTerms(node) {
  if (!node) return [];
  const level2 = node.path[1] || "";
  const focus = node.path.length >= 4 ? node.path[3] : node.path[2] || "";
  return uniqueStrings([focus, level2].filter(Boolean)).slice(0, 2);
}

function preciseSearchQuery(node, focusTerm = "") {
  if (!node) return "";
  const level = node.path.length;
  const level2 = node.path[1] || "";
  const level3 = node.path[2] || "";
  const level4 = node.path[3] || "";
  const requested = normalizeWhitespace(focusTerm);
  const focus = level >= 4
    ? level4
    : level >= 3
      ? level3
      : requested && requested !== level2
        ? requested
        : "";
  const terms = level2 ? uniqueStrings([focus, level2].filter(Boolean)).slice(0, 2) : [node.name];

  return terms
    .map((term) => (/\s/.test(term) ? `"${term}"` : term))
    .join(" ");
}

function openProvider(providerKey, node, focusTerm = "") {
  const provider = SEARCH_PROVIDERS[providerKey];
  if (!provider || !node) return;
  const url = provider.url(preciseSearchQuery(node, focusTerm));
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.href = url;
  }
}

function clear(element) {
  element.replaceChildren();
}

function createKeywordChips(node, target) {
  clear(target);
  const query = preciseSearchQuery(node);
  if (!query) return;

  const queryChip = document.createElement("span");
  queryChip.className = "keyword-chip query-chip";
  queryChip.textContent = `Library query: ${query}`;
  queryChip.title = "This exact query is sent to WorldCat, Scholar, ETH, and Michigan.";
  target.appendChild(queryChip);

  for (const term of contextualTerms(node)) {
    const chip = document.createElement("span");
    chip.className = "keyword-chip context-chip";
    chip.textContent = term;
    chip.title = "Context term used in the library query.";
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
    const query = preciseSearchQuery(node);
    button.title = `${SEARCH_PROVIDERS[button.dataset.provider]?.label || "Library"} search: ${query}`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openProvider(button.dataset.provider, node);
    });
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
    refs.explainButton.disabled = true;
    refs.clearLevelButton.disabled = true;
    refs.searchAllButton.disabled = true;
    refs.selectedStatus.textContent = "";
    refs.explanationPanel.hidden = true;
    clear(refs.explanationContent);
    return;
  }

  refs.selectedLevel.textContent = LEVEL_LABELS[node.path.length];
  refs.selectedName.textContent = node.name;
  refs.selectedSummary.textContent = node.summary;
  refs.selectedPath.textContent = node.path.join(" > ");
  refs.expandButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.moreButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.exhaustButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.expandBranchButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.explainButton.disabled = node.explanationStatus === "loading";
  refs.clearLevelButton.disabled = node.children.length === 0;
  refs.expandButton.textContent = state.loadingIds.has(node.id)
    ? "Generating..."
    : node.path.length >= 4
      ? "Level 4 reached"
      : `Generate Level ${node.path.length + 1}`;
  refs.moreButton.textContent = node.path.length >= 4 ? "Level 4 reached" : "Find More Siblings";
  refs.exhaustButton.textContent = node.path.length >= 4 ? "Level 4 reached" : "Expand Until Exhausted";
  refs.expandBranchButton.textContent = node.path.length >= 4 ? "Branch Complete" : "Fill Branch to Level 4";
  refs.explainButton.textContent = node.explanationStatus === "loading" ? "Explaining..." : "Explain";
  refs.searchAllButton.disabled = false;
  refs.selectedStatus.textContent = [node.status, node.remainingNote, node.cautionNote].filter(Boolean).join(" ");
  createKeywordChips(node, refs.selectedKeywords);
  renderExplanation(node);
}

function renderExplanation(node) {
  clear(refs.explanationContent);
  refs.explanationPanel.hidden = !node.explanation && node.explanationStatus !== "loading";

  if (node.explanationStatus === "loading") {
    refs.explanationContent.textContent = "Building a school-level explanation...";
    return;
  }

  if (!node.explanation) return;

  const sections = [
    ["What it means", node.explanation.simple_definition],
    ["Why it matters", node.explanation.why_it_matters],
    ["Example", node.explanation.example],
    ["Analogy", node.explanation.analogy],
  ];

  for (const [title, text] of sections) {
    if (!text) continue;
    const block = document.createElement("section");
    const heading = document.createElement("h4");
    const paragraph = document.createElement("p");
    heading.textContent = title;
    paragraph.textContent = text;
    block.append(heading, paragraph);
    refs.explanationContent.appendChild(block);
  }

  if (Array.isArray(node.explanation.study_questions) && node.explanation.study_questions.length) {
    const block = document.createElement("section");
    const heading = document.createElement("h4");
    const list = document.createElement("ul");
    heading.textContent = "Check your understanding";
    for (const question of node.explanation.study_questions) {
      const item = document.createElement("li");
      item.textContent = question;
      list.appendChild(item);
    }
    block.append(heading, list);
    refs.explanationContent.appendChild(block);
  }
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
refs.exhaustButton.addEventListener("click", () => expandUntilExhausted(selectedNode()));
refs.expandBranchButton.addEventListener("click", () => fillBranchToLevelFour(selectedNode()));
refs.explainButton.addEventListener("click", () => explainSelectedNode());
refs.clearLevelButton.addEventListener("click", () => clearNextLevel(selectedNode()));
refs.clearAllButton.addEventListener("click", () => clearAllLevels());
refs.searchAllButton.addEventListener("click", (event) => {
  event.preventDefault();
  openProvider("scholar", selectedNode());
});

render();
refreshHealth();
