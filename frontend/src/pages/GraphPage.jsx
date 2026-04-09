import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GraphCanvas from "../components/GraphCanvas";
import NodeDetailCard from "../components/NodeDetailCard";
import { fetchJson } from "../lib/api";

export default function GraphPage() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [researchers, setResearchers] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeSubfield, setActiveSubfield] = useState("");
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let active = true;

    async function loadGraph() {
      try {
        const data = await fetchJson("/graph");
        if (!active) {
          return;
        }
        setGraph(data);
        setError("");
      } catch (graphError) {
        if (active) {
          setError(graphError.message);
        }
      }
    }

    loadGraph();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadResearchers() {
      try {
        const query = activeSubfield
          ? `/researchers?subfield=${encodeURIComponent(activeSubfield)}`
          : "/researchers";
        const data = await fetchJson(query);
        if (active) {
          setResearchers(data);
        }
      } catch {
        if (active) {
          setResearchers([]);
        }
      }
    }

    loadResearchers();
    return () => {
      active = false;
    };
  }, [activeSubfield]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus || !graph.nodes.length) {
      return;
    }
    const match = graph.nodes.find((node) => node.id === focus);
    if (match) {
      setSelectedNode(match);
      if (match.type === "Subfield" && match.slug) {
        setActiveSubfield(match.slug);
      }
    }
  }, [graph.nodes, searchParams]);

  function handleNodeSelect(node) {
    setSelectedNode(node);
    if (node.type === "Subfield" && node.slug) {
      setActiveSubfield(node.slug);
      return;
    }
    if (node.type !== "Subfield") {
      setActiveSubfield("");
    }
  }

  const subfieldOptions = graph.nodes.filter((node) => node.type === "Subfield");

  return (
    <section className="page-grid">
      <div className="panel panel-hero">
        <p className="eyebrow">Graph Explorer</p>
        <h1>Atlas of Elite Thinkers</h1>
        <p className="lead">
          Explore how elite mathematical thinking compounds across subfields,
          researchers, and landmark papers.
        </p>
      </div>

      <div className="panel graph-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Knowledge Graph</p>
            <h2>Subfields, authorship, and influence</h2>
          </div>
          <div className="legend">
            <span className="legend-item legend-subfield">Subfield</span>
            <span className="legend-item legend-researcher">Researcher</span>
            <span className="legend-item legend-paper">Paper</span>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <GraphCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNode?.id}
        />
      </div>

      <NodeDetailCard node={selectedNode} />

      <div className="panel directory-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Researcher Directory</p>
            <h2>List + filter view</h2>
          </div>
          <label className="select-shell">
            <span>Filter by subfield</span>
            <select
              value={activeSubfield}
              onChange={(event) => setActiveSubfield(event.target.value)}
            >
              <option value="">All subfields</option>
              {subfieldOptions.map((subfield) => (
                <option key={subfield.id} value={subfield.slug}>
                  {subfield.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="researcher-list">
          {researchers.map((researcher) => (
            <Link
              className="researcher-card"
              key={researcher.id}
              to={`/researchers/${researcher.slug}`}
            >
              <div>
                <p className="card-title">{researcher.name}</p>
                <p className="card-copy">{researcher.description}</p>
              </div>
              <div className="chip-row">
                {researcher.subfields.map((subfield) => (
                  <span className="soft-chip" key={subfield.id}>
                    {subfield.name}
                  </span>
                ))}
              </div>
              <p className="meta-line">
                {researcher.paper_count} papers tracked
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

