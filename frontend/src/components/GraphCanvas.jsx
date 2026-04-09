import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

const TYPE_COLORS = {
  Subfield: "#1d5f77",
  Researcher: "#c15b2f",
  Paper: "#4c6b3d"
};

export default function GraphCanvas({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId,
  layout = "cose"
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const elements = [
      ...nodes.map((node) => ({
        data: { ...node },
        classes: node.type.toLowerCase()
      })),
      ...edges.map((edge) => ({
        data: { ...edge }
      }))
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": (element) => TYPE_COLORS[element.data("type")] || "#4e5a67",
            color: "#0f1a20",
            "font-size": 11,
            "font-weight": 700,
            "text-wrap": "wrap",
            "text-max-width": 120,
            "text-valign": "bottom",
            "text-margin-y": 10,
            "border-width": 2,
            "border-color": "#f7f1e6",
            width: (element) => (element.data("type") === "Subfield" ? 42 : 32),
            height: (element) => (element.data("type") === "Subfield" ? 42 : 32)
          }
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#8f9aa3",
            "target-arrow-color": "#8f9aa3",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 9,
            color: "#54606b",
            "text-background-color": "#f7f1e6",
            "text-background-opacity": 1,
            "text-background-padding": 2
          }
        },
        {
          selector: ".highlighted",
          style: {
            "border-color": "#f7d57e",
            "border-width": 5,
            "overlay-color": "#f7d57e",
            "overlay-opacity": 0.18
          }
        }
      ],
      layout: {
        name: layout,
        animate: false,
        fit: true,
        padding: 36,
        nodeDimensionsIncludeLabels: true,
        spacingFactor: 1.2
      },
      wheelSensitivity: 0.15
    });

    cy.on("tap", "node", (event) => {
      if (onNodeSelect) {
        onNodeSelect(event.target.data());
      }
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [edges, layout, nodes, onNodeSelect]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.nodes().removeClass("highlighted");

    if (!selectedNodeId) {
      return;
    }

    const node = cy.getElementById(selectedNodeId);
    if (node.length) {
      node.addClass("highlighted");
      cy.animate({
        fit: {
          eles: node.closedNeighborhood(),
          padding: 70
        },
        duration: 250
      });
    }
  }, [selectedNodeId]);

  return <div className="graph-canvas" ref={containerRef} />;
}

