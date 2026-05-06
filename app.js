const STATIC_TAXONOMY_URL = "/data/human_scientific_knowledge_taxonomy.json";
const MAX_VISIBLE_LEVEL = 5;

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
  5: "Level 5 Concept",
};

const LEVEL_TITLES = {
  1: "Domains",
  2: "Fields",
  3: "Subfields",
  4: "Specialties",
  5: "Concepts",
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
  auditLevelButton: document.querySelector("#auditLevelButton"),
  explainButton: document.querySelector("#explainButton"),
  readingButton: document.querySelector("#readingButton"),
  auditBibliographyButton: document.querySelector("#auditBibliographyButton"),
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
    auditStatus: "idle",
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

const GENERIC_L5_PATTERNS = [
  /\bdefinitions?\b/,
  /\bscope\b/,
  /\bcore objects?\b/,
  /\bbasic examples?\b/,
  /\bstandard models?\b/,
  /\bcentral (?:theorems?|principles?)\b/,
  /\bcanonical problems?\b/,
  /\bmethods? and techniques?\b/,
  /\bmeasurements? and evidence\b/,
  /\bclassification schemes?\b/,
  /\bassumptions? and limitations?\b/,
  /\bapplications?\b/,
  /\bhistorical foundations?\b/,
  /\bmodern variants?\b/,
  /\bcomputational tools?\b/,
  /\bexperimental or observational methods?\b/,
  /\bnotation and terminology\b/,
  /\bopen problems?\b/,
  /\blinks? to neighboring topics?\b/,
  /\btutorials?\b/,
  /\bsurveys?\b/,
  /\bcase studies?\b/,
  /\bresources?\b/,
];

function canonicalConceptKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|of|and|for|in|to|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeGenericLevelFive(item, parentNode) {
  const name = cleanName(item?.name || "");
  const canonicalName = canonicalConceptKey(name);
  const canonicalParent = canonicalConceptKey(parentNode?.name || "");

  if (!name || canonicalName.length < 3 || name.length > 90) return true;
  if (canonicalName === canonicalParent) return true;
  if (canonicalParent && canonicalName.startsWith(`${canonicalParent} `)) {
    const suffix = canonicalName.slice(canonicalParent.length).trim();
    if (GENERIC_L5_PATTERNS.some((pattern) => pattern.test(suffix))) return true;
  }
  return GENERIC_L5_PATTERNS.some((pattern) => pattern.test(canonicalName));
}

function filterLevelFiveItems(parentNode, items) {
  const existing = new Set(parentNode.children.map((child) => canonicalConceptKey(child.name)));
  const seen = new Set(existing);
  const accepted = [];
  const dropped = [];

  for (const item of items || []) {
    const name = cleanName(item?.name || "");
    const key = canonicalConceptKey(name);
    if (!key || seen.has(key) || looksLikeGenericLevelFive(item, parentNode)) {
      if (name) dropped.push(name);
      continue;
    }
    seen.add(key);
    accepted.push({
      ...item,
      name,
      likely_has_children: false,
      taxonomy_role: item.taxonomy_role || item.taxonomyRole || "concept_family",
      confidence: item.confidence === "low" ? "medium" : item.confidence || "medium",
    });
  }

  return { accepted, dropped };
}

async function expandNode(node, mode = "initial", options = {}) {
  const { selectFirstChild = true } = options;
  if (!node || node.path.length >= MAX_VISIBLE_LEVEL) return;
  const isLevelFiveRequest = node.path.length === 4;
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
    const incoming = isLevelFiveRequest ? filterLevelFiveItems(node, payload.items || []) : { accepted: payload.items || [], dropped: [] };
    mergeChildren(node, incoming.accepted);
    const added = node.children.length - before;
    const filteredNote = incoming.dropped.length
      ? ` Suppressed ${incoming.dropped.length} generic or duplicate L5 item${incoming.dropped.length === 1 ? "" : "s"}.`
      : "";
    node.status = added
      ? `${payload.overview || `Loaded ${added} Level 5 concepts.`}${filteredNote}`
      : isLevelFiveRequest
        ? `${payload.overview || "No real Level 5 concepts passed validation."}${filteredNote} Try a narrower L4 item, paste an API key, or use Find More Siblings.`
        : payload.overview || "No reliable new children were returned.";
    node.remainingNote = payload.remaining_note || "";
    if (selectFirstChild && added && node.children[0]) setSelected(node.children[0]);
  } catch (error) {
    node.status = isLevelFiveRequest
      ? `Level 5 generation failed: ${error.message || "unknown error"}. No fallback concepts were added.`
      : error.message || "Generation failed.";
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
    simple_definition: `${node.name} is a topic in ${parent}. In plain language, it is a focused reading area: a named cluster of questions, methods, examples, technical vocabulary, and evidence that belongs together closely enough for a learner to study it as its own unit.`,
    why_it_matters: `It matters because ${node.name} gives learners and researchers a precise target. Instead of searching the whole field of ${parent}, a learner can look for the main textbooks, survey papers, classic arguments, standard examples, and current research questions attached to this specific topic.`,
    example: node.summary || (examples.length ? `A practical starting point is to search for ${examples.join(" and ")} together with "${node.name}", then compare an introductory source, a handbook chapter, and a recent review.` : `A learner could start by asking what ${node.name} studies, which examples define it, what methods it uses, and which sources are treated as standard references.`),
    analogy: "Think of it as a well-labeled course module inside a large curriculum: it is smaller than the whole subject, but large enough to deserve readings, examples, exercises, and expert debates of its own.",
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
      {
        question: `What should I look for in a good reading list on ${node.name}?`,
        answer: `Think of a reading list like a guided trail through unfamiliar terrain: it should start with a clear map, then lead to landmarks, then finally to harder routes. For ${node.name}, that means looking for one beginner-friendly explanation, one authoritative reference source, a few field-defining works, and recent reviews that show what specialists care about now. A real example is comparing a textbook chapter with a survey article: the textbook teaches the vocabulary, while the survey shows how researchers currently organize the topic. If a source only mentions ${node.name} in passing, it is probably too broad for this level.`,
      },
      {
        question: `What mistakes do beginners often make with ${node.name}?`,
        answer: `A common mistake is treating the topic like a single isolated fact, when it is really more like a small toolkit. For example, a learner might memorize a term connected to ${node.name} without asking what problem it solves, where it appears in real work, or how experts test claims about it. The better approach is to connect the term to examples, methods, and sources. When reading, notice whether the author is defining the topic, applying it, criticizing it, or extending it.`,
      },
    ],
    study_questions: [
      `What does ${node.name} study?`,
      `What are two examples or problems in ${node.name}?`,
      `How does ${node.name} connect to ${parent}?`,
      `Which beginner source and which advanced source would you compare first?`,
      `What would count as evidence, proof, or a good example in ${node.name}?`,
    ],
  };
}

async function explainNode(node) {
  if (!node) return;
  node.explanationStatus = "loading";
  node.status = "Building explanation...";
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
  } catch (error) {
    node.status = `Explanation API failed: ${error.message || "unknown error"}. Showing local explanation.`;
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
        { authors: "Course instructors or open education authors", title: `University syllabus and lecture sequence for ${topic}`, year: "current", source: `Search query: ${query} syllabus lecture notes`, why_it_matters: "Shows the order in which the topic is normally taught, including prerequisites, exercises, and standard examples.", confidence: "medium" },
        { authors: "Specialist educators", title: `Worked examples, problem sets, or casebook material for ${topic}`, year: "various", source: `Search query: ${query} worked examples problems casebook`, why_it_matters: "Turns definitions into usable skill by showing how experts solve typical problems or interpret real cases.", confidence: "medium" },
      ],
      seminal_works: seededWorks.length ? seededWorks : [
        { authors: "Founding authors vary by subfield", title: `Foundational or original papers on ${topic}`, year: "various", source: `Google Scholar / OpenAlex query: ${query} seminal foundational`, why_it_matters: "Identifies the works that created or stabilized the area.", confidence: "medium" },
        { authors: "Canonical authors vary by subfield", title: `Classic monographs or source papers that established ${topic}`, year: "various", source: `WorldCat / Scholar query: ${query} classic monograph`, why_it_matters: "Helps separate historically important sources from later summaries and classroom simplifications.", confidence: "medium" },
      ],
      breakthrough_works: [
        { authors: "Major contributors vary by subfield", title: `Highly cited breakthrough works in ${topic}`, year: "various", source: `Scholar query: ${query} highly cited breakthrough`, why_it_matters: "Shows how the field changed after its initial formation.", confidence: "medium" },
        { authors: "Research communities and review authors", title: `Turning-point debates, experiments, proofs, or models in ${topic}`, year: "various", source: `OpenAlex query: ${query} review turning point`, why_it_matters: "Highlights the moments where the topic's methods, assumptions, or accepted examples shifted.", confidence: "medium" },
      ],
      reference_works: [
        { authors: "Specialist editors or societies", title: `Handbook, encyclopedia, or survey chapter on ${topic}`, year: "various", source: `WorldCat query: ${query} handbook encyclopedia survey`, why_it_matters: "Gives stable definitions, neighboring areas, and bibliographic trails.", confidence: "medium" },
        { authors: "Professional societies or standards bodies", title: `Terminology, standards, or reference guide for ${topic}`, year: "current", source: `Search query: ${query} terminology standard reference`, why_it_matters: "Useful for checking exact vocabulary and avoiding vague or overloaded terms.", confidence: "medium" },
        { authors: "Specialist editors", title: `Companion or state-of-the-field chapter on ${topic}`, year: "various", source: `WorldCat query: ${query} companion handbook`, why_it_matters: "Connects the topic to neighboring concepts and gives a route into deeper bibliographies.", confidence: "medium" },
      ],
      recent_syntheses: [
        { authors: "Recent survey authors", title: `Recent review or synthesis of ${topic}`, year: "recent", source: `OpenAlex query: ${query} review survey`, why_it_matters: "Connects older foundations to current research questions.", confidence: "medium" },
        { authors: "Recent specialist reviewers", title: `Current challenges and research directions in ${topic}`, year: "recent", source: `Scholar query: ${query} current challenges research directions`, why_it_matters: "Shows what is unsettled, what is actively studied, and what an advanced reader should watch next.", confidence: "medium" },
        { authors: "Bibliometric or review authors", title: `Citation map or systematic review of ${topic}`, year: "recent", source: `OpenAlex query: ${query} systematic review bibliometric`, why_it_matters: "Helps identify clusters of literature and the most connected works without relying on one author’s judgment.", confidence: "medium" },
      ],
    },
  };
}

async function readingListForNode(node) {
  if (!node) return;
  node.bibliographyStatus = "loading";
  node.status = "Building reading list...";
  render();
  if (!apiKey() && !state.serverKeyReady) {
    node.status = "No API key configured. Showing the built-in starter list; paste an API key for a generated comprehensive list.";
    node.bibliography = localReadingList(node);
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
    node.status = "Generated reading list with the configured API key.";
  } catch (error) {
    node.status = `Reading-list API failed: ${error.message || "unknown error"}. Showing the built-in starter list.`;
    node.bibliography = localReadingList(node);
  } finally {
    node.bibliographyStatus = "success";
    setSelected(node);
  }
}

function hasLiveApiKey() {
  return Boolean(apiKey() || state.serverKeyReady);
}

async function auditMissingLevelItems(node) {
  if (!node || node.path.length >= MAX_VISIBLE_LEVEL || state.loadingIds.has(node.id)) return;
  if (!hasLiveApiKey()) {
    node.status = "Paste an OpenAI API key or configure OPENAI_API_KEY before running a dynamic taxonomy audit.";
    setSelected(node);
    return;
  }

  state.loadingIds.add(node.id);
  node.auditStatus = "loading";
  node.status = `Auditing ${LEVEL_TITLES[node.path.length + 1].toLowerCase()} under ${node.name} for missing items...`;
  render();

  try {
    const before = node.children.length;
    const payload = await fetchJson("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "taxonomy",
        path: node.path,
        summary: node.summary,
        keywords: contextualTerms(node),
        existingChildren: node.children.flatMap((child) => [child.name, ...child.aliases]),
        breadth: refs.breadthSelect.value,
        customFocus: refs.focusInput.value.trim(),
        maxDepth: MAX_VISIBLE_LEVEL,
        apiKey: apiKey(),
      }),
    });
    const incoming = node.path.length === 4 ? filterLevelFiveItems(node, payload.items || []) : { accepted: payload.items || [], dropped: [] };
    mergeChildren(node, incoming.accepted);
    const added = node.children.length - before;
    node.status = added
      ? `${payload.overview || "Audit found missing taxonomy items."} Added ${added} new item${added === 1 ? "" : "s"}.`
      : payload.overview || "Audit found no missing taxonomy items that were safe to add.";
    node.remainingNote = payload.remaining_note || "";
  } catch (error) {
    node.status = `Taxonomy audit failed: ${error.message || "unknown error"}.`;
  } finally {
    node.auditStatus = "success";
    state.loadingIds.delete(node.id);
    setSelected(node);
  }
}

function bibliographyKey(item) {
  return [item.title, item.authors, item.year]
    .map((value) => normalizeWhitespace(value).toLowerCase())
    .join("|");
}

function mergeBibliographyCategories(node, incomingCategories = {}) {
  if (!node.bibliography) node.bibliography = localReadingList(node);
  if (!node.bibliography.categories) node.bibliography.categories = {};

  let added = 0;
  for (const key of Object.keys(READING_CATEGORY_LABELS)) {
    const existing = Array.isArray(node.bibliography.categories[key])
      ? node.bibliography.categories[key]
      : [];
    const seen = new Set(existing.map(bibliographyKey));
    const incoming = Array.isArray(incomingCategories[key]) ? incomingCategories[key] : [];
    for (const item of incoming) {
      const cleanTitle = normalizeWhitespace(item.title);
      if (!cleanTitle) continue;
      const cleanItem = {
        authors: normalizeWhitespace(item.authors),
        title: cleanTitle,
        year: normalizeWhitespace(item.year),
        source: normalizeWhitespace(item.source),
        why_it_matters: normalizeWhitespace(item.why_it_matters),
        confidence: item.confidence || "medium",
      };
      const keyValue = bibliographyKey(cleanItem);
      if (seen.has(keyValue)) continue;
      existing.push(cleanItem);
      seen.add(keyValue);
      added += 1;
    }
    node.bibliography.categories[key] = existing;
  }
  return added;
}

async function auditBibliography(node) {
  if (!node) return;
  if (!hasLiveApiKey()) {
    node.status = "Paste an OpenAI API key or configure OPENAI_API_KEY before running a bibliography audit.";
    setSelected(node);
    return;
  }

  node.bibliographyStatus = "loading";
  node.auditStatus = "loading";
  node.status = "Auditing bibliography for missing foundational, reference, and recent synthesis works...";
  render();

  try {
    if (!node.bibliography) node.bibliography = localReadingList(node);
    const payload = await fetchJson("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bibliography",
        path: node.path,
        summary: node.summary,
        keywords: contextualTerms(node),
        bibliography: node.bibliography,
        apiKey: apiKey(),
      }),
    });
    const added = mergeBibliographyCategories(node, payload.categories || {});
    node.bibliography.note = payload.note || node.bibliography.note || "Bibliography audited with the configured API key.";
    node.bibliography.caution_note = payload.caution_note || node.bibliography.caution_note || "";
    node.status = added
      ? `Bibliography audit added ${added} missing work${added === 1 ? "" : "s"}.`
      : "Bibliography audit found no new unique works to add.";
  } catch (error) {
    node.status = `Bibliography audit failed: ${error.message || "unknown error"}.`;
  } finally {
    node.bibliographyStatus = "success";
    node.auditStatus = "success";
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
      ? "This is a Level 5 concept. Use Explain, Reading list, and library searches above."
      : node.path.length === 4
        ? "No Level 5 concepts are loaded yet. Use Generate Level 5 Concepts above; an API key gives the most comprehensive list."
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
    refs.auditLevelButton.disabled = true;
    refs.explainButton.disabled = true;
    refs.readingButton.disabled = true;
    refs.auditBibliographyButton.disabled = true;
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
  refs.auditLevelButton.disabled = node.path.length >= MAX_VISIBLE_LEVEL || state.loadingIds.has(node.id);
  refs.explainButton.disabled = node.explanationStatus === "loading";
  refs.readingButton.disabled = node.bibliographyStatus === "loading";
  refs.auditBibliographyButton.disabled = node.bibliographyStatus === "loading";
  refs.clearLevelButton.disabled = node.children.length === 0;
  refs.searchAllButton.disabled = false;
  refs.expandButton.textContent = state.loadingIds.has(node.id)
    ? "Generating..."
    : node.path.length >= MAX_VISIBLE_LEVEL
      ? "Maximum depth reached"
      : node.path.length === 4
        ? "Generate Level 5 Concepts"
        : `Generate Level ${node.path.length + 1}`;
  refs.explainButton.textContent = node.explanationStatus === "loading" ? "Explaining..." : "Explain";
  refs.readingButton.textContent = node.bibliographyStatus === "loading" ? "Building list..." : "Reading list";
  refs.auditLevelButton.textContent = node.auditStatus === "loading" && state.loadingIds.has(node.id) ? "Auditing..." : "Audit Missing Level Items";
  refs.auditBibliographyButton.textContent = node.bibliographyStatus === "loading" && node.auditStatus === "loading" ? "Auditing bibliography..." : "Audit Bibliography";
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
refs.auditLevelButton.addEventListener("click", () => auditMissingLevelItems(selectedNode()));
refs.explainButton.addEventListener("click", () => explainNode(selectedNode()));
refs.readingButton.addEventListener("click", () => readingListForNode(selectedNode()));
refs.auditBibliographyButton.addEventListener("click", () => auditBibliography(selectedNode()));
refs.clearLevelButton.addEventListener("click", () => clearNextLevel(selectedNode()));
refs.clearAllButton.addEventListener("click", () => clearAllLevels());
refs.searchAllButton.addEventListener("click", (event) => {
  event.preventDefault();
  openProvider("scholar", selectedNode());
});

render();
loadStaticAtlas();
refreshHealth();
