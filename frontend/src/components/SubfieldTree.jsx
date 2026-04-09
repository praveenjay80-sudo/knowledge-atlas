import { Link } from "react-router-dom";

function renderResearchers(researchers) {
  if (!researchers.length) {
    return null;
  }

  return (
    <div className="tree-group">
      <p className="tree-group-label">Researchers</p>
      <div className="chip-row">
        {researchers.map((researcher) => (
          <Link
            className="person-chip"
            key={researcher.id}
            to={`/researchers/${researcher.slug}`}
          >
            {researcher.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function renderPapers(papers) {
  if (!papers.length) {
    return null;
  }

  return (
    <div className="tree-group">
      <p className="tree-group-label">Papers</p>
      <ul className="paper-list">
        {papers.map((paper) => (
          <li key={paper.id}>
            <span>{paper.title}</span>
            {paper.year ? <em>{paper.year}</em> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubfieldNode({ node, depth, expanded, toggle }) {
  const isExpanded = expanded.has(node.id);

  return (
    <div className="tree-node" style={{ "--depth": depth }}>
      <div className="tree-header">
        <button
          className="tree-toggle"
          type="button"
          onClick={() => toggle(node.id)}
        >
          {isExpanded ? "-" : "+"}
        </button>
        <div className="tree-title-block">
          <p className="tree-title">{node.name}</p>
          <p className="tree-copy">{node.description}</p>
        </div>
        <div className="tree-counts">
          <span>{node.researcher_count} researchers</span>
          <span>{node.paper_count} papers</span>
        </div>
      </div>
      {isExpanded ? (
        <div className="tree-content">
          {renderResearchers(node.researchers)}
          {renderPapers(node.papers)}
          {node.children.length ? (
            <div className="tree-children">
              {node.children.map((child) => (
                <SubfieldNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  toggle={toggle}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SubfieldTree({ roots, expanded, toggle }) {
  return (
    <div className="tree-shell">
      {roots.map((root) => (
        <SubfieldNode
          key={root.id}
          node={root}
          depth={0}
          expanded={expanded}
          toggle={toggle}
        />
      ))}
    </div>
  );
}
