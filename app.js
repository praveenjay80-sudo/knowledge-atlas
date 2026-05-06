const STATIC_TAXONOMY_URL = "/data/human_scientific_knowledge_taxonomy.json";
const MAX_VISIBLE_LEVEL = 4;

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
    name: "Interdisciplinary and integrative studies",
    summary: "Cross-domain knowledge areas that combine methods, evidence, and problems from multiple traditions.",
    keywords: ["interdisciplinary studies", "systems", "cognitive science", "environment", "data"],
  },
];

const LEVEL_LABELS = {
  1: "Level 1 Domain",
  2: "Level 2 Field",
  3: "Level 3 Subfield",
  4: "Level 4 Specialty",
};

const LEVEL_TITLES = {
  1: "Domains",
  2: "Fields",
  3: "Subfields",
  4: "Specialties",
};

const READING_CATEGORY_LABELS = {
  pedagogy_texts: "Basic texts",
  seminal_works: "Founding and seminal works",
  breakthrough_works: "Breakthrough works",
  reference_works: "Reference works",
  recent_syntheses: "Advanced syntheses",
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
  openalex: {
    label: "OpenAlex",
    url: (query) => `https://openalex.org/works?filter=default.search:${encodeURIComponent(query)}`,
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
  selectedSearchProviders: document.querySelector("#selectedSearchProviders"),
  expandButton: document.querySelector("#expandButton"),
  moreButton: document.querySelector("#moreButton"),
  exhaustButton: document.querySelector("#exhaustButton"),
  expandBranchButton: document.querySelector("#expandBranchButton"),
  explainButton: document.querySelector("#explainButton"),
  readingButton: document.querySelector("#readingButton"),
  clearLevelButton: document.querySelector("#clearLevelButton"),
  clearAllButton: document.querySelector("#clearAllButton"),
  searchAllButton: document.querySelector("#searchAllButton"),
  selectedStatus: document.querySelector("#selectedStatus"),
  explanationPanel: document.querySelector("#explanationPanel"),
  explanationContent: document.querySelector("#explanationContent"),
  readingPanel: document.querySelector("#readingPanel"),
  readingContent: document.querySelector("#readingContent"),
  levelGrid: document.querySelector(".level-grid"),
  levelSelectTemplate: document.querySelector("#levelSelectTemplate"),
  nodeTemplate: document.querySelector("#nodeTemplate"),
  childPanelTitle: document.querySelector("#childPanelTitle"),
  childDataList: document.querySelector("#childDataList"),
  resultTemplate: document.querySelector("#resultTemplate"),
};

const state = {
  health: "Checking API...",
  staticStatus: "Loading atlas...",
  serverKeyReady: false,
  roots: [],
  selectedId: "",
  activePathIds: [],
  search: "",
  loadingIds: new Set(),
  counts: {},
  generatedAt: "",
};

function makeId(path) {
  return path.join(" > ");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanName(value) {
  return normalizeWhitespace(value)
    .replace(/\s*\{[^}]*\}/g, "")
    .replace(/\s*\[[^\]]*(?:see|See)[^\]]*\]/g, "")
    .replace(/\s*--\s*/g, " - ")
    .trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const clean = normalizeWhitespace(value);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

function roleForLevel(level) {
  if (level === 1) return "domain";
  if (level === 2) return "field";
  if (level === 3) return "subfield";
  if (level === 4) return "specialty";
  return "topic";
}

function createNode(item, path) {
  const name = cleanName(item.name);
  const cleanPath = [...path.slice(0, -1), name];
  const node = {
    id: makeId(cleanPath),
    path: cleanPath,
    name,
    originalName: normalizeWhitespace(item.name),
    summary: normalizeWhitespace(item.summary) || `${name} within ${cleanPath.slice(0, -1).pop() || "human scientific knowledge"}.`,
    whyItBelongs: normalizeWhitespace(item.why_it_belongs || item.whyItBelongs),
    keywords: uniqueStrings(item.keywords || cleanPath),
    aliases: uniqueStrings(item.aliases || []),
    likelyHasChildren: item.likely_has_children ?? (Array.isArray(item.children) && item.children.length > 0),
    taxonomyRole: item.taxonomy_role || item.taxonomyRole || roleForLevel(cleanPath.length),
    confidence: item.confidence || "high",
    cautionNote: normalizeWhitespace(item.caution_note || item.cautionNote),
    seminalWorks: Array.isArray(item.seminalWorks) ? item.seminalWorks : [],
    readingList: item.readingList || null,
    children: [],
    status: "",
    remainingNote: "",
    explanation: null,
    explanationStatus: "idle",
    bibliography: null,
    bibliographyStatus: "idle",
  };

  node.children = (item.children || [])
    .map((child) => createNode(child, [...cleanPath, child.name]))
    .filter((child) => child.name);

  return node;
}

function flatten(nodes = state.roots) {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function countLevels() {
  state.counts = {};
  for (const node of flatten()) {
    const level = Math.min(node.path.length, MAX_VISIBLE_LEVEL);
    state.counts[level] = (state.counts[level] || 0) + 1;
  }
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
      : "Static atlas ready; add API key for richer AI results";
  } catch {
    state.health = "Static atlas ready; API route unavailable";
  }
  render();
}

async function loadStaticAtlas() {
  state.staticStatus = "Loading static atlas...";
  render();
  try {
    const payload = await fetchJson(STATIC_TAXONOMY_URL);
    const roots = Array.isArray(payload) ? payload : payload.roots || payload.items || [];
    state.roots = roots.map((item) => createNode(item, [item.name]));
    state.generatedAt = payload.generated_at || payload.generatedAt || "";
    countLevels();
    state.staticStatus = `Loaded ${flatten().length.toLocaleString()} taxonomy items`;
    if (state.roots[0]) setSelected(state.roots[0]);
  } catch (error) {
    state.roots = ROOT_DEFINITIONS.map((item) => createNode(item, [item.name]));
    countLevels();
    state.staticStatus = "Using built-in starter roots";
    if (state.roots[0]) setSelected(state.roots[0]);
  }
  render();
}

function loadRoots() {
  loadStaticAtlas();
}

function mergeChildren(node, items) {
  const existing = new Map(node.children.map((child) => [child.name.toLowerCase(), child]));
  for (const item of items || []) {
    const name = cleanName(item.name);
    if (!name || existing.has(name.toLowerCase())) continue;
    const child = createNode(
      {
        ...item,
        likely_has_children: node.path.length + 1 < MAX_VISIBLE_LEVEL && (item.likely_has_children ?? true),
      },
      [...node.path, name],
    );
    node.children.push(child);
    existing.set(name.toLowerCase(), child);
  }
  node.children.sort((left, right) => left.name.localeCompare(right.name));
  countLevels();
}

async function expandNode(node, mode = "initial", options = {}) {
  const { selectFirstChild = true } = options;
  if (!node || node.path.length >= MAX_VISIBLE_LEVEL) return;
  state.loadingIds.add(node.id);
  node.status = mode === "find_more" ? "Searching for missing sibling topics..." : `Generating ${LEVEL_LABELS[node.path.length + 1].toLowerCase()} items...`;
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
        maxDepth: MAX_VISIBLE_LEVEL,
        apiKey: apiKey(),
      }),
    });
    const before = node.children.length;
    mergeChildren(node, payload.items || []);
    const added = node.children.length - before;
    node.status = added ? payload.overview || `Loaded ${added} new children.` : payload.overview || "No reliable new children were returned.";
    node.remainingNote = payload.remaining_note || "";
    if (selectFirstChild && added && node.children[0]) setSelected(node.children[0]);
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
    if (!node.children.length) await expandNode(node, "initial", { selectFirstChild: false });
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
  if (!node || node.path.length >= MAX_VISIBLE_LEVEL || state.loadingIds.has(node.id)) return;
  let stagnantRounds = 0;
  let shouldContinue = true;
  while (shouldContinue && stagnantRounds < 2) {
    const before = node.children.length;
    await expandNode(node, before ? "find_more" : "initial", { selectFirstChild: false });
    const gained = node.children.length - before;
    stagnantRounds = gained > 0 ? 0 : stagnantRounds + 1;
    shouldContinue = mayHaveMoreChildren(node, gained);
    if (!apiKey() && !state.serverKeyReady) break;
  }
  node.status = `Loaded ${node.children.length} direct children${stagnantRounds ? "; no new unique siblings were returned." : "."}`;
  setSelected(node);
}

function fallbackExplanation(node) {
  const parent = node.path.length > 1 ? node.path[node.path.length - 2] : "human knowledge";
  const examples = contextualTerms(node).slice(0, 3);
  const exampleText = examples.length ? examples.join(", ") : node.name;
  return {
    simple_definition: `${node.name} is a topic in ${parent}. In plain language, it is a named area of study that groups related questions, methods, evidence, and examples.`,
    why_it_matters: `It matters because ${node.name} gives learners and researchers a precise label for finding sources and understanding where this topic sits in the wider map of science.`,
    example: node.summary || (examples.length ? `Search for ${examples.join(" and ")} to find sources about this exact area.` : `A learner could start by asking what ${node.name} studies and what problems it tries to solve.`),
    analogy: "Think of it as a shelf label in a very large research library: it does not contain every book, but it tells you which books belong together.",
    qa_pairs: [
      {
        question: `What is ${node.name} in plain language?`,
        answer: `${node.name} is like a labeled shelf in a research library: it groups related ideas so you know where to look. A real example is using the search phrase "${exampleText}" to find sources about this exact topic instead of searching the whole field of ${parent}.`,
      },
      {
        question: `Why does ${node.name} matter?`,
        answer: `It matters like a street address matters: without it, you only know the city, not the exact building. In real study, the label "${node.name}" helps you find textbooks, papers, experiments, datasets, or applications that belong to this specific area.`,
      },
      {
        question: `How does ${node.name} connect to ${parent}?`,
        answer: `Think of ${parent} as a university and ${node.name} as one department inside it. The department has its own focus, but it shares tools and problems with the rest of the university; for example, a paper on ${node.name} may still use methods or vocabulary from nearby parts of ${parent}.`,
      },
      {
        question: `How should a beginner start learning ${node.name}?`,
        answer: `Start like learning to use a workshop tool: first learn what job the tool is for, then watch it used on a simple project. A real path is to learn the core definition, read one introductory source, and then inspect a concrete example or case study in ${node.name}.`,
      },
    ],
    study_questions: [
      `What does ${node.name} study?`,
      `What are two examples or problems in ${node.name}?`,
      `How does ${node.name} connect to ${parent}?`,
    ],
  };
}

async function explainNode(node) {
  if (!node) return;
  node.explanationStatus = "loading";
  render();
  if (!apiKey() && !state.serverKeyReady) {
    node.explanation = fallbackExplanation(node);
    node.explanationStatus = "success";
    setSelected(node);
    return;
  }
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
  } catch {
    node.explanation = fallbackExplanation(node);
  } finally {
    node.explanationStatus = "success";
    setSelected(node);
  }
}

function localReadingList(node) {
  const topic = node.name;
  const query = preciseSearchQuery(node);
  const searchNote = `Search exact phrase: ${query}`;
  const seededWorks = node.seminalWorks.map((item) => ({
    authors: item.authors || "",
    title: item.title || "",
    year: item.year || "",
    source: "Curated taxonomy seed",
    why_it_matters: item.why_it_matters || "A foundational or field-defining work connected to this topic.",
    confidence: /specialist literature/i.test(item.authors || "") ? "medium" : "high",
  }));
  return {
    note: node.readingList
      ? "Curated reading scaffold from the new taxonomy. Add an OpenAI API key or server key for a more specific bibliography."
      : "Offline reading list scaffold. Add an OpenAI API key or server key for a more specific bibliography with named works.",
    caution_note: "For highly specialized items, verify editions and exact paper titles in a library catalog or index.",
    categories: {
      pedagogy_texts: [
        { authors: "Start here", title: `Introductory textbook or lecture notes on ${topic}`, year: "current", source: searchNote, why_it_matters: "Builds vocabulary and basic examples before primary literature.", confidence: "high" },
      ],
      seminal_works: seededWorks.length ? seededWorks : [
        { authors: "Founding authors vary by subfield", title: `Foundational or original papers on ${topic}`, year: "various", source: `Google Scholar / OpenAlex query: ${query} seminal foundational`, why_it_matters: "Identifies the works that created or stabilized the area.", confidence: "medium" },
      ],
      breakthrough_works: [
        { authors: "Major contributors vary by subfield", title: `Highly cited breakthrough works in ${topic}`, year: "various", source: `Scholar query: ${query} highly cited breakthrough`, why_it_matters: "Shows how the field changed after its initial formation.", confidence: "medium" },
      ],
      reference_works: [
        { authors: "Specialist editors or societies", title: `Handbook, encyclopedia, or survey chapter on ${topic}`, year: "various", source: `WorldCat query: ${query} handbook encyclopedia survey`, why_it_matters: "Gives stable definitions, neighboring areas, and bibliographic trails.", confidence: "medium" },
      ],
      recent_syntheses: [
        { authors: "Recent survey authors", title: `Recent review or synthesis of ${topic}`, year: "recent", source: `OpenAlex query: ${query} review survey`, why_it_matters: "Connects older foundations to current research questions.", confidence: "medium" },
      ],
    },
  };
}

async function readingListForNode(node) {
  if (!node) return;
  node.bibliographyStatus = "loading";
  render();
  if (!apiKey() && !state.serverKeyReady) {
    node.bibliography = {
      note: "Enter an OpenAI API key in the left panel, then press Reading list again to generate a comprehensive bibliography.",
      caution_note: "No API key is configured on the server, so this app needs a browser-provided key for generated reading lists.",
      categories: {
        seminal_works: [],
        breakthrough_works: [],
        pedagogy_texts: [],
        reference_works: [],
        recent_syntheses: [],
      },
    };
    node.bibliographyStatus = "success";
    setSelected(node);
    return;
  }
  try {
    const payload = await fetchJson("/api/bibliography", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        summary: node.summary,
        keywords: contextualTerms(node),
        apiKey: apiKey(),
      }),
    });
    node.bibliography = payload.categories ? payload : {
      note: "The API did not return a structured bibliography. Try again with a narrower selected item.",
      caution_note: "No fallback list was used because this button is configured to generate by API key.",
      categories: {
        seminal_works: [],
        breakthrough_works: [],
        pedagogy_texts: [],
        reference_works: [],
        recent_syntheses: [],
      },
    };
  } catch {
    node.bibliography = {
      note: "The API reading-list request failed. Check the API key and try again.",
      caution_note: "No fallback list was used because this button is configured to generate by API key.",
      categories: {
        seminal_works: [],
        breakthrough_works: [],
        pedagogy_texts: [],
        reference_works: [],
        recent_syntheses: [],
      },
    };
  } finally {
    node.bibliographyStatus = "success";
    setSelected(node);
  }
}

function clearNextLevel(node) {
  if (!node) return;
  node.children = [];
  node.status = "Cleared the next level under this item.";
  node.remainingNote = "";
  countLevels();
  setSelected(node);
}

function clearAllLevels() {
  state.roots = [];
  state.selectedId = "";
  state.activePathIds = [];
  state.search = "";
  state.counts = {};
  refs.searchInput.value = "";
  render();
}

function contextualTerms(node) {
  if (!node) return [];
  return uniqueStrings([node.name, node.path[2], node.path[1], ...node.keywords].filter(Boolean)).slice(0, 5);
}

function preciseSearchQuery(node, focusTerm = "") {
  if (!node) return "";
  const requested = normalizeWhitespace(focusTerm);
  const terms = uniqueStrings([requested || node.name, node.path[2], node.path[1]].filter(Boolean)).slice(0, 3);
  return terms.map((term) => (/\s/.test(term) ? `"${term}"` : term)).join(" ");
}

function openProvider(providerKey, node, focusTerm = "") {
  const provider = SEARCH_PROVIDERS[providerKey];
  if (!provider || !node) return;
  const url = provider.url(preciseSearchQuery(node, focusTerm));
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
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
  queryChip.textContent = `Query: ${query}`;
  target.appendChild(queryChip);

  for (const term of contextualTerms(node).slice(0, 3)) {
    const chip = document.createElement("span");
    chip.className = "keyword-chip context-chip";
    chip.textContent = term;
    target.appendChild(chip);
  }
}

function renderProviderButtons(target, node) {
  clear(target);
  if (!node) return;
  for (const [providerKey, provider] of Object.entries(SEARCH_PROVIDERS)) {
    const button = document.createElement("button");
    button.className = "search-button";
    button.type = "button";
    button.textContent = provider.label;
    button.title = `${provider.label}: ${preciseSearchQuery(node)}`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openProvider(providerKey, node);
    });
    target.appendChild(button);
  }
}

function visibleChildrenForLevel(level) {
  if (level === 1) return state.roots;
  const parentId = state.activePathIds[level - 2];
  const parent = parentId ? findNode(parentId) : null;
  return parent ? parent.children : [];
}

function renderLevels() {
  clear(refs.levelGrid);
  for (let level = 1; level <= MAX_VISIBLE_LEVEL; level += 1) {
    const fragment = refs.levelSelectTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".level-select-card");
    const label = fragment.querySelector(".select-label");
    const select = fragment.querySelector(".level-select");
    const summary = fragment.querySelector(".select-summary");
    const nodes = visibleChildrenForLevel(level);

    card.dataset.level = String(level);
    label.textContent = `${LEVEL_LABELS[level]} - ${LEVEL_TITLES[level]}`;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = level === 1 ? "Choose a domain..." : `Choose ${LEVEL_TITLES[level].toLowerCase()}...`;
    select.appendChild(placeholder);

    if (!nodes.length) {
      select.disabled = true;
      summary.textContent = level === 1 ? "Loading the atlas..." : "Select the previous level first.";
    } else {
      for (const node of nodes) {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = node.name;
        select.appendChild(option);
      }

      const selectedId = state.activePathIds[level - 1] || "";
      select.value = selectedId;
      const selected = selectedId ? findNode(selectedId) : null;
      summary.textContent = selected
        ? selected.summary
        : `${nodes.length.toLocaleString()} ${LEVEL_TITLES[level].toLowerCase()} available.`;
    }

    select.addEventListener("change", (event) => {
      const node = event.target.value ? findNode(event.target.value) : null;
      if (node) setSelected(node);
    });

    refs.levelGrid.appendChild(fragment);
  }
}

function renderNodeCard(node) {
  const fragment = refs.nodeTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".node-card");
  const main = fragment.querySelector(".node-main");
  const inlineExpand = fragment.querySelector(".expand-inline");
  const explainInline = fragment.querySelector(".explain-inline");
  const readingInline = fragment.querySelector(".reading-inline");
  const level = Math.min(node.path.length, MAX_VISIBLE_LEVEL);

  card.classList.toggle("selected", node.id === state.selectedId);
  fragment.querySelector(".node-level").textContent = LEVEL_LABELS[level];
  fragment.querySelector(".node-name").textContent = node.name;
  fragment.querySelector(".node-summary").textContent = node.summary;
  createKeywordChips(node, fragment.querySelector(".node-keywords"));
  renderProviderButtons(fragment.querySelector(".node-search-providers"), node);

  main.addEventListener("click", () => setSelected(node));

  inlineExpand.hidden = node.path.length >= MAX_VISIBLE_LEVEL;
  inlineExpand.disabled = state.loadingIds.has(node.id);
  inlineExpand.textContent = state.loadingIds.has(node.id) ? "Generating..." : `Generate Level ${node.path.length + 1}`;
  inlineExpand.addEventListener("click", () => expandNode(node));

  explainInline.disabled = node.explanationStatus === "loading";
  explainInline.textContent = node.explanationStatus === "loading" ? "Explaining..." : "Explain";
  explainInline.addEventListener("click", () => explainNode(node));

  readingInline.disabled = node.bibliographyStatus === "loading";
  readingInline.textContent = node.bibliographyStatus === "loading" ? "Reading..." : "Reading list";
  readingInline.addEventListener("click", () => readingListForNode(node));

  return fragment;
}

function renderChildDataPanel() {
  clear(refs.childDataList);
  const node = selectedNode();
  if (!node) {
    refs.childPanelTitle.textContent = "Children of selected item";
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "Select a taxonomy item to see its data points.";
    refs.childDataList.appendChild(empty);
    return;
  }

  const nextLevel = node.path.length + 1;
  refs.childPanelTitle.textContent = node.children.length
    ? `${node.children.length.toLocaleString()} ${LEVEL_TITLES[nextLevel] || "data points"} under ${node.name}`
    : `No loaded children under ${node.name}`;

  if (!node.children.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = node.path.length >= MAX_VISIBLE_LEVEL
      ? "This is a Level 4 item. Use Explain, Reading list, and library searches above."
      : "No children are loaded yet. Use Generate Next Level to add more items.";
    refs.childDataList.appendChild(empty);
    return;
  }

  for (const child of node.children) {
    refs.childDataList.appendChild(renderNodeCard(child));
  }
}

function renderSelected() {
  const node = selectedNode();
  if (!node) {
    refs.selectedLevel.textContent = "No Selection";
    refs.selectedName.textContent = "Loading the scientific knowledge atlas";
    refs.selectedSummary.textContent = "The app loads a large static taxonomy first, then lets you generate, explain, search, and build reading lists for any item.";
    refs.selectedPath.textContent = "";
    clear(refs.selectedKeywords);
    clear(refs.selectedSearchProviders);
    refs.expandButton.disabled = true;
    refs.moreButton.disabled = true;
    refs.exhaustButton.disabled = true;
    refs.expandBranchButton.disabled = true;
    refs.explainButton.disabled = true;
    refs.readingButton.disabled = true;
    refs.clearLevelButton.disabled = true;
    refs.searchAllButton.disabled = true;
    refs.selectedStatus.textContent = state.staticStatus;
    refs.explanationPanel.hidden = true;
    refs.readingPanel.hidden = true;
    clear(refs.explanationContent);
    clear(refs.readingContent);
    return;
  }

  const level = Math.min(node.path.length, MAX_VISIBLE_LEVEL);
  refs.selectedLevel.textContent = LEVEL_LABELS[level];
  refs.selectedName.textContent = node.name;
  refs.selectedSummary.textContent = node.summary;
  refs.selectedPath.textContent = node.path.join(" > ");
  refs.expandButton.disabled = node.path.length >= MAX_VISIBLE_LEVEL || state.loadingIds.has(node.id);
  refs.moreButton.disabled = node.path.length >= MAX_VISIBLE_LEVEL || state.loadingIds.has(node.id);
  refs.exhaustButton.disabled = node.path.length >= MAX_VISIBLE_LEVEL || state.loadingIds.has(node.id);
  refs.expandBranchButton.disabled = node.path.length >= 4 || state.loadingIds.has(node.id);
  refs.explainButton.disabled = node.explanationStatus === "loading";
  refs.readingButton.disabled = node.bibliographyStatus === "loading";
  refs.clearLevelButton.disabled = node.children.length === 0;
  refs.searchAllButton.disabled = false;
  refs.expandButton.textContent = state.loadingIds.has(node.id) ? "Generating..." : node.path.length >= MAX_VISIBLE_LEVEL ? "Maximum depth reached" : `Generate Level ${node.path.length + 1}`;
  refs.explainButton.textContent = node.explanationStatus === "loading" ? "Explaining..." : "Explain";
  refs.readingButton.textContent = node.bibliographyStatus === "loading" ? "Building list..." : "Reading list";
  refs.selectedStatus.textContent = [
    state.staticStatus,
    state.generatedAt ? `Dataset generated ${new Date(state.generatedAt).toLocaleDateString()}.` : "",
    node.children.length ? `${node.children.length.toLocaleString()} direct children.` : "No loaded children below this item.",
    node.status,
    node.remainingNote,
    node.cautionNote,
  ].filter(Boolean).join(" ");
  createKeywordChips(node, refs.selectedKeywords);
  renderProviderButtons(refs.selectedSearchProviders, node);
  renderExplanation(node);
  renderBibliography(node);
}

function renderExplanation(node) {
  clear(refs.explanationContent);
  refs.explanationPanel.hidden = !node.explanation && node.explanationStatus !== "loading";
  if (node.explanationStatus === "loading") {
    refs.explanationContent.textContent = "Building a plain-language explanation...";
    return;
  }
  if (!node.explanation) return;

  if (Array.isArray(node.explanation.qa_pairs) && node.explanation.qa_pairs.length) {
    const block = document.createElement("section");
    block.className = "qa-block";
    const heading = document.createElement("h4");
    heading.textContent = "Questions and answers";
    block.appendChild(heading);

    for (const pair of node.explanation.qa_pairs) {
      const item = document.createElement("article");
      item.className = "qa-item";
      const question = document.createElement("h5");
      const answer = document.createElement("p");
      question.textContent = pair.question || "Question";
      answer.textContent = pair.answer || "";
      item.append(question, answer);
      block.appendChild(item);
    }

    refs.explanationContent.appendChild(block);
  }

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

function renderBibliography(node) {
  clear(refs.readingContent);
  refs.readingPanel.hidden = !node.bibliography && node.bibliographyStatus !== "loading";
  if (node.bibliographyStatus === "loading") {
    refs.readingContent.textContent = "Building a reading list from basic to advanced...";
    return;
  }
  if (!node.bibliography) return;

  if (node.bibliography.note) {
    const note = document.createElement("p");
    note.className = "reading-note";
    note.textContent = node.bibliography.note;
    refs.readingContent.appendChild(note);
  }

  const categories = node.bibliography.categories || {};
  for (const [key, label] of Object.entries(READING_CATEGORY_LABELS)) {
    const items = categories[key] || [];
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    heading.textContent = label;
    section.appendChild(heading);

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-reading";
      empty.textContent = "No conservative recommendation returned for this category.";
      section.appendChild(empty);
    } else {
      const list = document.createElement("ol");
      for (const item of items) {
        const li = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = item.title || "Untitled work";
        const meta = document.createElement("span");
        meta.textContent = ` ${[item.authors, item.year, item.source].filter(Boolean).join(" | ")}`;
        const why = document.createElement("p");
        why.textContent = item.why_it_matters || "";
        li.append(title, meta, why);
        list.appendChild(li);
      }
      section.appendChild(list);
    }
    refs.readingContent.appendChild(section);
  }

  if (node.bibliography.caution_note) {
    const caution = document.createElement("p");
    caution.className = "reading-note";
    caution.textContent = node.bibliography.caution_note;
    refs.readingContent.appendChild(caution);
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
    .slice(0, 80);

  for (const node of matches) {
    const fragment = refs.resultTemplate.content.cloneNode(true);
    fragment.querySelector(".result-path").textContent = node.path.join(" > ");
    fragment.querySelector(".result-name").textContent = node.name;
    fragment.querySelector(".result-item").addEventListener("click", () => setSelected(node));
    refs.searchResults.appendChild(fragment);
  }
}

function renderCounts() {
  const parts = [];
  for (let level = 1; level <= MAX_VISIBLE_LEVEL; level += 1) {
    if (state.counts[level]) parts.push(`L${level}: ${state.counts[level].toLocaleString()}`);
  }
  refs.nodeCount.textContent = parts.length ? parts.join("  ") : "0 items";
}

function render() {
  refs.apiStatus.textContent = apiKey() ? "Browser API key ready" : state.health;
  renderCounts();
  renderSelected();
  renderLevels();
  renderChildDataPanel();
  renderSearch();
}

refs.loadRootsButton.addEventListener("click", loadRoots);
refs.resetButton.addEventListener("click", loadStaticAtlas);
refs.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderSearch();
});
refs.apiKeyInput.addEventListener("input", render);
refs.expandButton.addEventListener("click", () => expandNode(selectedNode()));
refs.moreButton.addEventListener("click", () => expandNode(selectedNode(), "find_more"));
refs.exhaustButton.addEventListener("click", () => expandUntilExhausted(selectedNode()));
refs.expandBranchButton.addEventListener("click", () => fillBranchToLevelFour(selectedNode()));
refs.explainButton.addEventListener("click", () => explainNode(selectedNode()));
refs.readingButton.addEventListener("click", () => readingListForNode(selectedNode()));
refs.clearLevelButton.addEventListener("click", () => clearNextLevel(selectedNode()));
refs.clearAllButton.addEventListener("click", () => clearAllLevels());
refs.searchAllButton.addEventListener("click", (event) => {
  event.preventDefault();
  openProvider("scholar", selectedNode());
});

render();
loadStaticAtlas();
refreshHealth();
