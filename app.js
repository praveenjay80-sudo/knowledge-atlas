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

const BIBLIOGRAPHY_CATEGORY_LABELS = {
  seminal_works: "Seminal Works",
  breakthrough_works: "Breakthrough Works",
  pedagogy_texts: "Pedagogy and Teaching Texts",
  reference_works: "Reference and Survey Works",
  recent_syntheses: "Recent Syntheses",
};

const CONCEPT_STAGE_LABELS = {
  beginner: "Beginner Concepts",
  intermediate: "Intermediate Concepts",
  advanced: "Advanced Concepts",
};

const refs = {
  apiStatus: document.querySelector("#apiStatus"),
  loadedCount: document.querySelector("#loadedCount"),
  visibleCount: document.querySelector("#visibleCount"),
  searchInput: document.querySelector("#searchInput"),
  searchMeta: document.querySelector("#searchMeta"),
  searchResults: document.querySelector("#searchResults"),
  breadthSelect: document.querySelector("#breadthSelect"),
  focusInput: document.querySelector("#focusInput"),
  growRootsButton: document.querySelector("#growRootsButton"),
  resetButton: document.querySelector("#resetButton"),
  domainCards: document.querySelector("#domainCards"),
  emptyState: document.querySelector("#emptyState"),
  topicWorkspace: document.querySelector("#topicWorkspace"),
  topicPath: document.querySelector("#topicPath"),
  topicTitle: document.querySelector("#topicTitle"),
  topicSummary: document.querySelector("#topicSummary"),
  topicBadges: document.querySelector("#topicBadges"),
  topicWhy: document.querySelector("#topicWhy"),
  topicStatus: document.querySelector("#topicStatus"),
  topicRemaining: document.querySelector("#topicRemaining"),
  topicCaution: document.querySelector("#topicCaution"),
  generateChildrenButton: document.querySelector("#generateChildrenButton"),
  findMoreButton: document.querySelector("#findMoreButton"),
  loadConceptsButton: document.querySelector("#loadConceptsButton"),
  loadBibliographyButton: document.querySelector("#loadBibliographyButton"),
  relatedIntro: document.querySelector("#relatedIntro"),
  relatedFields: document.querySelector("#relatedFields"),
  conceptsStatus: document.querySelector("#conceptsStatus"),
  conceptsCaution: document.querySelector("#conceptsCaution"),
  prerequisitesList: document.querySelector("#prerequisitesList"),
  conceptStages: document.querySelector("#conceptStages"),
  milestonesList: document.querySelector("#milestonesList"),
  bibliographyStatus: document.querySelector("#bibliographyStatus"),
  bibliographyCaution: document.querySelector("#bibliographyCaution"),
  bibliographyGroups: document.querySelector("#bibliographyGroups"),
  domainCardTemplate: document.querySelector("#domainCardTemplate"),
  searchResultTemplate: document.querySelector("#searchResultTemplate"),
  fieldCardTemplate: document.querySelector("#fieldCardTemplate"),
};

const state = {
  breadth: "maximal",
  focus: "",
  search: "",
  loadingRoots: false,
  selectedNodeId: null,
  healthMessage: "Checking API status...",
  healthOk: false,
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
    childScopeLabel = "related fields",
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
    childrenStatus: "idle",
    childrenMessage: "",
    remainingMessage: "",
    conceptStatus: "idle",
    conceptMap: null,
    conceptError: "",
    bibliographyStatus: "idle",
    bibliography: null,
    bibliographyNote: "",
    bibliographyCaution: "",
    bibliographyError: "",
  };
}

function createInitialRoots() {
  return ROOT_DEFINITIONS.map((item) =>
    createNode(
      {
        ...item,
        childScopeLabel: "major branches",
        taxonomyRole: "field",
      },
      [item.name],
    ),
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function clearChildren(element) {
  element.replaceChildren();
}

function createBadge(label, tone = "") {
  const item = document.createElement("span");
  item.className = `badge${tone ? ` ${tone}` : ""}`;
  item.textContent = label;
  return item;
}

function flattenNodes(nodes = state.roots) {
  const output = [];
  for (const node of nodes) {
    output.push(node);
    output.push(...flattenNodes(node.children));
  }
  return output;
}

function countLoadedNodes() {
  return flattenNodes().length;
}

function findNodeById(id, nodes = state.roots) {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const child = findNodeById(id, node.children);
    if (child) {
      return child;
    }
  }
  return null;
}

function selectedNode() {
  return state.selectedNodeId ? findNodeById(state.selectedNodeId) : null;
}

function mergeChildren(node, incomingItems) {
  const existingByName = new Map(node.children.map((child) => [normalizeName(child.name), child]));

  for (const item of incomingItems || []) {
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

    node.children.push(
      createNode(
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
      ),
    );
  }

  node.children.sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    data = rawText ? JSON.parse(rawText) : {};
  } else if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 180);
      throw new Error(
        preview
          ? `Server returned non-JSON output: ${preview}`
          : "Server returned an empty non-JSON response.",
      );
    }
  }

  if (!response.ok) {
    throw new Error(data.error || data.detail || "Request failed.");
  }
  return data;
}

async function refreshHealth() {
  try {
    const payload = await fetchJson("/api/health");
    state.healthOk = Boolean(payload.ok && payload.apiKeyConfigured);
    state.healthMessage = state.healthOk
      ? `API ready. Model: ${payload.model}.`
      : "API reachable, but OPENAI_API_KEY is not configured yet.";
  } catch {
    state.healthOk = false;
    state.healthMessage = "API routes are not reachable right now.";
  }
  render();
}

function selectNode(node) {
  state.selectedNodeId = node.id;
  render();
}

async function loadChildren(node, mode = "initial") {
  node.childrenStatus = "loading";
  node.childrenMessage = mode === "find_more"
    ? "Looking for missing sibling fields..."
    : "Generating direct related fields...";
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
    node.childrenMessage = `${payload.overview || `Loaded ${node.children.length} direct fields.`}${duplicateNote}`;
    node.remainingMessage = payload.remaining_note || "";
    if (!state.selectedNodeId) {
      state.selectedNodeId = node.id;
    }
  } catch (error) {
    node.childrenStatus = "error";
    node.childrenMessage = error.message || "Unable to generate direct fields.";
  }

  render();
}

async function loadBibliography(node) {
  node.bibliographyStatus = "loading";
  node.bibliographyError = "";
  node.bibliographyNote = "Generating bibliography...";
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
    node.bibliography = payload.categories || {};
    node.bibliographyNote = payload.note || "";
    node.bibliographyCaution = payload.caution_note || "";
    node.bibliographyStatus = "success";
  } catch (error) {
    node.bibliographyStatus = "error";
    node.bibliographyError = error.message || "Unable to generate bibliography.";
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
    node.conceptError = error.message || "Unable to generate core concepts.";
  }
  render();
}

async function growRootDomains() {
  state.loadingRoots = true;
  render();
  for (const node of state.roots) {
    await loadChildren(node, "initial");
  }
  if (!state.selectedNodeId && state.roots[0]) {
    state.selectedNodeId = state.roots[0].id;
  }
  state.loadingRoots = false;
  render();
}

function scoreNodeForSearch(node, query) {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) {
    return 0;
  }

  const text = [
    node.name,
    node.summary,
    node.path.join(" "),
    node.keywords.join(" "),
    node.aliases.join(" "),
  ].join(" ").toLowerCase();

  if (!text.includes(normalizedQuery)) {
    return -1;
  }

  let score = 0;
  if (normalizeName(node.name).includes(normalizedQuery)) {
    score += 6;
  }
  if (normalizeName(node.path.join(" ")).includes(normalizedQuery)) {
    score += 3;
  }
  score += Math.max(0, 4 - node.path.length);
  score += node.children.length ? 1 : 0;
  return score;
}

function getSearchResults() {
  if (!state.search.trim()) {
    return [];
  }

  return flattenNodes()
    .map((node) => ({ node, score: scoreNodeForSearch(node, state.search) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.node.name.localeCompare(right.node.name))
    .slice(0, 12)
    .map((item) => item.node);
}

function renderDomainCards() {
  clearChildren(refs.domainCards);

  for (const node of state.roots) {
    const fragment = refs.domainCardTemplate.content.cloneNode(true);
    fragment.querySelector(".domain-label").textContent = node.children.length
      ? `${node.children.length} loaded branches`
      : "Root domain";
    fragment.querySelector(".domain-name").textContent = node.name;
    fragment.querySelector(".domain-summary").textContent = node.summary;

    fragment.querySelector(".open-domain-button").addEventListener("click", () => {
      selectNode(node);
    });
    fragment.querySelector(".grow-domain-button").addEventListener("click", () => {
      loadChildren(node, "initial");
    });

    refs.domainCards.appendChild(fragment);
  }
}

function renderSearch() {
  clearChildren(refs.searchResults);
  const results = getSearchResults();
  refs.visibleCount.textContent = String(results.length);

  if (!state.search.trim()) {
    refs.searchMeta.textContent = "Search works across topics that have already been opened or generated.";
    return;
  }

  refs.searchMeta.textContent = results.length
    ? `${results.length} loaded topics match "${state.search}".`
    : `No loaded topics match "${state.search}" yet. Grow a domain to surface more topics.`;

  for (const node of results) {
    const fragment = refs.searchResultTemplate.content.cloneNode(true);
    fragment.querySelector(".search-result-path").textContent = node.path.join(" > ");
    fragment.querySelector(".search-result-name").textContent = node.name;
    fragment.querySelector(".search-result-summary").textContent = node.summary;
    fragment.querySelector(".search-result").addEventListener("click", () => {
      selectNode(node);
    });
    refs.searchResults.appendChild(fragment);
  }
}

function renderTopicHeader(node) {
  refs.topicPath.textContent = node.path.join(" > ");
  refs.topicTitle.textContent = node.name;
  refs.topicSummary.textContent = node.summary;
  refs.topicWhy.textContent = node.whyItBelongs ? `Why this field belongs here: ${node.whyItBelongs}` : "";
  refs.topicStatus.textContent = node.childrenMessage || "";
  refs.topicRemaining.textContent = node.remainingMessage ? `Coverage note: ${node.remainingMessage}` : "";
  refs.topicCaution.textContent = node.cautionNote ? `Caution: ${node.cautionNote}` : "";
  refs.topicWhy.hidden = !node.whyItBelongs;
  refs.topicStatus.hidden = !node.childrenMessage;
  refs.topicRemaining.hidden = !node.remainingMessage;
  refs.topicCaution.hidden = !node.cautionNote;

  clearChildren(refs.topicBadges);
  refs.topicBadges.append(
    createBadge(node.taxonomyRole || "field", "cool"),
    createBadge(`${node.confidence || "unknown"} confidence`),
    createBadge(`depth ${node.path.length}`),
  );
  if (node.keywords.length) {
    refs.topicBadges.appendChild(createBadge(`${node.keywords.length} keywords`, "soft"));
  }

  refs.generateChildrenButton.textContent = node.children.length
    ? `Refresh ${node.childScopeLabel || "direct fields"}`
    : `Generate ${node.childScopeLabel || "direct fields"}`;
  refs.generateChildrenButton.disabled = node.childrenStatus === "loading" || !node.likelyHasChildren;
  refs.findMoreButton.disabled = node.childrenStatus === "loading" || !node.likelyHasChildren;
  refs.loadConceptsButton.disabled = node.conceptStatus === "loading";
  refs.loadBibliographyButton.disabled = node.bibliographyStatus === "loading";
}

function renderRelatedFields(node) {
  clearChildren(refs.relatedFields);
  refs.relatedIntro.textContent = node.children.length
    ? `Direct ${node.childScopeLabel || "fields"} currently loaded for this topic.`
    : "No direct fields have been loaded yet. Generate them to explore the structure around this topic.";

  if (!node.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-slot";
    empty.textContent = "No related fields loaded yet.";
    refs.relatedFields.appendChild(empty);
    return;
  }

  for (const child of node.children) {
    const fragment = refs.fieldCardTemplate.content.cloneNode(true);
    fragment.querySelector(".field-path").textContent = child.path.join(" > ");
    fragment.querySelector(".field-name").textContent = child.name;
    fragment.querySelector(".field-summary").textContent = child.summary;

    const badgeRow = fragment.querySelector(".field-badges");
    badgeRow.append(
      createBadge(child.taxonomyRole || "field", "soft"),
      createBadge(`${child.confidence || "unknown"} confidence`, "soft"),
    );

    fragment.querySelector(".open-field-button").addEventListener("click", () => {
      selectNode(child);
    });
    fragment.querySelector(".grow-field-button").addEventListener("click", () => {
      loadChildren(child, "initial");
    });

    refs.relatedFields.appendChild(fragment);
  }
}

function renderConcepts(node) {
  clearChildren(refs.prerequisitesList);
  clearChildren(refs.conceptStages);
  clearChildren(refs.milestonesList);

  if (node.conceptStatus === "idle" && !node.conceptMap) {
    refs.conceptsStatus.textContent = "Load core concepts to see prerequisites, staged ideas, and milestone capabilities.";
    refs.conceptsCaution.hidden = true;
    return;
  }

  if (node.conceptStatus === "loading") {
    refs.conceptsStatus.textContent = "Generating core concepts and staged learning map...";
    refs.conceptsCaution.hidden = true;
    return;
  }

  if (node.conceptStatus === "error") {
    refs.conceptsStatus.textContent = node.conceptError || "Unable to generate core concepts.";
    refs.conceptsCaution.hidden = true;
    return;
  }

  refs.conceptsStatus.textContent = node.conceptMap?.note || "Core concepts loaded.";
  refs.conceptsCaution.textContent = node.conceptMap?.caution_note || "";
  refs.conceptsCaution.hidden = !node.conceptMap?.caution_note;

  for (const item of node.conceptMap?.prerequisites || []) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    refs.prerequisitesList.appendChild(listItem);
  }

  for (const [key, label] of Object.entries(CONCEPT_STAGE_LABELS)) {
    const entries = node.conceptMap?.learning_stages?.[key] || [];
    if (!entries.length) {
      continue;
    }

    const section = document.createElement("section");
    section.className = "stage-card";
    const title = document.createElement("h3");
    title.textContent = label;
    section.appendChild(title);

    const list = document.createElement("ul");
    list.className = "plain-list";
    for (const entry of entries) {
      const item = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = entry.name;
      const text = document.createElement("p");
      text.textContent = entry.summary;
      item.append(strong, text);
      list.appendChild(item);
    }
    section.appendChild(list);
    refs.conceptStages.appendChild(section);
  }

  for (const item of node.conceptMap?.milestone_capabilities || []) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    refs.milestonesList.appendChild(listItem);
  }
}

function createReferenceItem(entry) {
  const item = document.createElement("li");
  const title = document.createElement("strong");
  title.textContent = `${entry.title} (${entry.year})`;
  const meta = document.createElement("p");
  meta.textContent = `${entry.authors} ${entry.source ? `| ${entry.source}` : ""}`;
  const why = document.createElement("p");
  why.textContent = `${entry.why_it_matters} Confidence: ${entry.confidence}.`;
  item.append(title, meta, why);
  return item;
}

function renderBibliography(node) {
  clearChildren(refs.bibliographyGroups);

  if (node.bibliographyStatus === "idle" && !node.bibliography) {
    refs.bibliographyStatus.textContent = "Load bibliography to group works by role in understanding the field.";
    refs.bibliographyCaution.hidden = true;
    return;
  }

  if (node.bibliographyStatus === "loading") {
    refs.bibliographyStatus.textContent = "Generating categorized bibliography...";
    refs.bibliographyCaution.hidden = true;
    return;
  }

  if (node.bibliographyStatus === "error") {
    refs.bibliographyStatus.textContent = node.bibliographyError || "Unable to generate bibliography.";
    refs.bibliographyCaution.hidden = true;
    return;
  }

  refs.bibliographyStatus.textContent = node.bibliographyNote || "Bibliography loaded.";
  refs.bibliographyCaution.textContent = node.bibliographyCaution || "";
  refs.bibliographyCaution.hidden = !node.bibliographyCaution;

  for (const [key, label] of Object.entries(BIBLIOGRAPHY_CATEGORY_LABELS)) {
    const entries = node.bibliography?.[key] || [];
    if (!entries.length) {
      continue;
    }

    const section = document.createElement("section");
    section.className = "bibliography-card";
    const title = document.createElement("h3");
    title.textContent = label;
    const list = document.createElement("ol");
    list.className = "plain-list";
    for (const entry of entries) {
      list.appendChild(createReferenceItem(entry));
    }
    section.append(title, list);
    refs.bibliographyGroups.appendChild(section);
  }

  if (!refs.bibliographyGroups.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-slot";
    empty.textContent = "No bibliography entries were returned for this topic yet.";
    refs.bibliographyGroups.appendChild(empty);
  }
}

function renderWorkspace() {
  const node = selectedNode();
  refs.emptyState.hidden = Boolean(node);
  refs.topicWorkspace.hidden = !node;
  if (!node) {
    return;
  }

  renderTopicHeader(node);
  renderRelatedFields(node);
  renderConcepts(node);
  renderBibliography(node);
}

function render() {
  refs.apiStatus.textContent = state.healthMessage;
  refs.apiStatus.classList.toggle("status-ok", state.healthOk);
  refs.apiStatus.classList.toggle("status-error", !state.healthOk);
  refs.loadedCount.textContent = String(countLoadedNodes());
  refs.growRootsButton.disabled = state.loadingRoots;

  renderDomainCards();
  renderSearch();
  renderWorkspace();
}

refs.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

refs.breadthSelect.addEventListener("change", (event) => {
  state.breadth = event.target.value;
});

refs.focusInput.addEventListener("input", (event) => {
  state.focus = event.target.value.trim();
});

refs.growRootsButton.addEventListener("click", () => {
  growRootDomains();
});

refs.resetButton.addEventListener("click", () => {
  state.search = "";
  state.focus = "";
  state.selectedNodeId = null;
  state.loadingRoots = false;
  state.roots = createInitialRoots();
  refs.searchInput.value = "";
  refs.focusInput.value = "";
  render();
});

refs.generateChildrenButton.addEventListener("click", () => {
  const node = selectedNode();
  if (node) {
    loadChildren(node, "initial");
  }
});

refs.findMoreButton.addEventListener("click", () => {
  const node = selectedNode();
  if (node) {
    loadChildren(node, "find_more");
  }
});

refs.loadConceptsButton.addEventListener("click", () => {
  const node = selectedNode();
  if (node) {
    loadConcepts(node);
  }
});

refs.loadBibliographyButton.addEventListener("click", () => {
  const node = selectedNode();
  if (node) {
    loadBibliography(node);
  }
});

render();
refreshHealth();
