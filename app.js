const STORAGE_KEY = "complete-human-knowledge-taxonomy-source";
const SOURCE_URL = "/data/user_taxonomy_source.txt";

const refs = {
  stats: document.querySelector("#stats"),
  searchInput: document.querySelector("#searchInput"),
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
  childrenTitle: document.querySelector("#childrenTitle"),
  children: document.querySelector("#children"),
};

const state = {
  roots: [],
  flat: [],
  selectedId: "",
  query: "",
  sourceLabel: "Starter sample",
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
  state.selectedId = state.roots[0]?.id || "";
  state.sourceLabel = sourceLabel;
  refs.sourceInput.value = text;
  render();
}

function selectedNode() {
  return state.flat.find((node) => node.id === state.selectedId) || null;
}

function selectNode(node) {
  state.selectedId = node.id;
  render();
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
  renderChildren(node);
}

function render() {
  renderStats();
  renderTree();
  renderDetail();
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
  refs.importStatus.textContent = "Imported source cleared from this browser.";
  loadInitialSource();
});

loadInitialSource();
