const STORAGE_KEY = "complete-human-knowledge-taxonomy-source";
const BIBLIOGRAPHY_KEY = "complete-human-knowledge-taxonomy-bibliography";
const SOURCE_URL = "/data/user_taxonomy_source.txt";

const refs = {
  stats: document.querySelector("#stats"),
  searchInput: document.querySelector("#searchInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  showImportButton: document.querySelector("#showImportButton"),
  clearImportButton: document.querySelector("#clearImportButton"),
  importPanel: document.querySelector("#importPanel"),
  sourceInput: document.querySelector("#sourceInput"),
  parseSourceButton: document.querySelector("#parseSourceButton"),
  hideImportButton: document.querySelector("#hideImportButton"),
  importStatus: document.querySelector("#importStatus"),
  tree: document.querySelector("#tree"),
  emptyState: document.querySelector("#emptyState"),
  detail: document.querySelector("#detail"),
  detailLevel: document.querySelector("#detailLevel"),
  detailTitle: document.querySelector("#detailTitle"),
  detailPath: document.querySelector("#detailPath"),
  detailDescription: document.querySelector("#detailDescription"),
  foundationalSection: document.querySelector("#foundationalSection"),
  foundationalText: document.querySelector("#foundationalText"),
  auditTaxonomyButton: document.querySelector("#auditTaxonomyButton"),
  auditBibliographyButton: document.querySelector("#auditBibliographyButton"),
  auditStatus: document.querySelector("#auditStatus"),
  auditResults: document.querySelector("#auditResults"),
  bibliographySection: document.querySelector("#bibliographySection"),
  bibliographyList: document.querySelector("#bibliographyList"),
  childrenTitle: document.querySelector("#childrenTitle"),
  children: document.querySelector("#children"),
};

const state = {
  roots: [],
  flat: [],
  selectedId: "",
  query: "",
  sourceLabel: "No source loaded",
  bibliographyByPath: {},
  auditItems: [],
  auditMode: "",
  auditLoading: false,
};

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitFoundational(line) {
  const compact = normalize(line);
  const marker = compact.match(/\s*Foundational work:\s*/i);
  if (!marker) return { name: compact, foundational: "" };
  const index = marker.index;
  return {
    name: normalize(compact.slice(0, index)),
    foundational: normalize(compact.slice(index + marker[0].length)),
  };
}

function makeId(path) {
  return path.join(" > ");
}

function createNode(level, name, description = "", foundational = "", parent = null) {
  const path = parent ? [...parent.path, name] : [name];
  return {
    id: makeId(path),
    level,
    name,
    description,
    foundational,
    path,
    bibliography: [],
    children: [],
  };
}

function parseTaxonomy(text) {
  const roots = [];
  let current = { 1: null, 2: null, 3: null };
  let pendingLevelOneDescription = null;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^A COMPLETE TAXONOMY/i.test(line)) continue;

    const levelOne = line.match(/^LEVEL\s+1:\s*(.+)$/i);
    if (levelOne) {
      const node = createNode(1, normalize(levelOne[1]));
      roots.push(node);
      current = { 1: node, 2: null, 3: null };
      pendingLevelOneDescription = node;
      continue;
    }

    const l2 = line.match(/^L2:\s*(.+)$/i);
    if (l2 && current[1]) {
      const node = createNode(2, normalize(l2[1]), "", "", current[1]);
      current[1].children.push(node);
      current[2] = node;
      current[3] = null;
      pendingLevelOneDescription = null;
      continue;
    }

    const l3 = line.match(/^L3:\s*(.+)$/i);
    if (l3 && current[2]) {
      const node = createNode(3, normalize(l3[1]), "", "", current[2]);
      current[2].children.push(node);
      current[3] = node;
      pendingLevelOneDescription = null;
      continue;
    }

    const l4 = line.match(/^L4:\s*(.+)$/i);
    if (l4 && current[3]) {
      const parsed = splitFoundational(l4[1]);
      const node = createNode(4, parsed.name, "", parsed.foundational, current[3]);
      current[3].children.push(node);
      pendingLevelOneDescription = null;
      continue;
    }

    if (pendingLevelOneDescription && !pendingLevelOneDescription.description) {
      pendingLevelOneDescription.description = normalize(line);
    }
  }

  return roots;
}

function flatten(nodes) {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function childCount(node, level) {
  return flatten(node.children).filter((item) => item.level === level).length;
}

function countByLevel(flat) {
  return [1, 2, 3, 4].map((level) => flat.filter((node) => node.level === level).length);
}

function clear(element) {
  element.replaceChildren();
}

function setTaxonomy(text, sourceLabel) {
  state.roots = parseTaxonomy(text);
  state.flat = flatten(state.roots);
  applySavedBibliography();
  state.selectedId = state.roots[0]?.id || "";
  state.sourceLabel = sourceLabel;
  state.auditItems = [];
  state.auditMode = "";
  refs.sourceInput.value = text;
  render();
}

function selectedNode() {
  return state.flat.find((node) => node.id === state.selectedId) || null;
}

function selectNode(node) {
  state.selectedId = node.id;
  state.auditItems = [];
  state.auditMode = "";
  render();
}

function loadBibliographyStore() {
  try {
    state.bibliographyByPath = JSON.parse(localStorage.getItem(BIBLIOGRAPHY_KEY) || "{}");
  } catch {
    state.bibliographyByPath = {};
  }
}

function saveBibliographyStore() {
  localStorage.setItem(BIBLIOGRAPHY_KEY, JSON.stringify(state.bibliographyByPath));
}

function applySavedBibliography() {
  for (const node of flatten(state.roots)) {
    node.bibliography = Array.isArray(state.bibliographyByPath[node.id])
      ? state.bibliographyByPath[node.id]
      : [];
  }
}

function saveNodeBibliography(node) {
  state.bibliographyByPath[node.id] = node.bibliography;
  saveBibliographyStore();
}

function parentNode(node) {
  if (!node || node.path.length <= 1) return null;
  return state.flat.find((candidate) => candidate.id === makeId(node.path.slice(0, -1))) || null;
}

function auditParentFor(node) {
  return node?.level === 4 ? parentNode(node) : node;
}

function normalizeKey(value) {
  return normalize(value).toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function bibliographyKey(item) {
  return [item.title, item.authors, item.year].map(normalizeKey).join("|");
}

function serializeTaxonomy() {
  const lines = ["A COMPLETE TAXONOMY OF HUMAN KNOWLEDGE", ""];
  for (const root of state.roots) {
    lines.push(`LEVEL 1: ${root.name}`, "");
    if (root.description) lines.push(root.description, "");
    for (const l2 of root.children) {
      lines.push(`L2: ${l2.name}`);
      for (const l3 of l2.children) {
        lines.push(`L3: ${l3.name}`);
        for (const l4 of l3.children) {
          lines.push(`L4: ${l4.name}${l4.foundational ? `Foundational work: ${l4.foundational}` : ""}`);
        }
        lines.push("");
      }
      lines.push("");
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function visibleNodes() {
  const query = state.query.toLowerCase();
  if (!query) return state.flat;
  return state.flat.filter((node) =>
    [node.name, node.description, node.foundational, node.path.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function renderStats() {
  clear(refs.stats);
  const [l1, l2, l3, l4] = countByLevel(state.flat);
  const items = [
    `${state.sourceLabel}`,
    `L1 ${l1}`,
    `L2 ${l2}`,
    `L3 ${l3}`,
    `L4 ${l4}`,
    `${state.flat.length.toLocaleString()} total`,
  ];
  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "stat";
    chip.textContent = item;
    refs.stats.appendChild(chip);
  }
}

function renderTree() {
  clear(refs.tree);
  const nodes = visibleNodes();
  if (!nodes.length) {
    const empty = document.createElement("p");
    empty.className = "no-results";
    empty.textContent = "No matching fields found.";
    refs.tree.appendChild(empty);
    return;
  }

  for (const node of nodes.slice(0, 900)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-item level-${node.level}`;
    button.classList.toggle("active", node.id === state.selectedId);
    button.innerHTML = `
      <span class="item-meta">Level ${node.level}</span>
      <span class="item-title"></span>
      ${node.foundational ? '<span class="item-foundation"></span>' : ""}
    `;
    button.querySelector(".item-title").textContent = node.name;
    const foundation = button.querySelector(".item-foundation");
    if (foundation) foundation.textContent = node.foundational;
    button.addEventListener("click", () => selectNode(node));
    refs.tree.appendChild(button);
  }
}

function renderChildren(node) {
  clear(refs.children);
  refs.childrenTitle.textContent = node.children.length ? `Children (${node.children.length})` : "Children";
  if (!node.children.length) {
    const empty = document.createElement("p");
    empty.className = "no-results";
    empty.textContent = node.level === 4 ? "This is a Level 4 field in the supplied taxonomy." : "No children are loaded under this item.";
    refs.children.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "children-list";
  for (const child of node.children) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "child-item";
    const lowerCounts = child.level < 4
      ? ` | ${childCount(child, child.level + 1)} direct or lower items`
      : "";
    button.innerHTML = `
      <span class="item-meta">Level ${child.level}${lowerCounts}</span>
      <span class="item-title"></span>
      ${child.foundational ? '<span class="item-foundation"></span>' : ""}
    `;
    button.querySelector(".item-title").textContent = child.name;
    const foundation = button.querySelector(".item-foundation");
    if (foundation) foundation.textContent = child.foundational;
    button.addEventListener("click", () => selectNode(child));
    list.appendChild(button);
  }
  refs.children.appendChild(list);
}

function renderDetail() {
  const node = selectedNode();
  refs.emptyState.hidden = Boolean(node);
  refs.detail.hidden = !node;
  if (!node) return;

  refs.detailLevel.textContent = `Level ${node.level}`;
  refs.detailTitle.textContent = node.name;
  refs.detailPath.textContent = node.path.join(" > ");
  refs.detailDescription.textContent = node.description || (
    node.level === 4
      ? "Specialized field from the supplied taxonomy."
      : "Taxonomy branch from the supplied source text."
  );
  refs.foundationalSection.hidden = !node.foundational;
  refs.foundationalText.textContent = node.foundational;
  refs.auditTaxonomyButton.disabled = state.auditLoading || !state.flat.length || node.level >= 4 && !parentNode(node);
  refs.auditBibliographyButton.disabled = state.auditLoading;
  refs.auditTaxonomyButton.textContent = state.auditLoading && state.auditMode === "taxonomy" ? "Auditing taxonomy..." : "Audit Taxonomy Gaps";
  refs.auditBibliographyButton.textContent = state.auditLoading && state.auditMode === "bibliography" ? "Auditing bibliography..." : "Audit Bibliography Gaps";
  renderAuditResults();
  renderBibliography(node);
  renderChildren(node);
}

function render() {
  renderStats();
  renderTree();
  renderDetail();
}

function renderAuditResults() {
  clear(refs.auditResults);
  if (!state.auditItems.length) return;

  const list = document.createElement("div");
  list.className = "audit-results";
  for (const item of state.auditItems) {
    const card = document.createElement("article");
    card.className = "audit-card";
    const title = state.auditMode === "bibliography"
      ? `${item.authors ? `${item.authors}, ` : ""}${item.title || "Untitled"}${item.year ? ` (${item.year})` : ""}`
      : item.name;
    const meta = state.auditMode === "bibliography"
      ? item.category || "bibliography"
      : item.foundational_work || "taxonomy item";
    card.innerHTML = `
      <strong></strong>
      <p class="item-meta"></p>
      <p></p>
    `;
    card.querySelector("strong").textContent = title;
    card.querySelector(".item-meta").textContent = meta;
    card.querySelector("p:last-child").textContent = item.why_missing || "";
    list.appendChild(card);
  }
  refs.auditResults.appendChild(list);
}

function renderBibliography(node) {
  clear(refs.bibliographyList);
  refs.bibliographySection.hidden = !node.bibliography.length;
  if (!node.bibliography.length) return;

  const list = document.createElement("div");
  list.className = "bibliography-list";
  for (const item of node.bibliography) {
    const card = document.createElement("article");
    card.className = "bibliography-card";
    card.innerHTML = `
      <strong></strong>
      <p class="item-meta"></p>
      <p></p>
    `;
    card.querySelector("strong").textContent = `${item.authors ? `${item.authors}, ` : ""}${item.title}${item.year ? ` (${item.year})` : ""}`;
    card.querySelector(".item-meta").textContent = item.category || "bibliography";
    card.querySelector("p:last-child").textContent = item.why_missing || "";
    list.appendChild(card);
  }
  refs.bibliographyList.appendChild(list);
}

function apiKey() {
  return refs.apiKeyInput.value.trim();
}

function dedupeTaxonomyItems(parent, items) {
  const seen = new Set(parent.children.map((child) => normalizeKey(child.name)));
  const accepted = [];
  for (const item of items || []) {
    const name = normalize(item.name);
    const key = normalizeKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    accepted.push({
      name,
      foundational: normalize(item.foundational_work),
      why_missing: normalize(item.why_missing),
      confidence: item.confidence || "medium",
    });
  }
  return accepted;
}

function dedupeBibliographyItems(node, items) {
  const seen = new Set([
    ...node.bibliography.map(bibliographyKey),
    bibliographyKey({ title: node.foundational, authors: "", year: "" }),
  ]);
  const accepted = [];
  for (const item of items || []) {
    const title = normalize(item.title);
    if (!title) continue;
    const clean = {
      authors: normalize(item.authors),
      title,
      year: normalize(item.year),
      category: normalize(item.category) || "bibliography",
      why_missing: normalize(item.why_missing),
      confidence: item.confidence || "medium",
    };
    const key = bibliographyKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push(clean);
  }
  return accepted;
}

async function auditTaxonomy() {
  const node = selectedNode();
  const parent = auditParentFor(node);
  if (!node || !parent) return;

  state.auditLoading = true;
  state.auditMode = "taxonomy";
  state.auditItems = [];
  refs.auditStatus.textContent = "Searching for core missing taxonomy items...";
  render();

  try {
    const payload = await fetchJson("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "taxonomy",
        apiKey: apiKey(),
        selectedPath: node.path,
        auditParentPath: parent.path,
        auditLevel: Math.min(parent.level + 1, 4),
        existingNames: parent.children.map((child) => child.name),
      }),
    });
    const accepted = dedupeTaxonomyItems(parent, payload.items);
    for (const item of accepted) {
      const child = createNode(parent.level + 1, item.name, "", item.foundational, parent);
      parent.children.push(child);
    }
    parent.children.sort((left, right) => left.name.localeCompare(right.name));
    state.flat = flatten(state.roots);
    applySavedBibliography();
    const source = serializeTaxonomy();
    localStorage.setItem(STORAGE_KEY, source);
    refs.sourceInput.value = source;
    state.sourceLabel = "Imported source + audits";
    state.auditItems = accepted;
    refs.auditStatus.textContent = accepted.length
      ? `${payload.overview || "Audit complete."} Added ${accepted.length} missing taxonomy item${accepted.length === 1 ? "" : "s"}.`
      : payload.overview || "Audit complete. No new core taxonomy items were safe to add.";
  } catch (error) {
    refs.auditStatus.textContent = error.message || "Taxonomy audit failed.";
  } finally {
    state.auditLoading = false;
    render();
  }
}

async function auditBibliography() {
  const node = selectedNode();
  if (!node) return;

  state.auditLoading = true;
  state.auditMode = "bibliography";
  state.auditItems = [];
  refs.auditStatus.textContent = "Searching for missing core bibliography items...";
  render();

  try {
    const payload = await fetchJson("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bibliography",
        apiKey: apiKey(),
        selectedPath: node.path,
        foundational: node.foundational,
        existingBibliography: node.bibliography,
      }),
    });
    const accepted = dedupeBibliographyItems(node, payload.items);
    node.bibliography.push(...accepted);
    saveNodeBibliography(node);
    state.auditItems = accepted;
    refs.auditStatus.textContent = accepted.length
      ? `${payload.overview || "Bibliography audit complete."} Added ${accepted.length} missing work${accepted.length === 1 ? "" : "s"}.`
      : payload.overview || "Bibliography audit complete. No new core works were safe to add.";
  } catch (error) {
    refs.auditStatus.textContent = error.message || "Bibliography audit failed.";
  } finally {
    state.auditLoading = false;
    render();
  }
}

async function loadInitialSource() {
  const imported = localStorage.getItem(STORAGE_KEY);
  if (imported) {
    setTaxonomy(imported, "Imported source");
    return;
  }

  try {
    const response = await fetch(SOURCE_URL);
    if (response.ok) {
      const text = await response.text();
      if (text.trim()) {
        setTaxonomy(text, "Checked-in source");
        return;
      }
    }
  } catch {
    // Local static fallback follows.
  }

  state.roots = [];
  state.flat = [];
  state.selectedId = "";
  state.sourceLabel = "No source loaded";
  refs.sourceInput.value = "";
  refs.importPanel.hidden = false;
  refs.importStatus.textContent = "No checked-in taxonomy source found. Paste the exact taxonomy text to browse it.";
  render();
}

refs.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTree();
});

refs.showImportButton.addEventListener("click", () => {
  refs.importPanel.hidden = false;
  refs.sourceInput.focus();
});

refs.hideImportButton.addEventListener("click", () => {
  refs.importPanel.hidden = true;
});

refs.parseSourceButton.addEventListener("click", () => {
  const text = refs.sourceInput.value.trim();
  if (!text) {
    refs.importStatus.textContent = "Paste the taxonomy source text first.";
    return;
  }
  const roots = parseTaxonomy(text);
  const flat = flatten(roots);
  if (!roots.length || !flat.some((node) => node.level === 4)) {
    refs.importStatus.textContent = "I could not find LEVEL 1 and L4 entries in that text.";
    return;
  }
  localStorage.setItem(STORAGE_KEY, text);
  setTaxonomy(text, "Imported source");
  refs.importStatus.textContent = `Parsed ${flat.length.toLocaleString()} items from the imported taxonomy.`;
});

refs.clearImportButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BIBLIOGRAPHY_KEY);
  state.bibliographyByPath = {};
  refs.importStatus.textContent = "Imported source cleared from this browser.";
  loadInitialSource();
});

refs.auditTaxonomyButton.addEventListener("click", auditTaxonomy);
refs.auditBibliographyButton.addEventListener("click", auditBibliography);

loadBibliographyStore();
loadInitialSource();
