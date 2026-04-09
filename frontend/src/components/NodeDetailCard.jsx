import { Link } from "react-router-dom";

export default function NodeDetailCard({ node }) {
  if (!node) {
    return (
      <aside className="detail-card detail-card-empty">
        <p className="eyebrow">Node Details</p>
        <h3>Pick a node in the graph</h3>
        <p>
          Subfields, researchers, and papers all open here with a compact summary.
        </p>
      </aside>
    );
  }

  return (
    <aside className="detail-card">
      <p className="eyebrow">{node.type}</p>
      <h3>{node.label}</h3>
      <p>{node.description || "No description is available for this node yet."}</p>
      {node.year ? <p className="detail-meta">Year: {node.year}</p> : null}
      {node.type === "Researcher" && node.slug ? (
        <Link className="inline-link" to={`/researchers/${node.slug}`}>
          Open researcher profile
        </Link>
      ) : null}
      {node.metadata ? (
        <dl className="detail-list">
          {Object.entries(node.metadata)
            .filter(
              ([key, value]) =>
                !["id", "slug", "name", "title", "description", "summary"].includes(key) &&
                value !== null
            )
            .map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
        </dl>
      ) : null}
    </aside>
  );
}

