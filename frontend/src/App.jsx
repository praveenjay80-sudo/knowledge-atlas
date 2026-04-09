import { useDeferredValue, useEffect, useState } from "react";
import { fetchJson } from "./lib/api";

const bibliographyDefaults = {
  audience: "graduate",
  focus: "",
  notes: "",
  max_entries: 10,
};

const conceptDefaults = {
  audience: "graduate",
  focus: "",
};

const tabs = [
  { key: "overview", label: "Atlas view" },
  { key: "vocabulary", label: "Authority links" },
  { key: "bibliography", label: "Bibliography studio" },
  { key: "learning", label: "Concept studio" },
];

function levelLabel(level) {
  switch (level) {
    case "section":
      return "Section";
    case "branch":
      return "Branch";
    case "leaf":
      return "Leaf";
    case "auxiliary":
      return "Auxiliary code";
    default:
      return "MSC node";
  }
}

function schemeLabel(scheme) {
  switch (scheme) {
    case "msc":
      return "MSC";
    case "lcsh":
      return "LCSH";
    case "gnd":
      return "GND";
    default:
      return scheme;
  }
}

function confidenceLabel(value) {
  if (!value) {
    return "Medium confidence";
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} confidence`;
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function tokenCount(total = 0) {
  return new Intl.NumberFormat().format(total);
}

function targetSummary(target) {
  if (!target) {
    return "No active target selected yet.";
  }
  return `${schemeLabel(target.target_scheme)} topic: ${target.target_label}`;
}

function TreeNode({
  node,
  selectedCode,
  expanded,
  childrenMap,
  loadingMap,
  onSelect,
  onToggle,
  depth = 0,
}) {
  const hasChildren = node.child_count > 0;
  const isExpanded = Boolean(expanded[node.code]);
  const isLoading = Boolean(loadingMap[node.code]);
  const children = childrenMap[node.code] || [];

  return (
    <div className="tree-node" style={{ "--tree-depth": depth }}>
      <div className={`tree-row${selectedCode === node.code ? " selected" : ""}`}>
        <button className="tree-select" type="button" onClick={() => onSelect(node.code)}>
          <span className="tree-code">{node.code}</span>
          <span className="tree-copy">
            <strong>{node.title}</strong>
            <small>
              {levelLabel(node.level)}
              {node.child_count ? ` - ${node.child_count} children` : ""}
            </small>
          </span>
        </button>
        {hasChildren ? (
          <button className="tree-toggle" type="button" onClick={() => onToggle(node)}>
            {isLoading ? "..." : isExpanded ? "-" : "+"}
          </button>
        ) : null}
      </div>
      {isExpanded && children.length > 0 ? (
        <div className="tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.code}
              node={child}
              selectedCode={selectedCode}
              expanded={expanded}
              childrenMap={childrenMap}
              loadingMap={loadingMap}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [roots, setRoots] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [childrenMap, setChildrenMap] = useState({});
  const [loadingChildren, setLoadingChildren] = useState({});
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ items: [], total: 0 });
  const [searchError, setSearchError] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectionError, setSelectionError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [vocabulary, setVocabulary] = useState(null);
  const [vocabularyError, setVocabularyError] = useState("");
  const [isVocabularyLoading, setIsVocabularyLoading] = useState(false);
  const [activeTarget, setActiveTarget] = useState(null);
  const [bibliographyRequest, setBibliographyRequest] = useState(bibliographyDefaults);
  const [conceptRequest, setConceptRequest] = useState(conceptDefaults);
  const [bibliography, setBibliography] = useState(null);
  const [bibliographyError, setBibliographyError] = useState("");
  const [isBibliographyLoading, setIsBibliographyLoading] = useState(false);
  const [conceptTree, setConceptTree] = useState(null);
  const [conceptError, setConceptError] = useState("");
  const [isConceptLoading, setIsConceptLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      try {
        const [healthPayload, rootPayload] = await Promise.all([
          fetchJson("/health"),
          fetchJson("/catalog/root"),
        ]);
        if (!active) {
          return;
        }
        setHealth(healthPayload);
        setRoots(rootPayload);
        if (rootPayload[0]) {
          await selectNode(rootPayload[0].code, { keepOutputs: true });
        }
      } catch (error) {
        if (active) {
          setSelectionError(error.message);
        }
      }
    }

    loadBootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSearch() {
      try {
        const payload = await fetchJson(
          `/catalog?q=${encodeURIComponent(deferredQuery)}&limit=18`
        );
        if (!active) {
          return;
        }
        setSearchResults(payload);
        setSearchError("");
      } catch (error) {
        if (active) {
          setSearchResults({ items: [], total: 0 });
          setSearchError(error.message);
        }
      }
    }

    loadSearch();
    return () => {
      active = false;
    };
  }, [deferredQuery]);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    let active = true;
    setIsVocabularyLoading(true);
    setVocabularyError("");

    fetchJson(`/controlled-vocabulary/${encodeURIComponent(selectedNode.code)}`)
      .then((payload) => {
        if (active) {
          setVocabulary(payload);
        }
      })
      .catch((error) => {
        if (active) {
          setVocabulary(null);
          setVocabularyError(error.message);
        }
      })
      .finally(() => {
        if (active) {
          setIsVocabularyLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedNode?.code]);

  async function selectNode(code, options = {}) {
    try {
      const payload = await fetchJson(`/catalog/${encodeURIComponent(code)}`);
      setSelectedNode(payload);
      setSelectionError("");
      setActiveTarget({
        target_scheme: "msc",
        target_id: payload.code,
        target_label: payload.title,
        description: payload.description,
      });
      if (!options.keepOutputs) {
        setBibliography(null);
        setConceptTree(null);
      }
      if (payload.child_count > 0 && !childrenMap[payload.code]) {
        loadChildren(payload.code);
      }
    } catch (error) {
      setSelectionError(error.message);
    }
  }

  async function loadChildren(code) {
    setLoadingChildren((current) => ({ ...current, [code]: true }));
    try {
      const payload = await fetchJson(`/catalog/${encodeURIComponent(code)}/children`);
      setChildrenMap((current) => ({ ...current, [code]: payload.children }));
    } catch (error) {
      setSelectionError(error.message);
    } finally {
      setLoadingChildren((current) => ({ ...current, [code]: false }));
    }
  }

  async function handleToggle(node) {
    if (expanded[node.code]) {
      setExpanded((current) => ({ ...current, [node.code]: false }));
      return;
    }

    if (!childrenMap[node.code]) {
      await loadChildren(node.code);
    }
    setExpanded((current) => ({ ...current, [node.code]: true }));
  }

  function activateVocabularyTerm(term) {
    setActiveTarget({
      target_scheme: term.scheme,
      target_id: term.identifier || term.label,
      target_label: term.label,
      description: term.note || selectedNode?.description || "",
    });
    setBibliography(null);
    setConceptTree(null);
    setActiveTab("bibliography");
  }

  async function generateBibliography(event) {
    event.preventDefault();
    if (!activeTarget) {
      return;
    }

    setIsBibliographyLoading(true);
    setBibliographyError("");

    try {
      const payload = await fetchJson("/bibliographies/generate", {
        method: "POST",
        body: JSON.stringify({
          ...activeTarget,
          audience: bibliographyRequest.audience,
          focus: bibliographyRequest.focus,
          notes: bibliographyRequest.notes,
          max_entries: Number(bibliographyRequest.max_entries),
        }),
      });
      setBibliography(payload);
      setActiveTab("bibliography");
    } catch (error) {
      setBibliography(null);
      setBibliographyError(error.message);
    } finally {
      setIsBibliographyLoading(false);
    }
  }

  async function generateConceptTree() {
    if (!activeTarget) {
      return;
    }

    setIsConceptLoading(true);
    setConceptError("");

    try {
      const payload = await fetchJson("/concepts/generate", {
        method: "POST",
        body: JSON.stringify({
          ...activeTarget,
          audience: conceptRequest.audience,
          focus: conceptRequest.focus,
        }),
      });
      setConceptTree(payload);
      setActiveTab("learning");
    } catch (error) {
      setConceptTree(null);
      setConceptError(error.message);
    } finally {
      setIsConceptLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero-stage">
        <div className="hero-band">
          <p className="eyebrow">Atlas of Inquiry</p>
          <h1>A more atmospheric front end for navigating the MSC, its authority links, and its reading trails.</h1>
          <p className="lead">
            The visual system now leans editorial instead of dashboard-heavy: one place to browse
            the formal structure, pivot into library vocabularies, and spin up grounded reading
            lists or concept maps from the topic in front of you.
          </p>
          <div className="hero-ribbon">
            <span className="ribbon-chip">Canonical spine: MSC 2020</span>
            <span className="ribbon-chip">Authority overlays: LCSH + GND</span>
            <span className="ribbon-chip">Studios: bibliography + concept map</span>
          </div>
        </div>

        <div className="hero-stack">
          <article className="hero-note">
            <span>Sections</span>
            <strong>{tokenCount(health?.levelCounts?.section)}</strong>
            <p>Top-level corridors in the official classification.</p>
          </article>
          <article className="hero-note">
            <span>Branches</span>
            <strong>{tokenCount(health?.levelCounts?.branch)}</strong>
            <p>Mid-level paths for orienting the atlas before drilling down.</p>
          </article>
          <article className="hero-note">
            <span>Leaves + auxiliary</span>
            <strong>
              {tokenCount(
                (health?.levelCounts?.leaf || 0) + (health?.levelCounts?.auxiliary || 0)
              )}
            </strong>
            <p>Detailed topic nodes and supporting reference codes.</p>
          </article>
          <article className="hero-note">
            <span>Generation mode</span>
            <strong>
              {health?.groundedBibliographyModelConfigured
                ? `${health.model} ready`
                : "Grounded only"}
            </strong>
            <p>Bibliographies remain grounded in source metadata even without a model key.</p>
          </article>
        </div>
      </header>

      <main className="atlas-layout">
        <aside className="panel explorer-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Explorer</p>
              <h2>Topic finder</h2>
            </div>
            <p className="panel-note">Search the catalog or travel down the tree.</p>
          </div>

          <label className="field">
            <span>Search by code or theme</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try topology, 11A, proof theory, or harmonic analysis"
            />
          </label>

          {searchError ? <p className="error-text">{searchError}</p> : null}

          <div className="search-summary">
            <span>{searchResults.total} matches</span>
            <span>{selectedNode ? `Focused on ${selectedNode.code}` : "Choose a node to begin"}</span>
          </div>

          <div className="search-results">
            {searchResults.items.slice(0, 8).map((item) => (
              <button
                className="search-chip"
                key={item.code}
                type="button"
                onClick={() => selectNode(item.code)}
              >
                <strong>{item.code}</strong>
                <span>{item.title}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-spotlight">
            <p className="eyebrow">Live target</p>
            <h3>{selectedNode ? `${selectedNode.code} ${selectedNode.title}` : "Waiting for selection"}</h3>
            <p>{targetSummary(activeTarget)}</p>
          </div>

          <div className="tree-shell">
            {roots.map((node) => (
              <TreeNode
                key={node.code}
                node={node}
                selectedCode={selectedNode?.code}
                expanded={expanded}
                childrenMap={childrenMap}
                loadingMap={loadingChildren}
                onSelect={selectNode}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </aside>

        <section className="content-column">
          {selectedNode ? (
            <>
              <section className="panel focus-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Focused Node</p>
                    <h2>
                      {selectedNode.code} {selectedNode.title}
                    </h2>
                  </div>
                  <div className="badge-stack">
                    <span className="code-badge">{levelLabel(selectedNode.level)}</span>
                    <span className="soft-badge">{selectedNode.child_count} children</span>
                  </div>
                </div>

                <div className="focus-grid">
                  <article className="summary-card">
                    <p>{selectedNode.description}</p>
                    <div className="lineage-trail">
                      {selectedNode.lineage.map((item) => (
                        <button
                          className="lineage-chip"
                          key={item.code}
                          type="button"
                          onClick={() => selectNode(item.code)}
                        >
                          {item.code} {item.title}
                        </button>
                      ))}
                    </div>
                    <div className="action-row">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() =>
                          setActiveTarget({
                            target_scheme: "msc",
                            target_id: selectedNode.code,
                            target_label: selectedNode.title,
                            description: selectedNode.description,
                          })
                        }
                      >
                        Use node as active topic
                      </button>
                      <button className="secondary-button" type="button" onClick={generateConceptTree}>
                        {isConceptLoading ? "Generating..." : "Generate concept map"}
                      </button>
                    </div>
                  </article>

                  <article className="focus-note">
                    <p className="eyebrow">Atlas status</p>
                    <h3>{targetSummary(activeTarget)}</h3>
                    <p>
                      Keep the official MSC node as the anchor, or switch to a linked authority
                      heading before generating reading lists and concept progressions.
                    </p>
                    <div className="focus-mini-grid">
                      <div className="mini-stat">
                        <span>Hierarchy depth</span>
                        <strong>{selectedNode.lineage.length}</strong>
                      </div>
                      <div className="mini-stat">
                        <span>Direct children</span>
                        <strong>{selectedNode.child_count}</strong>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              <div className="tab-row">
                {tabs.map((tab) => (
                  <button
                    className={`tab-button${activeTab === tab.key ? " active" : ""}`}
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" ? (
                <div className="tab-shell">
                  <section className="panel tab-panel">
                    <div className="section-header">
                      <div>
                        <h3>Immediate branches</h3>
                        <p className="muted-copy">
                          Use these as the next move outward or inward from the current focus.
                        </p>
                      </div>
                      {selectedNode.child_count > 0 ? (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => handleToggle(selectedNode)}
                        >
                          {expanded[selectedNode.code] ? "Collapse in tree" : "Expand in tree"}
                        </button>
                      ) : null}
                    </div>

                    <div className="grid-list">
                      {(childrenMap[selectedNode.code] || []).map((child) => (
                        <button
                          className="mini-card"
                          key={child.code}
                          type="button"
                          onClick={() => selectNode(child.code)}
                        >
                          <span className="code-badge">{child.code}</span>
                          <strong>{child.title}</strong>
                          <small>{levelLabel(child.level)}</small>
                        </button>
                      ))}
                      {selectedNode.child_count === 0 ? (
                        <p className="empty-state">This node has no official child codes.</p>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : null}

              {activeTab === "vocabulary" ? (
                <div className="tab-shell">
                  <section className="panel tab-panel">
                    <div className="section-header">
                      <div>
                        <h3>Authority crosswalks</h3>
                        <p className="muted-copy">
                          Live library lookups let you pivot from the MSC phrasing into broader
                          catalog language before generating outputs.
                        </p>
                      </div>
                    </div>

                    {isVocabularyLoading ? (
                      <p className="hint-text">Loading authoritative vocabulary lookups...</p>
                    ) : null}
                    {vocabularyError ? <p className="error-text">{vocabularyError}</p> : null}

                    <div className="stack-list">
                      {vocabulary?.groups?.map((group) => (
                        <article className="term-card" key={group.scheme}>
                          <div className="section-header">
                            <div>
                              <h4>{group.heading}</h4>
                              <p className="muted-copy">Source search for the selected MSC label.</p>
                            </div>
                            <a className="text-link" href={group.search_url} rel="noreferrer" target="_blank">
                              Open source search
                            </a>
                          </div>

                          {group.warning ? <p className="hint-text">{group.warning}</p> : null}

                          <div className="stack-list">
                            {group.terms.map((term) => (
                              <article className="entry-card vocabulary-entry" key={`${group.scheme}-${term.identifier || term.label}`}>
                                <div className="entry-head">
                                  <div>
                                    <h5>{term.label}</h5>
                                    <p className="muted-copy">
                                      {schemeLabel(term.scheme)}
                                      {term.identifier ? ` - ${term.identifier}` : ""}
                                      {term.match_type ? ` - ${term.match_type} match` : ""}
                                    </p>
                                  </div>
                                  {term.source_url ? (
                                    <a className="text-link" href={term.source_url} rel="noreferrer" target="_blank">
                                      Open record
                                    </a>
                                  ) : null}
                                </div>
                                {term.note ? <p>{term.note}</p> : null}
                                <div className="action-row">
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => activateVocabularyTerm(term)}
                                  >
                                    Use as active topic
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}

              {activeTab === "bibliography" ? (
                <div className="tab-shell">
                  <section className="panel tab-panel">
                    <div className="section-header">
                      <div>
                        <h3>Bibliography studio</h3>
                        <p className="muted-copy">
                          Shape the reading list before it is assembled from Crossref and OpenAlex.
                        </p>
                      </div>
                      {activeTarget ? (
                        <span className="soft-badge">
                          {schemeLabel(activeTarget.target_scheme)} - {activeTarget.target_label}
                        </span>
                      ) : null}
                    </div>

                    <form className="generator-form" onSubmit={generateBibliography}>
                      <label className="field">
                        <span>Audience</span>
                        <select
                          value={bibliographyRequest.audience}
                          onChange={(event) =>
                            setBibliographyRequest((current) => ({
                              ...current,
                              audience: event.target.value,
                            }))
                          }
                        >
                          <option value="beginner">Beginner orientation</option>
                          <option value="broad">Broad orientation</option>
                          <option value="graduate">Graduate starting point</option>
                          <option value="research">Research emphasis</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Focus</span>
                        <input
                          value={bibliographyRequest.focus}
                          onChange={(event) =>
                            setBibliographyRequest((current) => ({
                              ...current,
                              focus: event.target.value,
                            }))
                          }
                          placeholder="Optional angle, era, method, or subtheme"
                        />
                      </label>

                      <label className="field">
                        <span>Notes</span>
                        <textarea
                          rows="3"
                          value={bibliographyRequest.notes}
                          onChange={(event) =>
                            setBibliographyRequest((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Optional constraints or exclusions"
                        />
                      </label>

                      <label className="field">
                        <span>Maximum entries</span>
                        <input
                          type="range"
                          min="4"
                          max="16"
                          value={bibliographyRequest.max_entries}
                          onChange={(event) =>
                            setBibliographyRequest((current) => ({
                              ...current,
                              max_entries: event.target.value,
                            }))
                          }
                        />
                        <small>{bibliographyRequest.max_entries} references</small>
                      </label>

                      <button
                        className="primary-button"
                        disabled={!activeTarget || isBibliographyLoading}
                        type="submit"
                      >
                        {isBibliographyLoading ? "Building grounded bibliography..." : "Generate grounded bibliography"}
                      </button>
                    </form>

                    {bibliographyError ? <p className="error-text">{bibliographyError}</p> : null}
                  </section>

                  {bibliography ? (
                    <section className="panel tab-panel">
                      <div className="section-header">
                        <div>
                          <h3>{bibliography.target_label}</h3>
                          <p className="muted-copy">
                            {schemeLabel(bibliography.target_scheme)} - {formatTime(bibliography.generated_at)}
                          </p>
                        </div>
                        <span className="soft-badge">{bibliography.model}</span>
                      </div>

                      <p>{bibliography.overview}</p>

                      <div className="guidance-grid">
                        <div className="subpanel">
                          <h4>Search guidance</h4>
                          <ul className="plain-list">
                            {bibliography.search_guidance.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="subpanel">
                          <h4>Caveats</h4>
                          <ul className="plain-list">
                            {bibliography.caveats.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="stack-list">
                        {bibliography.sections.map((section) => (
                          <article className="entry-section" key={section.key}>
                            <div className="section-header">
                              <div>
                                <h4>{section.label}</h4>
                                <p className="muted-copy">{section.description}</p>
                              </div>
                            </div>

                            <div className="entry-list">
                              {section.entries.map((entry, index) => (
                                <article className="entry-card" key={`${entry.title}-${index}`}>
                                  <div className="entry-head">
                                    <div>
                                      <h5>{entry.title}</h5>
                                      <p className="authors-line">
                                        {entry.authors.join(", ") || "Author information unavailable"}
                                        {entry.year ? ` (${entry.year})` : ""}
                                      </p>
                                      <p className="muted-copy">
                                        {[entry.venue, entry.work_type, entry.doi].filter(Boolean).join(" - ")}
                                      </p>
                                    </div>
                                    <span className={`confidence-pill ${entry.confidence}`}>
                                      {confidenceLabel(entry.confidence)}
                                    </span>
                                  </div>
                                  <p>{entry.rationale}</p>
                                  <div className="link-row">
                                    {entry.url ? (
                                      <a className="text-link" href={entry.url} rel="noreferrer" target="_blank">
                                        Visit work
                                      </a>
                                    ) : null}
                                    {entry.source_links.map((link) => (
                                      <a
                                        className="text-link"
                                        href={link.url}
                                        key={`${entry.title}-${link.source}`}
                                        rel="noreferrer"
                                        target="_blank"
                                      >
                                        {link.label}
                                      </a>
                                    ))}
                                  </div>
                                </article>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "learning" ? (
                <div className="tab-shell">
                  <section className="panel tab-panel">
                    <div className="section-header">
                      <div>
                        <h3>Concept studio</h3>
                        <p className="muted-copy">
                          A model-assisted layer for turning the active topic into a staged learning path.
                        </p>
                      </div>
                      {activeTarget ? (
                        <span className="soft-badge">
                          {schemeLabel(activeTarget.target_scheme)} - {activeTarget.target_label}
                        </span>
                      ) : null}
                    </div>

                    <div className="inline-form">
                      <label className="field compact">
                        <span>Audience</span>
                        <select
                          value={conceptRequest.audience}
                          onChange={(event) =>
                            setConceptRequest((current) => ({
                              ...current,
                              audience: event.target.value,
                            }))
                          }
                        >
                          <option value="beginner">Beginner</option>
                          <option value="broad">Broad</option>
                          <option value="graduate">Graduate</option>
                          <option value="research">Research</option>
                        </select>
                      </label>

                      <label className="field compact grow">
                        <span>Focus</span>
                        <input
                          value={conceptRequest.focus}
                          onChange={(event) =>
                            setConceptRequest((current) => ({
                              ...current,
                              focus: event.target.value,
                            }))
                          }
                          placeholder="Optional lens for the concept progression"
                        />
                      </label>

                      <button
                        className="primary-button compact-button"
                        disabled={!activeTarget || isConceptLoading}
                        type="button"
                        onClick={generateConceptTree}
                      >
                        {isConceptLoading ? "Generating..." : "Generate concept map"}
                      </button>
                    </div>

                    {conceptError ? <p className="error-text">{conceptError}</p> : null}
                  </section>

                  {conceptTree ? (
                    <section className="panel tab-panel">
                      <div className="section-header">
                        <div>
                          <h3>{conceptTree.target_label}</h3>
                          <p className="muted-copy">
                            {schemeLabel(conceptTree.target_scheme)} - {formatTime(conceptTree.generated_at)}
                          </p>
                        </div>
                        <span className="soft-badge">{conceptTree.model}</span>
                      </div>

                      <p>{conceptTree.overview}</p>

                      <div className="concept-grid">
                        <div className="subpanel">
                          <h4>Prerequisites</h4>
                          <ul className="plain-list">
                            {conceptTree.prerequisites.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="subpanel">
                          <h4>Beginner concepts</h4>
                          <ul className="plain-list">
                            {conceptTree.beginner_concepts.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="subpanel">
                          <h4>Intermediate concepts</h4>
                          <ul className="plain-list">
                            {conceptTree.intermediate_concepts.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="subpanel">
                          <h4>Advanced concepts</h4>
                          <ul className="plain-list">
                            {conceptTree.advanced_concepts.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="subpanel">
                          <h4>Milestone capabilities</h4>
                          <ul className="plain-list">
                            {conceptTree.milestone_capabilities.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="subpanel">
                          <h4>Bibliography strategy</h4>
                          <ul className="plain-list">
                            {conceptTree.bibliography_strategy.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {conceptTree.caution_notes.length > 0 ? (
                        <div className="subpanel caution-panel">
                          <h4>Caution notes</h4>
                          <ul className="plain-list">
                            {conceptTree.caution_notes.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-output">
              <h3>No node selected yet.</h3>
              <p>Choose a section or search for a code to start exploring the atlas.</p>
            </div>
          )}

          {selectionError ? <p className="error-text">{selectionError}</p> : null}
        </section>
      </main>
    </div>
  );
}
