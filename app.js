const ROOT_DEFINITIONS = [
  {
    name: "Formal sciences",
    summary:
      "Disciplines centered on abstract structures, symbolic systems, computation, inference, and mathematical modeling.",
  },
  {
    name: "Natural sciences",
    summary:
      "Disciplines focused on the physical universe, life, matter, energy, Earth systems, and observable natural phenomena.",
  },
  {
    name: "Social sciences",
    summary:
      "Disciplines focused on human behavior, institutions, culture, markets, governance, and social systems.",
  },
  {
    name: "Philosophy",
    summary:
      "Disciplines focused on metaphysics, epistemology, logic, ethics, aesthetics, and the critical analysis of knowledge and reality.",
  },
];

const nodeTemplate = document.querySelector("#nodeTemplate");
const taxonomyTree = document.querySelector("#taxonomyTree");
const apiStatus = document.querySelector("#apiStatus");
const breadthSelect = document.querySelector("#breadthSelect");
const searchInput = document.querySelector("#searchInput");
const focusInput = document.querySelector("#focusInput");
const loadRootsButton = document.querySelector("#loadRootsButton");
const collapseButton = document.querySelector("#collapseButton");
const resetButton = document.querySelector("#resetButton");
const loadedCount = document.querySelector("#loadedCount");
const visibleCount = document.querySelector("#visibleCount");

const BIBLIOGRAPHY_CATEGORY_LABELS = {
  seminal_works: "Seminal Works",
  breakthrough_works: "Breakthrough Works",
  pedagogy_texts: "Pedagogy and Teaching Texts",
  reference_works: "Reference and Survey Works",
  recent_syntheses: "Recent Syntheses",
};

const CONCEPT_BIBLIOGRAPHY_LABELS = {
  pedagogy_texts: "Pedagogy Texts",
  seminal_works: "Seminal Works",
  breakthrough_works: "Breakthrough Works",
  advanced_syntheses: "Advanced Syntheses",
};

const state = {
  breadth: "maximal",
  search: "",
  focus: "",
  loadingRoots: false,
  health: {
    ok: false,
    model: null,
    message: "Checking API status...",
  },
  roots: createInitialRoots(),
};

function createNode(
  {
    name,
    summary,
    whyItBelongs = "",
    keywords = [],
    aliases = [],
    likelyHasChildren = true,
    childScopeLabel = "subfields",
    taxonomyRole = "field",
    confidence = "high",
    cautionNote = "",
  },
  path,
) {
  return {
    id: path.join(" > "),
    path,
    name,
    summary,
    whyItBelongs,
    keywords,
    aliases,
    likelyHasChildren,
    childScopeLabel,
    taxonomyRole,
    confidence,
    cautionNote,
    children: [],
    expanded: false,
    childrenStatus: "idle",
    childrenMessage: "",
    remainingMessage: "",
    bibliographyStatus: "idle",
    bibliographyError: "",
    bibliographyNote: "",
    bibliographyCaution: "",
    bibliography: null,
    conceptStatus: "idle",
    conceptError: "",
    conceptMap: null,
  };
}

function createInitialRoots() {
  return ROOT_DEFINITIONS.map((item) =>
    createNode(
      {
        ...item,
        childScopeLabel: "branches",
        taxonomyRole: "field",
        confidence: "high",
      },
      [item.name],
    ),
  );
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function titleCaseLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function countLoadedNodes(nodes) {
  let total = 0;
  for (const node of nodes) {
    total += 1;
    total += countLoadedNodes(node.children);
  }
  return total;
}

function nodeMatchesSearch(node, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    node.name,
    node.summary,
    node.whyItBelongs,
    node.path.join(" "),
    node.keywords.join(" "),
    node.aliases.join(" "),
    node.taxonomyRole,
    node.cautionNote,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function mergeChildren(node, incomingItems) {
  const existingByName = new Map(node.children.map((child) => [normalizeName(child.name), child]));

  for (const item of incomingItems) {
    const key = normalizeName(item.name);
    if (!key) {
      continue;
    }

    if (existingByName.has(key)) {
      const existing = existingByName.get(key);
      existing.summary = item.summary || existing.summary;
      existing.whyItBelongs = item.why_it_belongs || existing.whyItBelongs;
      existing.keywords = item.keywords || existing.keywords;
      existing.aliases = item.aliases || existing.aliases;
      existing.likelyHasChildren = item.likely_has_children ?? existing.likelyHasChildren;
      existing.childScopeLabel = item.child_scope_label || existing.childScopeLabel;
      existing.taxonomyRole = item.taxonomy_role || existing.taxonomyRole;
      existing.confidence = item.confidence || existing.confidence;
      existing.cautionNote = item.caution_note || existing.cautionNote;
      continue;
    }

    const child = createNode(
      {
        name: item.name,
        summary: item.summary,
        whyItBelongs: item.why_it_belongs,
        keywords: item.keywords,
        aliases: item.aliases,
        likelyHasChildren: item.likely_has_children,
        childScopeLabel: item.child_scope_label,
        taxonomyRole: item.taxonomy_role,
        confidence: item.confidence,
        cautionNote: item.caution_note,
      },
      [...node.path, item.name],
    );

    node.children.push(child);
    existingByName.set(key, child);
  }

  node.children.sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function refreshHealth() {
  try {
    const data = await fetchJson("/api/health");
    state.health.ok = Boolean(data.ok && data.apiKeyConfigured);
    state.health.model = data.model || null;
    state.health.message = state.health.ok
      ? `API is ready. Model: ${data.model}.`
      : "API is reachable, but OPENAI_API_KEY is not configured yet.";
  } catch {
    state.health.ok = false;
    state.health.model = null;
    state.health.message = "API routes are not reachable right now.";
  }

  render();
}

async function loadChildren(node, mode = "initial") {
  node.childrenStatus = "loading";
  node.childrenMessage = mode === "find_more"
    ? "Looking for additional non-duplicate sibling branches..."
    : "Generating direct child categories...";
  render();

  try {
    const payload = await fetchJson("/api/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        existingChildren: node.children.flatMap((child) => [child.name, ...(child.aliases || [])]),
        breadth: state.breadth,
        customFocus: state.focus,
        mode,
      }),
    });

    mergeChildren(node, payload.items || []);
    const duplicateNote = Array.isArray(payload.dropped_duplicates) && payload.dropped_duplicates.length
      ? ` Filtered near-duplicates: ${payload.dropped_duplicates.join(", ")}.`
      : "";
    node.childrenStatus = "success";
    node.childrenMessage = `${payload.overview || `Loaded ${node.children.length} child items.`}${duplicateNote}`;
    node.remainingMessage = payload.remaining_note || "";
    node.expanded = true;
  } catch (error) {
    node.childrenStatus = "error";
    node.childrenMessage = error.message || "Unable to generate child taxonomy.";
  }

  render();
}

async function loadBibliography(node) {
  node.bibliographyStatus = "loading";
  node.bibliographyError = "";
  node.bibliographyNote = "Generating categorized research bibliography...";
  render();

  try {
    const payload = await fetchJson("/api/bibliography", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        summary: node.summary,
        keywords: node.keywords,
      }),
    });

    node.bibliography = payload.categories || null;
    node.bibliographyNote = payload.note || "";
    node.bibliographyCaution = payload.caution_note || "";
    node.bibliographyStatus = "success";
  } catch (error) {
    node.bibliographyStatus = "error";
    node.bibliographyError = error.message || "Unable to generate bibliography.";
    node.bibliographyNote = node.bibliographyError;
    node.bibliographyCaution = "";
  }

  render();
}

async function loadConcepts(node) {
  node.conceptStatus = "loading";
  node.conceptError = "";
  render();

  try {
    const payload = await fetchJson("/api/concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        summary: node.summary,
        keywords: node.keywords,
      }),
    });

    node.conceptMap = payload;
    node.conceptStatus = "success";
  } catch (error) {
    node.conceptStatus = "error";
    node.conceptError = error.message || "Unable to generate concept tree.";
  }

  render();
}

async function loadMajorBranches() {
  state.loadingRoots = true;
  render();

  for (const root of state.roots) {
    await loadChildren(root, "initial");
  }

  state.loadingRoots = false;
  render();
}

function collapseAll(nodes = state.roots) {
  for (const node of nodes) {
    node.expanded = false;
    collapseAll(node.children);
  }
}

function renderBadges(node, container) {
  const badges = [
    { label: `${node.path.length === 1 ? "root" : "depth"} ${node.path.length}`, className: "depth-badge" },
    { label: node.taxonomyRole || "field", className: "" },
    { label: node.confidence ? `${node.confidence} confidence` : "confidence unknown", className: "" },
  ];

  if (node.keywords.length) {
    badges.push({ label: `${node.keywords.length} keywords`, className: "" });
  }

  for (const badge of badges) {
    const element = document.createElement("span");
    element.className = `badge ${badge.className}`.trim();
    element.textContent = badge.label;
    container.appendChild(element);
  }
}

function createReferenceListItem(entry) {
  const item = document.createElement("li");

  const citation = document.createElement("p");
  const title = document.createElement("strong");
  title.textContent = `${entry.title} (${entry.year})`;
  citation.appendChild(title);
  citation.appendChild(document.createElement("br"));
  citation.appendChild(document.createTextNode(entry.authors));
  citation.appendChild(document.createElement("br"));
  citation.appendChild(document.createTextNode(entry.source));

  const why = document.createElement("p");
  why.textContent = `${entry.why_it_matters} Confidence: ${entry.confidence}.`;

  item.append(citation, why);
  return item;
}

function renderBibliography(node, fragment) {
  const panel = fragment.querySelector(".bibliography-panel");
  const note = fragment.querySelector(".bibliography-note");
  const groups = fragment.querySelector(".bibliography-groups");

  if (node.bibliographyStatus === "idle" && !node.bibliography) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  note.textContent = node.bibliographyNote || "";
  groups.replaceChildren();

  if (node.bibliographyStatus === "loading") {
    const status = document.createElement("p");
    status.textContent = "Generating categorized bibliography...";
    groups.appendChild(status);
    return;
  }

  if (node.bibliographyStatus === "error") {
    const status = document.createElement("p");
    status.textContent = node.bibliographyError || "Bibliography request failed.";
    groups.appendChild(status);
    return;
  }

  if (node.bibliographyCaution) {
    const caution = document.createElement("p");
    caution.className = "concepts-caution";
    caution.textContent = node.bibliographyCaution;
    groups.appendChild(caution);
  }

  for (const [key, label] of Object.entries(BIBLIOGRAPHY_CATEGORY_LABELS)) {
    const entries = node.bibliography?.[key] || [];
    if (!entries.length) {
      continue;
    }

    const group = document.createElement("section");
    group.className = "bibliography-group";

    const heading = document.createElement("h4");
    heading.textContent = label;

    const list = document.createElement("ol");
    for (const entry of entries) {
      list.appendChild(createReferenceListItem(entry));
    }

    group.append(heading, list);
    groups.appendChild(group);
  }

  if (!groups.children.length) {
    const empty = document.createElement("p");
    empty.textContent = "No safe references were returned for this topic yet.";
    groups.appendChild(empty);
  }
}

function renderConcepts(node, fragment) {
  const panel = fragment.querySelector(".concepts-panel");
  const note = fragment.querySelector(".concepts-note");
  const caution = fragment.querySelector(".concepts-caution");
  const prerequisitesList = fragment.querySelector(".prerequisites-list");
  const milestonesList = fragment.querySelector(".milestones-list");
  const stageContainer = fragment.querySelector(".concept-stages");
  const bibliographyGroups = fragment.querySelector(".concept-bibliography-groups");

  if (node.conceptStatus === "idle" && !node.conceptMap) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  prerequisitesList.replaceChildren();
  milestonesList.replaceChildren();
  stageContainer.replaceChildren();
  bibliographyGroups.replaceChildren();

  if (node.conceptStatus === "loading") {
    note.textContent = "Generating beginner-to-advanced concept tree...";
    caution.textContent = "";
    caution.hidden = true;
    return;
  }

  if (node.conceptStatus === "error") {
    note.textContent = node.conceptError || "Learning map request failed.";
    caution.textContent = "";
    caution.hidden = true;
    return;
  }

  note.textContent = node.conceptMap?.note || "";
  caution.textContent = node.conceptMap?.caution_note || "";
  caution.hidden = !node.conceptMap?.caution_note;

  for (const item of node.conceptMap?.prerequisites || []) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    prerequisitesList.appendChild(listItem);
  }

  for (const [stageKey, stageItems] of Object.entries(node.conceptMap?.learning_stages || {})) {
    const stage = document.createElement("section");
    stage.className = "concept-stage";

    const heading = document.createElement("h4");
    heading.textContent = titleCaseLabel(stageKey);

    const list = document.createElement("ul");
    for (const entry of stageItems) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = entry.name;

      const description = document.createElement("p");
      description.textContent = entry.summary;

      item.append(title, description);
      list.appendChild(item);
    }

    stage.append(heading, list);
    stageContainer.appendChild(stage);
  }

  for (const capability of node.conceptMap?.milestone_capabilities || []) {
    const listItem = document.createElement("li");
    listItem.textContent = capability;
    milestonesList.appendChild(listItem);
  }

  for (const [key, label] of Object.entries(CONCEPT_BIBLIOGRAPHY_LABELS)) {
    const entries = node.conceptMap?.bibliography_by_level?.[key] || [];
    if (!entries.length) {
      continue;
    }

    const group = document.createElement("section");
    group.className = "concept-bibliography-group";

    const heading = document.createElement("h4");
    heading.textContent = label;

    const list = document.createElement("ol");
    for (const entry of entries) {
      list.appendChild(createReferenceListItem(entry));
    }

    group.append(heading, list);
    bibliographyGroups.appendChild(group);
  }
}

function renderNode(node, query) {
  const childResults = node.children
    .map((child) => renderNode(child, query))
    .filter(Boolean);

  const selfMatches = nodeMatchesSearch(node, query);
  const descendantMatches = childResults.length > 0;

  if (query && !selfMatches && !descendantMatches) {
    return null;
  }

  const fragment = nodeTemplate.content.cloneNode(true);
  const toggleButton = fragment.querySelector(".toggle-button");
  const generateChildrenButton = fragment.querySelector(".generate-children-button");
  const findMoreButton = fragment.querySelector(".find-more-button");
  const bibliographyButton = fragment.querySelector(".bibliography-button");
  const conceptsButton = fragment.querySelector(".concepts-button");
  const pathElement = fragment.querySelector(".node-path");
  const nameElement = fragment.querySelector(".node-name");
  const summaryElement = fragment.querySelector(".node-summary");
  const whyElement = fragment.querySelector(".node-why");
  const statusElement = fragment.querySelector(".node-status");
  const remainingElement = fragment.querySelector(".node-remaining");
  const cautionElement = fragment.querySelector(".node-caution");
  const badgesElement = fragment.querySelector(".node-badges");
  const childrenShell = fragment.querySelector(".children-shell");
  const childrenLabel = fragment.querySelector(".children-label");
  const childrenList = fragment.querySelector(".children-list");

  pathElement.textContent = node.path.join(" > ");
  nameElement.textContent = node.name;
  summaryElement.textContent = node.summary;
  whyElement.textContent = node.whyItBelongs ? `Why it belongs here: ${node.whyItBelongs}` : "";
  statusElement.textContent = node.childrenMessage || "";
  remainingElement.textContent = node.remainingMessage ? `Coverage note: ${node.remainingMessage}` : "";
  cautionElement.textContent = node.cautionNote ? `Caution: ${node.cautionNote}` : "";
  whyElement.hidden = !node.whyItBelongs;
  statusElement.hidden = !node.childrenMessage;
  remainingElement.hidden = !node.remainingMessage;
  cautionElement.hidden = !node.cautionNote;

  if (node.childrenStatus === "error") {
    statusElement.classList.add("status-error");
  } else if (node.childrenStatus === "success") {
    statusElement.classList.add("status-success");
  }

  renderBadges(node, badgesElement);

  const canToggle = node.children.length > 0;
  toggleButton.disabled = !canToggle;
  toggleButton.textContent = node.expanded || (query && descendantMatches) ? "-" : "+";
  toggleButton.addEventListener("click", () => {
    if (!canToggle) {
      return;
    }
    node.expanded = !node.expanded;
    render();
  });

  generateChildrenButton.textContent = node.children.length
    ? `Refresh ${node.childScopeLabel || "children"}`
    : `Generate ${node.childScopeLabel || "children"}`;
  generateChildrenButton.disabled = node.childrenStatus === "loading" || !node.likelyHasChildren;
  generateChildrenButton.addEventListener("click", () => {
    loadChildren(node, "initial");
  });

  findMoreButton.disabled = node.childrenStatus === "loading" || !node.likelyHasChildren;
  findMoreButton.addEventListener("click", () => {
    loadChildren(node, "find_more");
  });

  bibliographyButton.disabled = node.bibliographyStatus === "loading";
  bibliographyButton.addEventListener("click", () => {
    loadBibliography(node);
  });

  conceptsButton.disabled = node.conceptStatus === "loading";
  conceptsButton.addEventListener("click", () => {
    loadConcepts(node);
  });

  renderBibliography(node, fragment);
  renderConcepts(node, fragment);

  const showChildren = childResults.length > 0 && (node.expanded || Boolean(query));
  childrenShell.hidden = !showChildren;
  childrenLabel.textContent = node.childScopeLabel || "children";

  for (const child of childResults) {
    childrenList.appendChild(child.element);
  }

  return {
    element: fragment,
    visibleCount: 1 + childResults.reduce((sum, child) => sum + child.visibleCount, 0),
  };
}

function render() {
  const query = state.search.trim().toLowerCase();
  taxonomyTree.replaceChildren();

  const results = state.roots.map((node) => renderNode(node, query)).filter(Boolean);
  const visible = results.reduce((sum, result) => sum + result.visibleCount, 0);

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = query
      ? "No loaded taxonomy nodes match this search yet. Clear the search or expand more branches."
      : "No taxonomy loaded yet. Generate major branches or expand any root domain.";
    taxonomyTree.appendChild(empty);
  } else {
    for (const result of results) {
      taxonomyTree.appendChild(result.element);
    }
  }

  apiStatus.textContent = state.health.message;
  apiStatus.classList.toggle("status-success", state.health.ok);
  apiStatus.classList.toggle("status-error", !state.health.ok);

  loadRootsButton.disabled = state.loadingRoots;
  loadedCount.textContent = String(countLoadedNodes(state.roots));
  visibleCount.textContent = String(visible);
}

breadthSelect.addEventListener("change", (event) => {
  state.breadth = event.target.value;
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

focusInput.addEventListener("input", (event) => {
  state.focus = event.target.value.trim();
});

loadRootsButton.addEventListener("click", () => {
  loadMajorBranches();
});

collapseButton.addEventListener("click", () => {
  collapseAll();
  render();
});

resetButton.addEventListener("click", () => {
  state.roots = createInitialRoots();
  state.search = "";
  state.focus = "";
  searchInput.value = "";
  focusInput.value = "";
  render();
});

render();
refreshHealth();
