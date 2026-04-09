const state = {
  activeTab: "learn",
  selectedNode: null,
  activeTarget: null,
  roots: [],
  treeChildren: new Map(),
  expanded: new Set(),
  insights: null,
  bibliography: null,
  conceptMap: null,
  masteryGuide: null,
  inlineConceptBibliographies: new Map(),
  loadingConceptId: null,
};

const refs = {
  apiStatus: document.querySelector("#apiStatus"),
  sectionCount: document.querySelector("#sectionCount"),
  branchCount: document.querySelector("#branchCount"),
  leafCount: document.querySelector("#leafCount"),
  searchInput: document.querySelector("#searchInput"),
  searchMeta: document.querySelector("#searchMeta"),
  searchResults: document.querySelector("#searchResults"),
  tree: document.querySelector("#tree"),
  emptyState: document.querySelector("#emptyState"),
  studioShell: document.querySelector("#studioShell"),
  topicTitle: document.querySelector("#topicTitle"),
  topicSummary: document.querySelector("#topicSummary"),
  topicLineage: document.querySelector("#topicLineage"),
  topicBadges: document.querySelector("#topicBadges"),
  buildLearningButton: document.querySelector("#buildLearningButton"),
  generateBibliographyButton: document.querySelector("#generateBibliographyButton"),
  refreshLearningButton: document.querySelector("#refreshLearningButton"),
  refreshMasteryButton: document.querySelector("#refreshMasteryButton"),
  learnStatus: document.querySelector("#learnStatus"),
  learnError: document.querySelector("#learnError"),
  learnBrief: document.querySelector("#learnBrief"),
  conceptLadder: document.querySelector("#conceptLadder"),
  readStatus: document.querySelector("#readStatus"),
  representativeWorks: document.querySelector("#representativeWorks"),
  bibliographyForm: document.querySelector("#bibliographyForm"),
  audienceSelect: document.querySelector("#audienceSelect"),
  focusInput: document.querySelector("#focusInput"),
  notesInput: document.querySelector("#notesInput"),
  maxEntriesInput: document.querySelector("#maxEntriesInput"),
  maxEntriesLabel: document.querySelector("#maxEntriesLabel"),
  activeTargetLabel: document.querySelector("#activeTargetLabel"),
  bibliographyError: document.querySelector("#bibliographyError"),
  bibliographyOutput: document.querySelector("#bibliographyOutput"),
  fingerprintPanel: document.querySelector("#fingerprintPanel"),
  exploreKeywords: document.querySelector("#exploreKeywords"),
  relatedTopics: document.querySelector("#relatedTopics"),
  masteryAudienceSelect: document.querySelector("#masteryAudienceSelect"),
  masteryFocusInput: document.querySelector("#masteryFocusInput"),
  masterStatus: document.querySelector("#masterStatus"),
  masteryError: document.querySelector("#masteryError"),
  masteryOutput: document.querySelector("#masteryOutput"),
  readingPath: document.querySelector("#readingPath"),
  checkpointPanel: document.querySelector("#checkpointPanel"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: {
    learn: document.querySelector("#learnTab"),
    read: document.querySelector("#readTab"),
    explore: document.querySelector("#exploreTab"),
    master: document.querySelector("#masterTab"),
  },
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let payload = {};

  if (contentType.includes("application/json")) {
    payload = rawText ? JSON.parse(rawText) : {};
  } else if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 140);
      throw new Error(
        preview.includes("The page could not be found")
          ? "This API route is not deployed yet on Vercel. Update the app files in GitHub and redeploy."
          : `Server returned non-JSON output: ${preview}`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function clearChildren(element) {
  element.replaceChildren();
}

function setTab(tab) {
  state.activeTab = tab;
  for (const button of refs.tabButtons) {
    button.classList.toggle("active", button.dataset.tab === tab);
  }
  for (const [key, panel] of Object.entries(refs.tabPanels)) {
    panel.hidden = key !== tab;
  }
}

function createBadge(label, soft = false) {
  const badge = document.createElement("span");
  badge.className = `pill${soft ? " soft" : ""}`;
  badge.textContent = label;
  return badge;
}

function createInfoPill(label, value) {
  const chip = document.createElement("span");
  chip.className = "info-pill";
  chip.textContent = `${label}: ${value}`;
  return chip;
}

function levelLabel(level) {
  return {
    section: "Section",
    branch: "Branch",
    leaf: "Leaf",
    auxiliary: "Auxiliary",
  }[level] || "MSC node";
}

function renderTreeNode(node, depth = 0) {
  const shell = document.createElement("div");
  shell.className = "tree-node";
  shell.style.setProperty("--depth", depth);

  const row = document.createElement("div");
  row.className = "tree-row";

  const button = document.createElement("button");
  button.className = `tree-button${state.selectedNode?.code === node.code ? " active" : ""}`;
  button.type = "button";
  button.innerHTML = `
    <strong>${node.code}</strong>
    <span>${node.title}</span>
    <small>${levelLabel(node.level)} · ${node.child_count} children</small>
  `;
  button.addEventListener("click", () => selectNode(node.code));
  row.appendChild(button);

  if (node.child_count > 0) {
    const toggle = document.createElement("button");
    toggle.className = "tree-toggle";
    toggle.type = "button";
    toggle.textContent = state.expanded.has(node.code) ? "−" : "+";
    toggle.addEventListener("click", async () => {
      if (!state.treeChildren.has(node.code)) {
        await loadChildren(node.code);
      }
      if (state.expanded.has(node.code)) {
        state.expanded.delete(node.code);
      } else {
        state.expanded.add(node.code);
      }
      renderTree();
    });
    row.appendChild(toggle);
  }

  shell.appendChild(row);

  if (state.expanded.has(node.code)) {
    const children = state.treeChildren.get(node.code) || [];
    for (const child of children) {
      shell.appendChild(renderTreeNode(child, depth + 1));
    }
  }

  return shell;
}

function renderTree() {
  clearChildren(refs.tree);
  for (const root of state.roots) {
    refs.tree.appendChild(renderTreeNode(root));
  }
}

function renderSearchResults(items, total) {
  refs.searchMeta.textContent = `${total} matches`;
  clearChildren(refs.searchResults);

  for (const item of items.slice(0, 10)) {
    const button = document.createElement("button");
    button.className = "search-chip";
    button.type = "button";
    button.innerHTML = `<strong>${item.code}</strong><span>${item.title}</span>`;
    button.addEventListener("click", () => selectNode(item.code));
    refs.searchResults.appendChild(button);
  }
}

function updateActiveTargetLabel() {
  refs.activeTargetLabel.textContent = state.activeTarget
    ? `Current reading target: ${state.activeTarget.target_label}`
    : "Current reading target: none";
}

function setActiveTarget(target) {
  state.activeTarget = target;
  updateActiveTargetLabel();
}

function buildNodeTarget() {
  if (!state.selectedNode) {
    return null;
  }
  return {
    target_scheme: "msc",
    target_id: state.selectedNode.code,
    target_label: state.selectedNode.title,
    description: state.selectedNode.description,
  };
}

function buildConceptTarget(concept) {
  const conceptLabel = typeof concept === "string" ? concept : concept?.name || "";
  const conceptDescription =
    typeof concept === "string"
      ? `${conceptLabel} as a concept within ${state.selectedNode?.title || "the selected MSC topic"}.`
      : [
          concept?.explanation,
          concept?.why_it_matters,
          `Example: ${concept?.example || ""}`,
        ]
          .filter(Boolean)
          .join(" ");

  return {
    target_scheme: "concept",
    target_id: `${state.selectedNode?.code || "topic"}:${conceptLabel}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-"),
    target_label: conceptLabel,
    description: conceptDescription,
    parent_label: state.selectedNode?.title || "",
    parent_code: state.selectedNode?.code || "",
  };
}

function getPhaseFeature(key) {
  const phases = state.insights?.phases || [];
  for (const phase of phases) {
    for (const feature of phase.features || []) {
      if (feature.key === key) {
        return feature;
      }
    }
  }
  return null;
}

function createCodeChip(item) {
  const button = document.createElement("button");
  button.className = "mini-chip";
  button.type = "button";
  button.textContent = item.title ? `${item.code} ${item.title}` : item.code;
  button.addEventListener("click", () => {
    if (item.code) {
      selectNode(item.code);
    }
  });
  return button;
}

function beginnerWorkNote(item) {
  if (item.review_excerpt) {
    return item.review_excerpt.split(". ").slice(0, 2).join(". ").trim();
  }
  return "This work is useful because it helps anchor the topic in a concrete book or paper that mathematicians treat as important.";
}

function renderTopicBanner() {
  refs.topicTitle.textContent = `${state.selectedNode.code} ${state.selectedNode.title}`;
  refs.topicSummary.textContent = state.selectedNode.description;

  clearChildren(refs.topicBadges);
  refs.topicBadges.append(
    createBadge(levelLabel(state.selectedNode.level)),
    createBadge(`${state.selectedNode.child_count} official children`, true),
  );

  clearChildren(refs.topicLineage);
  for (const item of state.selectedNode.lineage || []) {
    const button = document.createElement("button");
    button.className = "lineage-chip";
    button.type = "button";
    button.textContent = `${item.code} ${item.title}`;
    button.addEventListener("click", () => selectNode(item.code));
    refs.topicLineage.appendChild(button);
  }
}

function renderTopicBrief() {
  clearChildren(refs.learnBrief);

  if (!state.masteryGuide) {
    const empty = document.createElement("div");
    empty.className = "placeholder-block";
    empty.innerHTML = `
      <h4>No learning profile yet</h4>
      <p>Build the learning profile to load a plain-English explanation, intuition, why the topic matters, and concept progression.</p>
    `;
    refs.learnBrief.appendChild(empty);
    return;
  }

  const cards = [
    ["In plain English", state.masteryGuide.school_level_explanation],
    ["Intuition", state.masteryGuide.intuition],
    ["Why it matters", state.masteryGuide.why_it_matters],
    ["Real-world applications", (state.masteryGuide.real_world_applications || []).join(" ")],
    ["Formal view", state.masteryGuide.formal_view],
  ];

  const grid = document.createElement("div");
  grid.className = "two-col";
  for (const [label, value] of cards) {
    const card = document.createElement("article");
    card.className = "subpanel";
    card.innerHTML = `<h4>${label}</h4><p>${value}</p>`;
    grid.appendChild(card);
  }
  refs.learnBrief.appendChild(grid);
}

function buildBibliographySectionElement(section, compact = false) {
  const block = document.createElement("article");
  block.className = compact ? "mini-biblio-block" : "work-block";
  block.innerHTML = `<h4>${section.label}</h4><p class="microcopy">${section.description}</p>`;

  for (const entry of section.entries || []) {
    const row = document.createElement("div");
    row.className = compact ? "mini-biblio-entry" : "reading-entry";
    const links = (entry.source_links || [])
      .map((link) => `<a class="text-link" href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>`)
      .join(" ");
    row.innerHTML = `
      <div class="entry-head">
        <strong>${entry.title}</strong>
        <span class="confidence-pill ${entry.confidence}">${entry.confidence}</span>
      </div>
      <p>${(entry.authors || []).join(", ") || "Author information unavailable"}${entry.year ? ` (${entry.year})` : ""}</p>
      <p class="microcopy">${[entry.venue, entry.work_type, entry.doi].filter(Boolean).join(" · ")}</p>
      <p>${entry.rationale}</p>
      <div class="link-row">${entry.url ? `<a class="text-link" href="${entry.url}" target="_blank" rel="noreferrer">Visit work</a>` : ""} ${links}</div>
    `;
    block.appendChild(row);
  }

  return block;
}

function renderInlineBibliography(detail, bibliography) {
  detail.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "inline-biblio";
  shell.innerHTML = `
    <div class="section-head">
      <div>
        <h4>${bibliography.target_label}</h4>
        <p class="microcopy">${bibliography.overview}</p>
      </div>
      <span class="pill soft">${bibliography.model}</span>
    </div>
  `;

  for (const section of bibliography.sections || []) {
    shell.appendChild(buildBibliographySectionElement(section, false));
  }

  detail.appendChild(shell);
}

async function loadInlineBibliographyForConcept(concept, detail) {
  const target = buildConceptTarget(concept);
  const existing = state.inlineConceptBibliographies.get(target.target_id);
  if (existing) {
    renderInlineBibliography(detail, existing);
    return;
  }

  state.loadingConceptId = target.target_id;
  detail.innerHTML = '<div class="placeholder-inline">Loading concept-specific bibliography...</div>';

  try {
    const bibliography = await fetchJson("/api/bibliography", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...target,
        audience: refs.audienceSelect.value,
        focus: refs.focusInput.value.trim(),
        notes: refs.notesInput.value.trim(),
        max_entries: Number.parseInt(refs.maxEntriesInput.value, 10),
      }),
    });
    state.inlineConceptBibliographies.set(target.target_id, bibliography);
    renderInlineBibliography(detail, bibliography);
  } catch (error) {
    detail.innerHTML = `<div class="placeholder-inline error-inline">${error.message}</div>`;
  } finally {
    state.loadingConceptId = null;
  }
}

function renderConceptReadingList(items, ordered = false) {
  const list = document.createElement(ordered ? "ol" : "ul");
  list.className = `plain-list${ordered ? " numbered" : ""}`;
  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }
  return list;
}

function createConceptItem(concept, helperText = "") {
  const item = document.createElement("details");
  item.className = "concept-item";
  item.open = false;
  const title = concept?.name || concept;
  const explanation = concept?.explanation || "";
  const whyItMatters = concept?.why_it_matters || "";
  const example = concept?.example || "";
  const applications = concept?.modern_applications || [];
  const explanationPreview = explanation.split(". ").slice(0, 2).join(". ").trim();
  const applicationPreview = applications[0] || "";
  item.innerHTML = `
    <summary class="concept-item-head">
      <div>
        <h4>${title}</h4>
        <p>${explanationPreview || "Open this concept to see a beginner-friendly explanation."}</p>
        <p class="microcopy">${helperText || whyItMatters || "This concept matters because it unlocks later parts of the topic."}</p>
        ${applicationPreview ? `<p class="microcopy"><strong>Modern use:</strong> ${applicationPreview}</p>` : ""}
      </div>
      <div class="term-actions">
        <button class="secondary-button concept-biblio" type="button">Open bibliography</button>
        <button class="ghost-button concept-focus" type="button">Use as mastery focus</button>
      </div>
    </summary>
  `;

  const detail = document.createElement("div");
  detail.className = "concept-item-detail";

  const body = document.createElement("div");
  body.className = "concept-item-body";

  const explanationBlock = document.createElement("div");
  explanationBlock.className = "concept-copy";
  explanationBlock.innerHTML = `
    <p><strong>What this concept means.</strong> ${explanation}</p>
    <p><strong>Why it matters here.</strong> ${whyItMatters}</p>
    <p><strong>Example.</strong> ${example}</p>
  `;
  body.appendChild(explanationBlock);

  const grid = document.createElement("div");
  grid.className = "concept-support-grid";

  const applicationsPanel = document.createElement("article");
  applicationsPanel.className = "subpanel";
  applicationsPanel.innerHTML = "<h5>Modern-world or downstream uses</h5>";
  applicationsPanel.appendChild(renderConceptReadingList(applications));
  grid.appendChild(applicationsPanel);

  const readingGuide = document.createElement("article");
  readingGuide.className = "subpanel";
  readingGuide.innerHTML = "<h5>Reading order</h5>";
  readingGuide.appendChild(renderConceptReadingList(concept?.reading_order || [], true));
  grid.appendChild(readingGuide);

  const starterReads = document.createElement("article");
  starterReads.className = "subpanel";
  starterReads.innerHTML = "<h5>Start by reading</h5>";
  starterReads.appendChild(renderConceptReadingList(concept?.starter_readings || []));
  grid.appendChild(starterReads);

  const nextReads = document.createElement("article");
  nextReads.className = "subpanel";
  nextReads.innerHTML = "<h5>Then move to</h5>";
  nextReads.appendChild(renderConceptReadingList(concept?.next_readings || []));
  grid.appendChild(nextReads);

  body.appendChild(grid);
  const bibliographySlot = document.createElement("div");
  bibliographySlot.className = "concept-bibliography-slot";
  detail.append(body, bibliographySlot);

  item.querySelector(".concept-biblio").addEventListener("click", async (event) => {
    event.preventDefault();
    item.open = true;
    await loadInlineBibliographyForConcept(concept, bibliographySlot);
  });
  item.querySelector(".concept-focus").addEventListener("click", async (event) => {
    event.preventDefault();
    refs.masteryFocusInput.value = title;
    setTab("master");
    await loadMasteryGuide();
  });

  item.appendChild(detail);
  return item;
}

function renderConceptLadder() {
  clearChildren(refs.conceptLadder);

  if (!state.conceptMap) {
    const empty = document.createElement("div");
    empty.className = "placeholder-block";
    empty.innerHTML = `
      <h4>No concept ladder yet</h4>
      <p>Build the learning profile to get prerequisites, beginner concepts, intermediate concepts, advanced concepts, and milestone capabilities.</p>
    `;
    refs.conceptLadder.appendChild(empty);
    return;
  }

  const sections = [
    ["Prerequisites", state.conceptMap.prerequisites, "Learn these first to make the topic readable."],
    ["Beginner concepts", state.conceptMap.beginner_concepts, "Start here if the topic is new."],
    ["Intermediate concepts", state.conceptMap.intermediate_concepts, "These deepen the topic after the first layer."],
    ["Advanced concepts", state.conceptMap.advanced_concepts, "These are the more technical ideas that show up later."],
    ["Milestone capabilities", state.conceptMap.milestone_capabilities, "These are the things you should be able to do once the topic starts to click."],
  ];

  for (const [title, items, helperText] of sections) {
    const card = document.createElement("article");
    card.className = "section-card nested";
    card.innerHTML = `<h3>${title}</h3><p class="microcopy">${helperText}</p>`;
    if (!(items || []).length) {
      card.innerHTML += '<p class="microcopy">No items returned for this layer.</p>';
    } else {
      for (const concept of items) {
        card.appendChild(createConceptItem(concept));
      }
    }
    refs.conceptLadder.appendChild(card);
  }
}

function renderRepresentativeWorks() {
  clearChildren(refs.representativeWorks);

  const feature = getPhaseFeature("representative_papers");
  if (!feature || !(feature.items || []).length) {
    refs.representativeWorks.innerHTML = '<div class="placeholder-block"><p>No representative works were surfaced from the current zbMATH sample.</p></div>';
    return;
  }

  for (const item of feature.items) {
    const card = document.createElement("article");
    card.className = "work-card";
    const links = (item.links || [])
      .map((link) => `<a class="text-link" href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>`)
      .join(" ");
    const keywords = (item.keywords || []).map((keyword) => `<span class="mini-chip static">${keyword}</span>`).join("");

    card.innerHTML = `
      <div class="section-head">
        <div>
          <h3>${item.title}</h3>
          <p>${(item.authors || []).join(", ") || "Author information unavailable"}${item.year ? ` (${item.year})` : ""}</p>
          <p class="microcopy">${item.source || "Source unavailable"}</p>
        </div>
        <span class="pill soft">Seminal shelf</span>
      </div>
      <p>${beginnerWorkNote(item)}</p>
      ${keywords ? `<div class="chip-row">${keywords}</div>` : ""}
      <div class="link-row">${links}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "term-actions";
    const focusButton = document.createElement("button");
    focusButton.className = "secondary-button";
    focusButton.type = "button";
    focusButton.textContent = "Use title as focus";
    focusButton.addEventListener("click", () => {
      refs.focusInput.value = item.title;
      refs.notesInput.value = `Anchor the reading list around this zbMATH work: ${item.title}`;
    });
    actions.appendChild(focusButton);
    card.appendChild(actions);
    refs.representativeWorks.appendChild(card);
  }
}

function renderBibliography() {
  clearChildren(refs.bibliographyOutput);
  if (!state.bibliography) {
    return;
  }

  const shell = document.createElement("section");
  shell.className = "section-card nested";
  shell.innerHTML = `
    <div class="section-head">
      <div>
        <h3>${state.bibliography.target_label}</h3>
        <p class="microcopy">${state.bibliography.overview}</p>
      </div>
      <span class="pill soft">${state.bibliography.model}</span>
    </div>
  `;

  const meta = document.createElement("div");
  meta.className = "two-col";
  const guidance = document.createElement("article");
  guidance.className = "subpanel";
  guidance.innerHTML = "<h4>Search guidance</h4>";
  const guidanceList = document.createElement("ul");
  guidanceList.className = "plain-list";
  for (const item of state.bibliography.search_guidance || []) {
    const li = document.createElement("li");
    li.textContent = item;
    guidanceList.appendChild(li);
  }
  guidance.appendChild(guidanceList);

  const caveats = document.createElement("article");
  caveats.className = "subpanel";
  caveats.innerHTML = "<h4>Caveats</h4>";
  const caveatList = document.createElement("ul");
  caveatList.className = "plain-list";
  for (const item of state.bibliography.caveats || []) {
    const li = document.createElement("li");
    li.textContent = item;
    caveatList.appendChild(li);
  }
  caveats.appendChild(caveatList);
  meta.append(guidance, caveats);
  shell.appendChild(meta);

  for (const section of state.bibliography.sections || []) {
    shell.appendChild(buildBibliographySectionElement(section, false));
  }

  refs.bibliographyOutput.appendChild(shell);
}

function renderFingerprintPanel() {
  clearChildren(refs.fingerprintPanel);
  const fingerprint = getPhaseFeature("topic_fingerprint");
  const literaturePanel = getPhaseFeature("literature_panel");
  const beginnerSplit = getPhaseFeature("beginner_vs_research_split");
  const keywordClusters = getPhaseFeature("keyword_clusters");

  if (!fingerprint) {
    refs.fingerprintPanel.innerHTML = '<div class="placeholder-block"><p>zbMATH literature fingerprint is not available for this node.</p></div>';
    return;
  }

  const features = [fingerprint, literaturePanel, beginnerSplit, keywordClusters].filter(Boolean);
  for (const feature of features) {
    const block = document.createElement("article");
    block.className = "section-card nested";
    block.innerHTML = `<h3>${feature.label}</h3><p class="microcopy">${feature.description}</p>`;

    if (feature.facts) {
      const facts = feature.facts;
      const row = document.createElement("div");
      row.className = "chip-row";
      row.append(
        createInfoPill("Sample", facts.sample_size || 0),
        createInfoPill("Year span", facts.year_span || "Unknown"),
      );
      block.appendChild(row);

      const groups = [
        ["Document types", facts.top_document_types || []],
        ["Top keywords", facts.top_keywords || []],
        ["Top journals", facts.top_journals || []],
        ["Top authors", facts.top_authors || []],
      ];

      const grid = document.createElement("div");
      grid.className = "two-col";
      for (const [label, items] of groups) {
        const sub = document.createElement("div");
        sub.className = "subpanel";
        sub.innerHTML = `<h4>${label}</h4>`;
        const chips = document.createElement("div");
        chips.className = "chip-row";
        for (const item of items) {
          const chip = document.createElement("span");
          chip.className = "mini-chip static";
          chip.textContent = `${item.label} (${item.count})`;
          chips.appendChild(chip);
        }
        sub.appendChild(chips);
        grid.appendChild(sub);
      }
      block.appendChild(grid);
    } else {
      const grid = document.createElement("div");
      grid.className = "two-col";
      for (const group of feature.groups || []) {
        const sub = document.createElement("div");
        sub.className = "subpanel";
        sub.innerHTML = `<h4>${group.label}</h4>`;
        const chips = document.createElement("div");
        chips.className = "chip-row";
        for (const item of group.items || []) {
          const chip = document.createElement("span");
          chip.className = "mini-chip static";
          chip.textContent = item.count ? `${item.label} (${item.count})` : item.label;
          chips.appendChild(chip);
        }
        sub.appendChild(chips);
        grid.appendChild(sub);
      }
      block.appendChild(grid);
    }

    refs.fingerprintPanel.appendChild(block);
  }
}

function renderKeywordBridges() {
  clearChildren(refs.exploreKeywords);
  const feature = getPhaseFeature("keyword_to_concept_bridge") || getPhaseFeature("real_keyword_extraction");
  if (!feature) {
    refs.exploreKeywords.innerHTML = '<div class="placeholder-block"><p>No keyword bridges were available for this node.</p></div>';
    return;
  }

  for (const item of feature.items || []) {
    const card = document.createElement("article");
    card.className = "bridge-card";
    card.innerHTML = `
      <div class="section-head">
        <div>
          <h3>${item.label}</h3>
          <p class="microcopy">${item.note || `Seen in ${item.count} sampled records.`}</p>
        </div>
        <span class="pill soft">${item.count} records</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "term-actions";
    const bibliographyButton = document.createElement("button");
    bibliographyButton.className = "primary-button";
    bibliographyButton.type = "button";
    bibliographyButton.textContent = "Concept bibliography";
    bibliographyButton.addEventListener("click", async () => {
      setActiveTarget(buildConceptTarget(item.label));
      refs.focusInput.value = item.label;
      setTab("read");
      await loadBibliographyForActiveTarget();
    });
    actions.appendChild(bibliographyButton);

    const masteryButton = document.createElement("button");
    masteryButton.className = "secondary-button";
    masteryButton.type = "button";
    masteryButton.textContent = "Mastery focus";
    masteryButton.addEventListener("click", async () => {
      refs.masteryFocusInput.value = item.label;
      setTab("master");
      await loadMasteryGuide();
    });
    actions.appendChild(masteryButton);

    if (item.source_url) {
      const sourceLink = document.createElement("a");
      sourceLink.className = "text-link";
      sourceLink.href = item.source_url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noreferrer";
      sourceLink.textContent = "Open zbMATH search";
      actions.appendChild(sourceLink);
    }
    card.appendChild(actions);

    if ((item.related_codes || []).length) {
      const related = document.createElement("div");
      related.className = "chip-row";
      for (const codeItem of item.related_codes) {
        related.appendChild(createCodeChip(codeItem));
      }
      card.appendChild(related);
    }

    refs.exploreKeywords.appendChild(card);
  }
}

function renderRelatedTopics() {
  clearChildren(refs.relatedTopics);
  const related = getPhaseFeature("related_topic_discovery");
  if (!related) {
    refs.relatedTopics.innerHTML = '<div class="placeholder-block"><p>No related MSC areas were surfaced from the current literature sample.</p></div>';
    return;
  }

  for (const group of related.groups || []) {
    const block = document.createElement("article");
    block.className = "section-card nested";
    block.innerHTML = `<h3>${group.label}</h3><p class="microcopy">These areas co-occur with the current node inside sampled zbMATH records.</p>`;
    const chips = document.createElement("div");
    chips.className = "chip-row";
    for (const item of group.items || []) {
      const wrapper = document.createElement("div");
      wrapper.className = "stack-chip";
      wrapper.appendChild(createCodeChip(item));
      const meta = document.createElement("span");
      meta.className = "microcopy";
      meta.textContent = `${item.count} co-occurrences`;
      wrapper.appendChild(meta);
      chips.appendChild(wrapper);
    }
    block.appendChild(chips);
    refs.relatedTopics.appendChild(block);
  }
}

function renderReadingPath() {
  clearChildren(refs.readingPath);
  const readingPathFeature = getPhaseFeature("reading_path_builder");
  const sequence = state.masteryGuide?.study_sequence || [];

  if (readingPathFeature && (readingPathFeature.items || []).length) {
    const block = document.createElement("article");
    block.className = "section-card nested";
    block.innerHTML = "<h3>zbMATH-informed reading path</h3>";
    for (const item of readingPathFeature.items) {
      const step = document.createElement("div");
      step.className = "path-step";
      step.innerHTML = `
        <div class="path-index">${item.step}</div>
        <div>
          <h4>${item.title}</h4>
          <p>${item.summary}</p>
        </div>
      `;
      const chips = document.createElement("div");
      chips.className = "chip-row";
      for (const keyword of item.keywords || []) {
        const chip = document.createElement("span");
        chip.className = "mini-chip static";
        chip.textContent = keyword;
        chips.appendChild(chip);
      }
      step.appendChild(chips);
      block.appendChild(step);
    }
    refs.readingPath.appendChild(block);
  }

  if (sequence.length) {
    const block = document.createElement("article");
    block.className = "section-card nested";
    block.innerHTML = "<h3>Mastery sequence</h3>";
    const list = document.createElement("ol");
    list.className = "plain-list numbered";
    for (const item of sequence) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    block.appendChild(list);
    refs.readingPath.appendChild(block);
  }
}

function renderMasteryGuide() {
  clearChildren(refs.masteryOutput);
  clearChildren(refs.readingPath);
  clearChildren(refs.checkpointPanel);

  if (!state.masteryGuide) {
    refs.masteryOutput.innerHTML = '<div class="placeholder-block"><p>No mastery guide yet. Build the learning profile or refresh the mastery guide.</p></div>';
    return;
  }

  const intro = document.createElement("article");
  intro.className = "section-card nested";
  intro.innerHTML = `
    <h3>${state.masteryGuide.target_label}</h3>
    <p>${state.masteryGuide.overview}</p>
  `;

  const topGrid = document.createElement("div");
  topGrid.className = "two-col";
  const textBlocks = [
    ["School-level explanation", state.masteryGuide.school_level_explanation],
    ["Intuition", state.masteryGuide.intuition],
    ["Formal view", state.masteryGuide.formal_view],
    ["Why it matters", state.masteryGuide.why_it_matters],
  ];
  for (const [label, value] of textBlocks) {
    const block = document.createElement("div");
    block.className = "subpanel";
    block.innerHTML = `<h4>${label}</h4><p>${value}</p>`;
    topGrid.appendChild(block);
  }
  intro.appendChild(topGrid);

  if ((state.masteryGuide.real_world_applications || []).length) {
    const appBlock = document.createElement("div");
    appBlock.className = "subpanel";
    appBlock.innerHTML = "<h4>Real-world applications and uses</h4>";
    const list = document.createElement("ul");
    list.className = "plain-list";
    for (const item of state.masteryGuide.real_world_applications) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    appBlock.appendChild(list);
    intro.appendChild(appBlock);
  }

  refs.masteryOutput.appendChild(intro);

  if ((state.masteryGuide.key_ideas || []).length) {
    const ideas = document.createElement("article");
    ideas.className = "section-card nested";
    ideas.innerHTML = "<h3>Key ideas</h3>";
    for (const item of state.masteryGuide.key_ideas) {
      const card = document.createElement("div");
      card.className = "subpanel";
      card.innerHTML = `
        <h4>${item.name}</h4>
        <p>${item.explanation}</p>
        <p class="microcopy">Example: ${item.example}</p>
      `;
      ideas.appendChild(card);
    }
    refs.masteryOutput.appendChild(ideas);
  }

  if ((state.masteryGuide.worked_examples || []).length) {
    const example = state.masteryGuide.worked_examples[0];
    const block = document.createElement("article");
    block.className = "section-card nested";
    block.innerHTML = `
      <h3>${example.title}</h3>
      <p class="microcopy">${example.level}</p>
      <p><strong>Problem:</strong> ${example.problem}</p>
    `;
    const list = document.createElement("ol");
    list.className = "plain-list numbered";
    for (const step of example.walkthrough || []) {
      const li = document.createElement("li");
      li.textContent = step;
      list.appendChild(li);
    }
    block.appendChild(list);
    const takeaway = document.createElement("p");
    takeaway.innerHTML = `<strong>Takeaway:</strong> ${example.takeaway}`;
    block.appendChild(takeaway);
    refs.masteryOutput.appendChild(block);
  }

  const checkpoints = document.createElement("article");
  checkpoints.className = "section-card nested";
  checkpoints.innerHTML = "<h3>Checkpoints and pitfalls</h3>";
  const checkpointGrid = document.createElement("div");
  checkpointGrid.className = "two-col";
  const lists = [
    ["Prerequisites", state.masteryGuide.prerequisites],
    ["Common misconceptions", state.masteryGuide.common_misconceptions],
    ["Mastery checkpoints", state.masteryGuide.mastery_checkpoints],
    ["Practice prompts", state.masteryGuide.practice_prompts],
    ["Next topics", state.masteryGuide.next_topics],
    ["Caution notes", state.masteryGuide.caution_notes],
  ];
  for (const [label, items] of lists) {
    const sub = document.createElement("div");
    sub.className = "subpanel";
    sub.innerHTML = `<h4>${label}</h4>`;
    const list = document.createElement("ul");
    list.className = "plain-list";
    for (const item of items || []) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    sub.appendChild(list);
    checkpointGrid.appendChild(sub);
  }
  checkpoints.appendChild(checkpointGrid);
  refs.checkpointPanel.appendChild(checkpoints);

  renderReadingPath();
}

function renderExplore() {
  renderFingerprintPanel();
  renderKeywordBridges();
  renderRelatedTopics();
}

function renderStudio() {
  const hasNode = Boolean(state.selectedNode);
  refs.emptyState.hidden = hasNode;
  refs.studioShell.hidden = !hasNode;
  if (!hasNode) {
    return;
  }

  renderTopicBanner();
  renderTopicBrief();
  renderConceptLadder();
  renderRepresentativeWorks();
  renderBibliography();
  renderExplore();
  renderMasteryGuide();
  updateActiveTargetLabel();
}

async function loadHealth() {
  const payload = await fetchJson("/api/health");
  refs.apiStatus.textContent = payload.apiKeyConfigured
    ? `Ready · ${payload.model}`
    : "Reachable · no OpenAI key configured";
  refs.sectionCount.textContent = payload.levelCounts.section;
  refs.branchCount.textContent = payload.levelCounts.branch;
  refs.leafCount.textContent = payload.levelCounts.leaf + payload.levelCounts.auxiliary;
}

async function loadRoots() {
  const payload = await fetchJson("/api/root");
  state.roots = payload.items;
  renderTree();
  if (state.roots[0]) {
    await selectNode(state.roots[0].code);
  }
}

async function loadChildren(code) {
  const payload = await fetchJson(`/api/children?code=${encodeURIComponent(code)}`);
  state.treeChildren.set(code, payload.items);
  renderTree();
  renderStudio();
  return payload.items;
}

async function runSearch(query) {
  const payload = await fetchJson(`/api/search?q=${encodeURIComponent(query)}&limit=18`);
  renderSearchResults(payload.items, payload.total);
}

async function loadInsights() {
  if (!state.selectedNode) {
    return;
  }
  refs.readStatus.textContent = "Loading literature evidence from zbMATH...";
  try {
    state.insights = await fetchJson(`/api/vocabulary?code=${encodeURIComponent(state.selectedNode.code)}`);
    refs.readStatus.textContent = `Loaded ${state.insights.official_api.sampled_documents} sampled zbMATH records for this node.`;
  } catch (error) {
    refs.readStatus.textContent = error.message;
  }
  renderStudio();
}

async function selectNode(code) {
  state.selectedNode = await fetchJson(`/api/node?code=${encodeURIComponent(code)}`);
  state.insights = null;
  state.bibliography = null;
  state.conceptMap = null;
  state.masteryGuide = null;
  state.inlineConceptBibliographies = new Map();
  state.loadingConceptId = null;
  setActiveTarget(buildNodeTarget());
  refs.learnStatus.textContent = "Generate a learning profile to load explanations and concept progression.";
  refs.learnError.textContent = "";
  refs.masterStatus.textContent = "Generate a mastery guide to load explanations, examples, and checkpoints.";
  refs.masteryError.textContent = "";
  refs.bibliographyError.textContent = "";
  renderTree();
  renderStudio();
  if (state.selectedNode.child_count > 0 && !state.treeChildren.has(state.selectedNode.code)) {
    await loadChildren(state.selectedNode.code);
  }
  await loadInsights();
}

async function loadConceptMap() {
  if (!state.activeTarget) {
    return;
  }
  refs.learnStatus.textContent = "Building concept ladder...";
  refs.learnError.textContent = "";

  try {
    state.conceptMap = await fetchJson("/api/concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state.activeTarget,
        audience: refs.masteryAudienceSelect.value || "school",
        focus: refs.masteryFocusInput.value.trim(),
      }),
    });
    refs.learnStatus.textContent = state.conceptMap.overview;
  } catch (error) {
    refs.learnError.textContent = error.message;
  }
  renderStudio();
}

async function loadMasteryGuide() {
  const target = buildNodeTarget();
  if (!target) {
    return;
  }

  setActiveTarget(target);
  refs.masterStatus.textContent = "Building mastery guide...";
  refs.masteryError.textContent = "";

  try {
    state.masteryGuide = await fetchJson("/api/mastery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...target,
        audience: refs.masteryAudienceSelect.value,
        focus: refs.masteryFocusInput.value.trim(),
      }),
    });
    refs.masterStatus.textContent = state.masteryGuide.overview;
  } catch (error) {
    refs.masteryError.textContent = error.message;
  }
  renderStudio();
}

async function buildLearningProfile() {
  setTab("learn");
  await Promise.all([loadConceptMap(), loadMasteryGuide()]);
}

async function loadBibliographyForActiveTarget() {
  if (!state.activeTarget) {
    return;
  }

  refs.bibliographyError.textContent = "";
  refs.bibliographyOutput.innerHTML = '<div class="placeholder-block"><p>Building grounded bibliography...</p></div>';

  try {
    state.bibliography = await fetchJson("/api/bibliography", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state.activeTarget,
        audience: refs.audienceSelect.value,
        focus: refs.focusInput.value.trim(),
        notes: refs.notesInput.value.trim(),
        max_entries: Number.parseInt(refs.maxEntriesInput.value, 10),
      }),
    });
    renderBibliography();
  } catch (error) {
    refs.bibliographyError.textContent = error.message;
    clearChildren(refs.bibliographyOutput);
  }
}

async function handleBibliographySubmit(event) {
  event.preventDefault();
  await loadBibliographyForActiveTarget();
}

function bindEvents() {
  refs.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  refs.searchInput.addEventListener("input", (event) => runSearch(event.target.value));
  refs.maxEntriesInput.addEventListener("input", () => {
    refs.maxEntriesLabel.textContent = `${refs.maxEntriesInput.value} references`;
  });

  refs.buildLearningButton.addEventListener("click", buildLearningProfile);
  refs.refreshLearningButton.addEventListener("click", buildLearningProfile);
  refs.refreshMasteryButton.addEventListener("click", async () => {
    setTab("master");
    await loadMasteryGuide();
  });
  refs.generateBibliographyButton.addEventListener("click", async () => {
    setActiveTarget(buildNodeTarget());
    setTab("read");
    await loadBibliographyForActiveTarget();
  });
  refs.bibliographyForm.addEventListener("submit", handleBibliographySubmit);
}

async function bootstrap() {
  bindEvents();
  setTab("learn");
  try {
    await loadHealth();
    await loadRoots();
    await runSearch("");
  } catch (error) {
    refs.apiStatus.textContent = error.message;
  }
}

bootstrap();
