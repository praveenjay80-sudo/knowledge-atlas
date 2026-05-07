const STORAGE_KEY = "theoretical-sciences-taxonomy-source-v2";
const BIBLIOGRAPHY_KEY = "theoretical-sciences-taxonomy-bibliography-v2";
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
  parseAudit: document.querySelector("#parseAudit"),
  parseAuditSummary: document.querySelector("#parseAuditSummary"),
  parseAuditLevels: document.querySelector("#parseAuditLevels"),
  parseAuditSkipped: document.querySelector("#parseAuditSkipped"),
  tree: document.querySelector("#tree"),
  emptyState: document.querySelector("#emptyState"),
  detail: document.querySelector("#detail"),
  detailLevel: document.querySelector("#detailLevel"),
  detailTitle: document.querySelector("#detailTitle"),
  detailPath: document.querySelector("#detailPath"),
  externalSearchLinks: document.querySelector("#externalSearchLinks"),
  detailDescription: document.querySelector("#detailDescription"),
  foundationalSection: document.querySelector("#foundationalSection"),
  foundationalText: document.querySelector("#foundationalText"),
  explainButton: document.querySelector("#explainButton"),
  explainStatus: document.querySelector("#explainStatus"),
  explanation: document.querySelector("#explanation"),
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
  auditTargetId: "",
  auditLoading: false,
  explanation: null,
  explainTargetId: "",
  explainLoading: false,
  parseReport: null,
};

const EXTERNAL_SEARCH_PROVIDERS = [
  {
    id: "worldcat",
    icon: "W",
    label: "WorldCat",
    buildUrl: (query) => `https://search.worldcat.org/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "scholar",
    icon: "G",
    label: "Google Scholar",
    buildUrl: (query) => `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
  },
  {
    id: "eth",
    icon: "ETH",
    label: "ETH Zurich swisscovery",
    buildUrl: (query) =>
      `https://eth.swisscovery.slsp.ch/discovery/search?query=any,contains,${encodeURIComponent(query)}&tab=discovery_network&search_scope=DiscoveryNetwork&vid=41SLSP_ETH:ETH&lang=en`,
  },
  {
    id: "gnod",
    icon: "GN",
    label: "Gnod Search",
    buildUrl: (query) => `https://www.gnod.com/search/?q=${encodeURIComponent(query)}`,
  },
];

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripMarkdown(value) {
  return normalize(
    String(value || "")
      .replace(/[*`#_]/g, " ")
      .replace(/\s+/g, " "),
  );
}

function stripLeadingEnumeration(value) {
  return normalize(String(value || "").replace(/^\d+(?:\.\d+)*(?:\.)?\s*/, ""));
}

function trimSegmentDecorations(value) {
  return normalize(
    String(value || "")
      .replace(/^[\s\-–—:;|]+/, "")
      .replace(/[\s\-–—:;|]+$/, ""),
  );
}

function splitDelimitedItems(value) {
  return String(value || "")
    .split(/\s*;\s*/)
    .map((item) => stripLeadingEnumeration(stripMarkdown(item)))
    .filter(Boolean);
}

function extractTaggedSegments(line) {
  const text = String(line || "");
  const matches = [...text.matchAll(/\[L([1-5])\]/g)];
  if (!matches.length) {
    return [];
  }

  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = match.index + match[0].length;
    const end = next ? next.index : text.length;
    return {
      level: Number(match[1]),
      raw: text.slice(start, end),
    };
  });
}

function extractLegacySegment(line) {
  const match = String(line || "").match(/^(LEVEL\s+1|L[1-5]):\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const level = match[1].toUpperCase().startsWith("LEVEL") ? 1 : Number(match[1].slice(1));
  return [{ level, raw: match[2] }];
}

function parseNameAndNote(raw) {
  let text = stripLeadingEnumeration(stripMarkdown(trimSegmentDecorations(raw)));
  let noteParts = [];

  const crossReference = text.match(/\s*↔\s*(.+)$/);
  if (crossReference) {
    noteParts.push(`Cross-reference: ${normalize(crossReference[1])}`);
    text = normalize(text.slice(0, crossReference.index));
  }

  const parentheticalNotes = [...text.matchAll(/\(([^()]*)\)/g)]
    .map((match) => normalize(match[1]))
    .filter(Boolean);
  if (parentheticalNotes.length) {
    noteParts = [...noteParts, ...parentheticalNotes];
    text = normalize(text.replace(/\([^()]*\)/g, " "));
  }

  const legacySeparator = text.match(/\s+Foundational work:\s+/i);
  if (legacySeparator) {
    const index = legacySeparator.index;
    noteParts.unshift(`Foundational work: ${normalize(text.slice(index + legacySeparator[0].length))}`);
    text = normalize(text.slice(0, index));
  }

  const simpleNote = text.match(/\s*\|\|\s*(.+)$/);
  if (simpleNote) {
    noteParts.unshift(normalize(simpleNote[1]));
    text = normalize(text.slice(0, simpleNote.index));
  }

  return {
    name: text,
    note: normalize(noteParts.join(" | ")),
  };
}

function parseNumberedNameAndConcepts(raw) {
  const cleaned = trimSegmentDecorations(raw);
  const conceptSafe =
    cleaned.includes(";") &&
    !/Foundational work:/i.test(cleaned) &&
    !cleaned.includes("||") &&
    !cleaned.includes("↔");
  if (!conceptSafe) {
    return { entry: parseNameAndNote(cleaned), concepts: [] };
  }

  const pieces = cleaned.split(/\s*;\s*/).filter(Boolean);
  const entry = parseNameAndNote(pieces.shift() || "");
  const concepts = pieces
    .map((piece) => stripLeadingEnumeration(stripMarkdown(piece)))
    .filter(Boolean);
  return { entry, concepts };
}

function parseLevelEntries(level, raw) {
  const cleaned = trimSegmentDecorations(raw);
  if (!cleaned) return [];

  if (level === 5) {
    return splitDelimitedItems(cleaned).map((name) => ({ name, note: "", concepts: [] }));
  }

  const { entry, concepts } = parseNumberedNameAndConcepts(cleaned);
  return entry.name ? [{ ...entry, concepts }] : [];
}

function makeId(path) {
  return path.join(" > ");
}

function createNode(level, name, description = "", note = "", parent = null) {
  const path = parent ? [...parent.path, name] : [name];
  return {
    id: makeId(path),
    level,
    name,
    description,
    note,
    path,
    bibliography: [],
    children: [],
  };
}

function makeParseReport() {
  return {
    totalLines: 0,
    nonEmptyLines: 0,
    parsedLines: 0,
    parsedSegments: 0,
    parsedConceptNodes: 0,
    ignoredLines: 0,
    rawTagsByLevel: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    createdByLevel: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    skippedUntaggedLines: [],
    skippedTaggedLines: [],
    parentMissingLines: [],
    tableLines: [],
  };
}

function pushSample(list, lineNumber, text, reason = "") {
  if (list.length >= 30) return;
  list.push({ lineNumber, text: normalize(text).slice(0, 260), reason });
}

function isIgnoredSourceLine(line) {
  return (
    /^A COMPLETE TAXONOMY/i.test(line) ||
    /^#\s*Exhaustive Hierarchical Taxonomy/i.test(line) ||
    /^##\s*Level Convention/i.test(line) ||
    /^##\s*Cross-Domain Connection Map/i.test(line) ||
    /^---+$/.test(line) ||
    /^\*End of taxonomy/i.test(line)
  );
}

function parseTaxonomyWithReport(text) {
  const roots = [];
  let current = { 1: null, 2: null, 3: null, 4: null, 5: null };
  const report = makeParseReport();

  for (const [lineIndex, rawLine] of String(text || "").split(/\r?\n/).entries()) {
    const lineNumber = lineIndex + 1;
    report.totalLines += 1;
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    report.nonEmptyLines += 1;

    const tagMatches = [...line.matchAll(/\[L([1-5])\]/g)];
    for (const match of tagMatches) {
      report.rawTagsByLevel[Number(match[1])] += 1;
    }

    if (/^\|/.test(line)) {
      report.ignoredLines += 1;
      pushSample(report.tableLines, lineNumber, line, "Markdown table row");
      continue;
    }

    if (isIgnoredSourceLine(line)) {
      report.ignoredLines += 1;
      continue;
    }

    const taggedSegments = extractTaggedSegments(line);
    const legacySegments = extractLegacySegment(line);
    if (!taggedSegments.length && legacySegments) {
      for (const segment of legacySegments) {
        report.rawTagsByLevel[segment.level] += 1;
      }
    }
    const segments = taggedSegments.length ? taggedSegments : legacySegments || [];
    if (!segments.length) {
      pushSample(report.skippedUntaggedLines, lineNumber, line, "No [L1]-[L5] or L1-L5 marker");
      continue;
    }

    let lineCreatedNodes = 0;
    for (const segment of segments) {
      const entries = parseLevelEntries(segment.level, segment.raw);
      if (!entries.length) {
        pushSample(report.skippedTaggedLines, lineNumber, line, `L${segment.level} tag had no item name`);
      }
      for (const entry of entries) {
        if (!entry.name) continue;

        if (segment.level === 1) {
          const node = createNode(1, entry.name, "", entry.note);
          roots.push(node);
          current = { 1: node, 2: null, 3: null, 4: null, 5: null };
          report.createdByLevel[1] += 1;
          report.parsedSegments += 1;
          lineCreatedNodes += 1;
          continue;
        }

        const parent = current[segment.level - 1];
        if (!parent) {
          pushSample(report.parentMissingLines, lineNumber, line, `L${segment.level} appeared before an L${segment.level - 1} parent`);
          continue;
        }

        const node = createNode(segment.level, entry.name, "", entry.note, parent);
        parent.children.push(node);
        report.createdByLevel[segment.level] += 1;
        report.parsedSegments += 1;
        lineCreatedNodes += 1;
        for (const concept of entry.concepts || []) {
          const conceptLevel = Math.min(segment.level + 1, 5);
          node.children.push(createNode(conceptLevel, concept, "", "", node));
          report.createdByLevel[conceptLevel] += 1;
          report.parsedConceptNodes += 1;
          lineCreatedNodes += 1;
        }

        for (let level = segment.level; level <= 5; level += 1) {
          current[level] = level === segment.level ? node : null;
        }
      }
    }
    if (lineCreatedNodes) report.parsedLines += 1;
  }

  return { roots, report };
}

function parseTaxonomy(text) {
  return parseTaxonomyWithReport(text).roots;
}

function flatten(nodes) {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function childCount(node, level) {
  return flatten(node.children).filter((item) => item.level === level).length;
}

function countByLevel(flat) {
  return [1, 2, 3, 4, 5].map((level) => flat.filter((node) => node.level === level).length);
}

function clear(element) {
  element.replaceChildren();
}

function setTaxonomy(text, sourceLabel) {
  const parsed = parseTaxonomyWithReport(text);
  state.roots = parsed.roots;
  state.parseReport = parsed.report;
  state.flat = flatten(state.roots);
  applySavedBibliography();
  state.selectedId = state.roots[0]?.id || "";
  state.sourceLabel = sourceLabel;
  state.auditItems = [];
  state.auditMode = "";
  state.auditTargetId = "";
  refs.sourceInput.value = text;
  render();
}

function selectedNode() {
  return state.flat.find((node) => node.id === state.selectedId) || null;
}

function externalSearchEnabled(node) {
  return node && node.level >= 1 && node.level <= 4;
}

function externalSearchQuery(node) {
  return node.path.join(" ");
}

function createExternalSearchLinks(node) {
  const group = document.createElement("div");
  group.className = "external-search-links";
  group.setAttribute("aria-label", `Search sources for ${node.name}`);
  if (!externalSearchEnabled(node)) return group;

  const query = externalSearchQuery(node);
  for (const provider of EXTERNAL_SEARCH_PROVIDERS) {
    const link = document.createElement("a");
    link.className = `search-icon search-icon-${provider.id}`;
    link.href = provider.buildUrl(query);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `Search ${provider.label} for ${query}`;
    link.setAttribute("aria-label", `Search ${provider.label} for ${query}`);
    link.textContent = provider.icon;
    link.addEventListener("click", (event) => event.stopPropagation());
    group.appendChild(link);
  }
  return group;
}

function selectNode(node) {
  state.selectedId = node.id;
  state.auditItems = [];
  state.auditMode = "";
  state.auditTargetId = "";
  state.explanation = null;
  state.explainTargetId = "";
  refs.explainStatus.textContent = "";
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
  return node?.level === 5 ? parentNode(node) : node;
}

function normalizeKey(value) {
  return normalize(value).toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function bibliographyKey(item) {
  return [item.title, item.authors, item.year].map(normalizeKey).join("|");
}

function serializeTaxonomy() {
  const lines = [];

  function walk(node) {
    lines.push(`L${node.level}: ${node.name}${node.note ? ` || ${node.note}` : ""}`);
    node.children.forEach(walk);
  }

  state.roots.forEach(walk);
  return `${lines.join("\n").trim()}\n`;
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
    [node.name, node.description, node.note, node.path.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function nodeMatchesQuery(node, query) {
  return [node.name, node.description, node.note, node.path.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function renderStats() {
  clear(refs.stats);
  const [l1, l2, l3, l4, l5] = countByLevel(state.flat);
  const items = [
    `${state.sourceLabel}`,
    `L1 ${l1}`,
    `L2 ${l2}`,
    `L3 ${l3}`,
    `L4 ${l4}`,
    `L5 ${l5}`,
    `${state.flat.length.toLocaleString()} total`,
  ];
  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "stat";
    chip.textContent = item;
    refs.stats.appendChild(chip);
  }
}

function renderParseAudit() {
  const report = state.parseReport;
  refs.parseAudit.hidden = !report;
  clear(refs.parseAuditLevels);
  clear(refs.parseAuditSkipped);
  if (!report) return;

  const createdTotal = Object.values(report.createdByLevel).reduce((sum, count) => sum + count, 0);
  const rawTagTotal = Object.values(report.rawTagsByLevel).reduce((sum, count) => sum + count, 0);
  const issueCount =
    report.skippedUntaggedLines.length +
    report.skippedTaggedLines.length +
    report.parentMissingLines.length;

  refs.parseAuditSummary.textContent =
    `Created ${createdTotal.toLocaleString()} nodes from ${report.parsedLines.toLocaleString()} tagged source lines. ` +
    `Raw source contained ${rawTagTotal.toLocaleString()} explicit L1-L5 markers. ` +
    `${issueCount ? `${issueCount} sampled parser issue${issueCount === 1 ? "" : "s"} need review.` : "No tagged taxonomy lines were sampled as failed."}`;

  for (const level of [1, 2, 3, 4, 5]) {
    const chip = document.createElement("span");
    chip.className = "parse-level-chip";
    chip.textContent = `L${level}: ${report.createdByLevel[level].toLocaleString()} nodes / ${report.rawTagsByLevel[level].toLocaleString()} tags`;
    refs.parseAuditLevels.appendChild(chip);
  }

  const groups = [
    ["Tagged lines with missing parents", report.parentMissingLines],
    ["Tagged lines with no usable item name", report.skippedTaggedLines],
    ["Non-empty untagged lines", report.skippedUntaggedLines],
    ["Markdown table rows kept out of the hierarchy", report.tableLines],
  ];

  for (const [title, lines] of groups) {
    const section = document.createElement("section");
    section.className = "parse-skip-group";
    const heading = document.createElement("h4");
    heading.textContent = `${title} (${lines.length}${lines.length >= 30 ? "+" : ""})`;
    section.appendChild(heading);

    if (!lines.length) {
      const empty = document.createElement("p");
      empty.className = "item-meta";
      empty.textContent = "None sampled.";
      section.appendChild(empty);
    } else {
      const list = document.createElement("ol");
      for (const item of lines) {
        const row = document.createElement("li");
        row.textContent = `Line ${item.lineNumber}: ${item.reason ? `${item.reason} - ` : ""}${item.text}`;
        list.appendChild(row);
      }
      section.appendChild(list);
    }
    refs.parseAuditSkipped.appendChild(section);
  }
}

function renderTree() {
  clear(refs.tree);
  const query = state.query.toLowerCase().trim();
  const nodes = query ? visibleNodes() : state.roots;
  if (!state.flat.length || !nodes.length) {
    const empty = document.createElement("p");
    empty.className = "no-results";
    empty.textContent = state.flat.length ? "No matching fields found." : "Import the taxonomy source to build the hierarchy.";
    refs.tree.appendChild(empty);
    return;
  }

  if (query) {
    for (const node of nodes.slice(0, 900)) {
      refs.tree.appendChild(renderTreeButton(node, true));
    }
    return;
  }

  const list = document.createElement("div");
  list.className = "structured-tree";
  for (const root of state.roots) {
    list.appendChild(renderTreeBranch(root));
  }
  refs.tree.appendChild(list);
}

function renderTreeButton(node, showPath = false) {
    const item = document.createElement("div");
    item.className = `tree-item level-${node.level}`;
    item.classList.toggle("active", node.id === state.selectedId);
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    item.innerHTML = `
      <span class="item-meta">L${node.level}</span>
      <span class="item-title"></span>
      ${showPath ? '<span class="item-path"></span>' : ""}
      ${node.note ? '<span class="item-foundation"></span>' : ""}
    `;
    item.querySelector(".item-title").textContent = node.name;
    const path = item.querySelector(".item-path");
    if (path) path.textContent = node.path.join(" > ");
    const foundation = item.querySelector(".item-foundation");
    if (foundation) foundation.textContent = node.note;
    item.appendChild(createExternalSearchLinks(node));
    item.addEventListener("click", () => selectNode(node));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectNode(node);
      }
    });
    return item;
}

function renderTreeBranch(node) {
  const branch = document.createElement("div");
  branch.className = `tree-branch level-${node.level}`;
  const selected = selectedNode();
  const isSelectedPath = Boolean(selected) && node.path.every((part, index) => selected.path[index] === part);
  branch.appendChild(renderTreeButton(node));

  if (node.children.length && (node.level === 1 || isSelectedPath)) {
    const children = document.createElement("div");
    children.className = "tree-children";
    for (const child of node.children) {
      if (node.level >= 4 && !isSelectedPath) continue;
      children.appendChild(renderTreeBranch(child));
    }
    branch.appendChild(children);
  }
  return branch;
}

function renderChildren(node) {
  clear(refs.children);
  refs.childrenTitle.textContent = node.children.length ? `Children (${node.children.length})` : "Children";
  if (!node.children.length) {
    const empty = document.createElement("p");
    empty.className = "no-results";
    empty.textContent = node.level === 5 ? "This is a Level 5 concept or object of study in the supplied taxonomy." : "No children are loaded under this item.";
    refs.children.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "children-list";
  for (const child of node.children) {
    const item = document.createElement("div");
    item.className = "child-item";
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    const lowerCounts = child.level < 5
      ? ` | ${childCount(child, child.level + 1)} direct or lower items`
      : "";
    item.innerHTML = `
      <span class="item-meta">L${child.level}${lowerCounts}</span>
      <span class="item-title"></span>
      ${child.note ? '<span class="item-foundation"></span>' : ""}
    `;
    item.querySelector(".item-title").textContent = child.name;
    const foundation = item.querySelector(".item-foundation");
    if (foundation) foundation.textContent = child.note;
    item.appendChild(createExternalSearchLinks(child));
    item.addEventListener("click", () => selectNode(child));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectNode(child);
      }
    });
    list.appendChild(item);
  }
  refs.children.appendChild(list);
}

function renderDetail() {
  const node = selectedNode();
  refs.emptyState.hidden = Boolean(node);
  refs.detail.hidden = !node;
  if (!node) return;

  refs.detailLevel.textContent = `L${node.level}`;
  refs.detailTitle.textContent = node.name;
  refs.detailPath.textContent = node.path.join(" > ");
  refs.externalSearchLinks.replaceChildren();
  refs.externalSearchLinks.hidden = !externalSearchEnabled(node);
  if (externalSearchEnabled(node)) {
    refs.externalSearchLinks.append(...createExternalSearchLinks(node).childNodes);
  }
  refs.detailDescription.textContent = node.description || (
    node.level === 5
      ? "Specific concept or object of study from the supplied taxonomy."
      : node.level === 4
      ? "Topic area from the supplied taxonomy."
      : "Taxonomy branch from the supplied source text."
  );
  refs.foundationalSection.hidden = !node.note;
  refs.foundationalText.textContent = node.note;
  refs.explainButton.disabled = state.explainLoading || !state.flat.length;
  refs.explainButton.textContent = state.explainLoading ? "Teaching..." : "Teach This Item";
  renderExplanation(node);
  refs.auditTaxonomyButton.disabled = state.auditLoading || !state.flat.length || (node.level >= 5 && !parentNode(node));
  refs.auditBibliographyButton.disabled = state.auditLoading;
  refs.auditTaxonomyButton.textContent = state.auditLoading && state.auditMode === "taxonomy" ? "Auditing taxonomy..." : "Audit Taxonomy Gaps";
  refs.auditBibliographyButton.textContent = state.auditLoading && state.auditMode === "bibliography" ? "Auditing bibliography..." : "Audit Bibliography Gaps";
  renderAuditResults();
  renderBibliography(node);
  renderChildren(node);
}

function addExplanationSection(parent, title, body) {
  if (!body) return;
  const section = document.createElement("section");
  section.className = "explanation-section";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = body;
  section.append(heading, paragraph);
  parent.appendChild(section);
}

function renderExplanation(node) {
  clear(refs.explanation);
  if (!state.explanation || state.explainTargetId !== node.id) return;

  const data = state.explanation;
  const article = document.createElement("article");
  article.className = "explanation-card";
  const title = document.createElement("h3");
  title.textContent = data.title || node.name;
  article.appendChild(title);

  addExplanationSection(article, "Plain Language", data.plain_language);
  addExplanationSection(article, "Analogy", data.analogy);

  if (Array.isArray(data.examples) && data.examples.length) {
    const section = document.createElement("section");
    section.className = "explanation-section";
    const heading = document.createElement("h4");
    heading.textContent = "Examples";
    const list = document.createElement("ul");
    for (const example of data.examples) {
      const item = document.createElement("li");
      item.textContent = example;
      list.appendChild(item);
    }
    section.append(heading, list);
    article.appendChild(section);
  }

  addExplanationSection(article, "Why It Matters", data.why_it_matters);

  if (Array.isArray(data.key_terms) && data.key_terms.length) {
    const section = document.createElement("section");
    section.className = "explanation-section";
    const heading = document.createElement("h4");
    heading.textContent = "Key Terms";
    const list = document.createElement("dl");
    for (const term of data.key_terms) {
      const dt = document.createElement("dt");
      dt.textContent = term.term;
      const dd = document.createElement("dd");
      dd.textContent = term.explanation;
      list.append(dt, dd);
    }
    section.append(heading, list);
    article.appendChild(section);
  }

  addExplanationSection(article, "Common Misconception", data.common_misconception);
  addExplanationSection(article, "What To Learn Next", data.how_to_learn_next);
  refs.explanation.appendChild(article);
}

function render() {
  renderStats();
  renderParseAudit();
  renderTree();
  renderDetail();
}

function renderAuditResults() {
  clear(refs.auditResults);
  if (!state.auditItems.length) return;

  const toolbar = document.createElement("div");
  toolbar.className = "audit-result-toolbar";
  const addAll = document.createElement("button");
  addAll.type = "button";
  addAll.textContent = `Add all ${state.auditItems.length}`;
  addAll.addEventListener("click", addAllAuditItems);
  toolbar.appendChild(addAll);
  refs.auditResults.appendChild(toolbar);

  const list = document.createElement("div");
  list.className = "audit-results";
  state.auditItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "audit-card";
    const title = state.auditMode === "bibliography"
      ? `${item.authors ? `${item.authors}, ` : ""}${item.title || "Untitled"}${item.year ? ` (${item.year})` : ""}`
      : item.name;
    const meta = state.auditMode === "bibliography"
      ? item.category || "bibliography"
      : item.note || "taxonomy item";
    card.innerHTML = `
      <strong></strong>
      <p class="item-meta"></p>
      <p class="audit-why"></p>
      <button type="button" class="add-audit-item"></button>
    `;
    card.querySelector("strong").textContent = title;
    card.querySelector(".item-meta").textContent = meta;
    card.querySelector(".audit-why").textContent = item.why_missing || "";
    const addButton = card.querySelector(".add-audit-item");
    addButton.textContent = state.auditMode === "bibliography" ? "Add to bibliography" : "Add to taxonomy";
    addButton.addEventListener("click", () => addAuditItem(index));
    list.appendChild(card);
  });
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
        note: normalize(item.foundational_work),
        why_missing: normalize(item.why_missing),
        confidence: item.confidence || "medium",
        parentId: parent.id,
    });
  }
  return accepted;
}

function dedupeBibliographyItems(node, items) {
  const seen = new Set([
    ...node.bibliography.map(bibliographyKey),
    bibliographyKey({ title: node.note, authors: "", year: "" }),
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
      targetId: node.id,
    };
    const key = bibliographyKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push(clean);
  }
  return accepted;
}

function persistTaxonomy() {
  const source = serializeTaxonomy();
  localStorage.setItem(STORAGE_KEY, source);
  refs.sourceInput.value = source;
  state.sourceLabel = "Saved source + audit additions";
}

function addTaxonomyCandidate(item) {
  const parent = state.flat.find((node) => node.id === item.parentId);
  if (!parent || parent.level >= 5) return false;
  if (parent.children.some((child) => normalizeKey(child.name) === normalizeKey(item.name))) return false;

  const child = createNode(parent.level + 1, item.name, "", item.note, parent);
  parent.children.push(child);
  parent.children.sort((left, right) => left.name.localeCompare(right.name));
  state.flat = flatten(state.roots);
  applySavedBibliography();
  persistTaxonomy();
  return true;
}

function addBibliographyCandidate(item) {
  const node = state.flat.find((candidate) => candidate.id === item.targetId);
  if (!node) return false;
  if (node.bibliography.some((entry) => bibliographyKey(entry) === bibliographyKey(item))) return false;

  node.bibliography.push(item);
  saveNodeBibliography(node);
  return true;
}

function addAuditItem(index) {
  const item = state.auditItems[index];
  if (!item) return;
  const added = state.auditMode === "bibliography"
    ? addBibliographyCandidate(item)
    : addTaxonomyCandidate(item);
  state.auditItems.splice(index, 1);
  refs.auditStatus.textContent = added
    ? `Added "${state.auditMode === "bibliography" ? item.title : item.name}" and saved it for refresh.`
    : "That item was already present or could not be added.";
  render();
}

function addAllAuditItems() {
  let added = 0;
  for (const item of state.auditItems) {
    const ok = state.auditMode === "bibliography"
      ? addBibliographyCandidate(item)
      : addTaxonomyCandidate(item);
    if (ok) added += 1;
  }
  const attempted = state.auditItems.length;
  state.auditItems = [];
  refs.auditStatus.textContent = `Added ${added} of ${attempted} audit item${attempted === 1 ? "" : "s"}.`;
  if (added) refs.auditStatus.textContent += " Saved for refresh.";
  render();
}

async function auditTaxonomy() {
  const node = selectedNode();
  const parent = auditParentFor(node);
  if (!node || !parent) return;

  state.auditLoading = true;
  state.auditMode = "taxonomy";
  state.auditTargetId = parent.id;
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
        auditLevel: Math.min(parent.level + 1, 5),
        existingNames: parent.children.map((child) => child.name),
      }),
    });
    const accepted = dedupeTaxonomyItems(parent, payload.items);
    state.auditItems = accepted;
    refs.auditStatus.textContent = accepted.length
      ? `${payload.overview || "Audit complete."} Found ${accepted.length} candidate item${accepted.length === 1 ? "" : "s"} to review and add.`
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
  state.auditTargetId = node.id;
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
        foundational: node.note,
        existingBibliography: node.bibliography,
      }),
    });
    const accepted = dedupeBibliographyItems(node, payload.items);
    state.auditItems = accepted;
    refs.auditStatus.textContent = accepted.length
      ? `${payload.overview || "Bibliography audit complete."} Found ${accepted.length} candidate work${accepted.length === 1 ? "" : "s"} to review and add.`
      : payload.overview || "Bibliography audit complete. No new core works were safe to add.";
  } catch (error) {
    refs.auditStatus.textContent = error.message || "Bibliography audit failed.";
  } finally {
    state.auditLoading = false;
    render();
  }
}

async function explainSelectedItem() {
  const node = selectedNode();
  if (!node) return;

  state.explainLoading = true;
  state.explanation = null;
  state.explainTargetId = node.id;
  refs.explainStatus.textContent = "Building a school-level lesson with analogy and examples...";
  render();

  try {
    const payload = await fetchJson("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey(),
        selectedPath: node.path,
        level: node.level,
        note: node.note,
        childNames: node.children.map((child) => child.name),
        bibliography: node.bibliography,
      }),
    });
    state.explanation = payload;
    refs.explainStatus.textContent = "Explanation ready.";
  } catch (error) {
    refs.explainStatus.textContent = error.message || "Explanation failed.";
  } finally {
    state.explainLoading = false;
    render();
  }
}

async function loadInitialSource() {
  const imported = localStorage.getItem(STORAGE_KEY);
  if (imported) {
    const roots = parseTaxonomy(imported);
    if (roots.length) {
      setTaxonomy(imported, "Saved source");
      refs.importStatus.textContent = "Loaded saved taxonomy and bibliography additions from this browser.";
      return;
    }
    refs.importStatus.textContent = "Saved taxonomy could not be read. Paste or import the source again.";
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
  refs.importStatus.textContent = "No checked-in taxonomy source found. Paste the exact [L1]-[L5] taxonomy text to browse it.";
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
  const parsed = parseTaxonomyWithReport(text);
  const flat = flatten(parsed.roots);
  if (!parsed.roots.length || !flat.some((node) => node.level >= 4)) {
    refs.importStatus.textContent = "I could not find usable [L1]-[L5] taxonomy entries in that text.";
    return;
  }
  localStorage.setItem(STORAGE_KEY, text);
  setTaxonomy(text, "Imported source");
  const skippedTagged =
    parsed.report.skippedTaggedLines.length + parsed.report.parentMissingLines.length;
  refs.importStatus.textContent =
    `Parsed ${flat.length.toLocaleString()} items from the imported taxonomy. ` +
    `${skippedTagged ? `Review parser coverage: ${skippedTagged} sampled tagged issue${skippedTagged === 1 ? "" : "s"}.` : "Every sampled tagged line became taxonomy nodes."}`;
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
refs.explainButton.addEventListener("click", explainSelectedItem);

loadBibliographyStore();
loadInitialSource();
