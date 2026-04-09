import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GraphCanvas from "../components/GraphCanvas";
import { fetchJson } from "../lib/api";

export default function ResearcherProfilePage() {
  const { slug } = useParams();
  const [researcher, setResearcher] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResearcher() {
      try {
        const data = await fetchJson(`/researchers/${slug}`);
        if (!active) {
          return;
        }
        setResearcher(data);
        setSelectedNode(
          data.influence_graph.nodes.find((node) => node.slug === slug) || null
        );
        setError("");
      } catch (researcherError) {
        if (active) {
          setError(researcherError.message);
        }
      }
    }

    loadResearcher();
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) {
    return (
      <section className="page-grid single-column">
        <div className="panel">
          <p className="error-text">{error}</p>
        </div>
      </section>
    );
  }

  if (!researcher) {
    return (
      <section className="page-grid single-column">
        <div className="panel">
          <p>Loading researcher profile...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <div className="panel panel-hero">
        <p className="eyebrow">Researcher Profile</p>
        <h1>{researcher.name}</h1>
        <p className="lead">{researcher.description}</p>
        <div className="stat-grid">
          <div className="stat-card">
            <span>Born</span>
            <strong>{researcher.born || "Unknown"}</strong>
          </div>
          <div className="stat-card">
            <span>Nationality</span>
            <strong>{researcher.nationality || "Unknown"}</strong>
          </div>
          <div className="stat-card">
            <span>Tracked papers</span>
            <strong>{researcher.papers.length}</strong>
          </div>
        </div>
      </div>

      <div className="panel profile-panel">
        <p className="eyebrow">Scope</p>
        <h2>Subfields</h2>
        <div className="chip-row">
          {researcher.subfields.map((subfield) => (
            <Link className="soft-chip" key={subfield.id} to="/subfields">
              {subfield.name}
            </Link>
          ))}
        </div>
        <p className="profile-note">{researcher.notability}</p>
      </div>

      <div className="panel profile-panel">
        <p className="eyebrow">Influence</p>
        <h2>Influence graph</h2>
        <GraphCanvas
          nodes={researcher.influence_graph.nodes}
          edges={researcher.influence_graph.edges}
          onNodeSelect={setSelectedNode}
          selectedNodeId={selectedNode?.id}
          layout="circle"
        />
        {selectedNode ? (
          <div className="selected-person">
            <p className="card-title">{selectedNode.label}</p>
            <p>{selectedNode.description}</p>
            {selectedNode.slug ? (
              <Link className="inline-link" to={`/researchers/${selectedNode.slug}`}>
                Open profile
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="panel profile-panel">
        <p className="eyebrow">Papers</p>
        <h2>Authored work</h2>
        <ul className="paper-list rich-list">
          {researcher.papers.map((paper) => (
            <li key={paper.id}>
              <span>{paper.title}</span>
              {paper.year ? <em>{paper.year}</em> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel profile-panel">
        <p className="eyebrow">Relations</p>
        <h2>Incoming and outgoing influence</h2>
        <div className="relation-block">
          <div>
            <p className="tree-group-label">Influenced by</p>
            <div className="chip-row">
              {researcher.influenced_by.map((person) => (
                <Link
                  className="person-chip"
                  key={person.id}
                  to={`/researchers/${person.slug}`}
                >
                  {person.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="tree-group-label">Influences</p>
            <div className="chip-row">
              {researcher.influences.map((person) => (
                <Link
                  className="person-chip"
                  key={person.id}
                  to={`/researchers/${person.slug}`}
                >
                  {person.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

