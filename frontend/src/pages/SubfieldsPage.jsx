import { useEffect, useState } from "react";
import SubfieldTree from "../components/SubfieldTree";
import { fetchJson } from "../lib/api";

function collectIds(nodes) {
  const ids = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectIds(node.children));
  }
  return ids;
}

export default function SubfieldsPage() {
  const [roots, setRoots] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTree() {
      try {
        const data = await fetchJson("/subfields");
        if (!active) {
          return;
        }
        setRoots(data);
        setExpanded(new Set(data.map((node) => node.id)));
      } catch (treeError) {
        if (active) {
          setError(treeError.message);
        }
      }
    }

    loadTree();
    return () => {
      active = false;
    };
  }, []);

  function toggle(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section className="page-grid single-column">
      <div className="panel panel-hero">
        <p className="eyebrow">Subfield Browser</p>
        <h1>Hierarchies of mathematical thought</h1>
        <p className="lead">
          Expand and collapse branches to move from broad domains down into
          concrete problem spaces.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Hierarchy</p>
            <h2>Subfield tree</h2>
          </div>
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              onClick={() => setExpanded(new Set(collectIds(roots)))}
            >
              Expand all
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setExpanded(new Set())}
            >
              Collapse all
            </button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <SubfieldTree roots={roots} expanded={expanded} toggle={toggle} />
      </div>
    </section>
  );
}

