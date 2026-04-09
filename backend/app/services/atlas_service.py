from __future__ import annotations

from typing import Any

from neo4j import Driver

from app.schemas import (
    GraphEdge,
    GraphNode,
    GraphResponse,
    InfluenceGraph,
    PaperReference,
    ResearcherDetail,
    ResearcherSummary,
    SearchResult,
    SubfieldReference,
    SubfieldTreeNode,
)
from app.services.seed_data import seed_database


class AtlasService:
    def __init__(self, driver: Driver, database: str) -> None:
        self.driver = driver
        self.database = database

    def ping(self) -> bool:
        with self.driver.session(database=self.database) as session:
            record = session.run("RETURN 1 AS ok").single()
        return bool(record and record["ok"] == 1)

    def ensure_seed_data(self) -> None:
        with self.driver.session(database=self.database) as session:
            record = session.run(
                "MATCH (n) WHERE n:Subfield OR n:Researcher OR n:Paper RETURN count(n) AS total"
            ).single()

        if not record or record["total"] == 0:
            seed_database(self.driver, self.database)

    def get_graph(self) -> GraphResponse:
        with self.driver.session(database=self.database) as session:
            node_rows = session.run(
                """
                MATCH (n)
                WHERE n:Subfield OR n:Researcher OR n:Paper
                RETURN
                  n.id AS id,
                  head(labels(n)) AS type,
                  n.slug AS slug,
                  coalesce(n.name, n.title) AS label,
                  coalesce(n.description, n.summary, n.notability) AS description,
                  n.year AS year,
                  properties(n) AS metadata
                ORDER BY type, label
                """
            ).data()
            edge_rows = session.run(
                """
                MATCH (source)-[rel:SUBFIELD_OF|WORKS_IN|AUTHORED|INFLUENCES]->(target)
                RETURN
                  source.id + "-" + type(rel) + "-" + target.id AS id,
                  source.id AS source,
                  target.id AS target,
                  type(rel) AS type
                ORDER BY type, source, target
                """
            ).data()

        nodes = [
            GraphNode(
                id=row["id"],
                label=row["label"],
                type=row["type"],
                slug=row["slug"],
                description=row["description"],
                year=row["year"],
                metadata=row["metadata"],
            )
            for row in node_rows
        ]
        edges = [
            GraphEdge(
                id=row["id"],
                source=row["source"],
                target=row["target"],
                type=row["type"],
                label=row["type"].replace("_", " ").title(),
            )
            for row in edge_rows
        ]
        return GraphResponse(nodes=nodes, edges=edges)

    def get_subfield_tree(self) -> list[SubfieldTreeNode]:
        query = """
        MATCH (s:Subfield)
        OPTIONAL MATCH (s)-[:SUBFIELD_OF]->(parent:Subfield)
        OPTIONAL MATCH (r:Researcher)-[:WORKS_IN]->(s)
        OPTIONAL MATCH (r)-[:AUTHORED]->(p:Paper)
        RETURN
          s {
            .*,
            parent_id: parent.id
          } AS subfield,
          collect(DISTINCT r {
            .id,
            .slug,
            .name,
            .description,
            .notability
          }) AS researchers,
          collect(DISTINCT p {
            .id,
            .slug,
            .title,
            .year
          }) AS papers
        ORDER BY s.name
        """

        with self.driver.session(database=self.database) as session:
            rows = session.run(query).data()

        node_map: dict[str, dict[str, Any]] = {}
        parent_lookup: dict[str, str | None] = {}

        for row in rows:
            subfield = row["subfield"]
            researchers = [
                ResearcherSummary(
                    id=item["id"],
                    slug=item["slug"],
                    name=item["name"],
                    description=item.get("description"),
                    notability=item.get("notability"),
                    subfields=[],
                    paper_count=0,
                    influenced_by=[],
                )
                for item in row["researchers"]
                if item and item.get("id")
            ]
            papers = [
                PaperReference(
                    id=item["id"],
                    slug=item["slug"],
                    title=item["title"],
                    year=item.get("year"),
                )
                for item in row["papers"]
                if item and item.get("id")
            ]
            node_map[subfield["id"]] = {
                "id": subfield["id"],
                "name": subfield["name"],
                "slug": subfield["slug"],
                "description": subfield.get("description"),
                "researchers": self._unique_models(researchers, key="id"),
                "papers": self._unique_models(papers, key="id"),
                "children": [],
            }
            parent_lookup[subfield["id"]] = subfield.get("parent_id")

        roots: list[dict[str, Any]] = []
        for subfield_id, node in node_map.items():
            parent_id = parent_lookup[subfield_id]
            if parent_id and parent_id in node_map:
                node_map[parent_id]["children"].append(node)
            else:
                roots.append(node)

        return [self._build_tree_model(root)[0] for root in roots]

    def get_researchers(
        self,
        subfield: str | None = None,
        search: str | None = None,
    ) -> list[ResearcherSummary]:
        query = """
        MATCH (r:Researcher)
        OPTIONAL MATCH (r)-[:WORKS_IN]->(s:Subfield)
        WITH r, collect(DISTINCT s) AS subfields
        WHERE (
          $subfield = "" OR
          ANY(sf IN subfields WHERE sf.slug = $subfield OR sf.id = $subfield)
        ) AND (
          $search = "" OR
          toLower(r.name) CONTAINS toLower($search) OR
          toLower(coalesce(r.description, "")) CONTAINS toLower($search) OR
          ANY(sf IN subfields WHERE toLower(sf.name) CONTAINS toLower($search))
        )
        OPTIONAL MATCH (r)-[:AUTHORED]->(p:Paper)
        WITH r, subfields, collect(DISTINCT p) AS papers
        OPTIONAL MATCH (mentor:Researcher)-[:INFLUENCES]->(r)
        RETURN r {
          .id,
          .slug,
          .name,
          .description,
          .notability,
          paper_count: size(papers),
          subfields: [sf IN subfields WHERE sf IS NOT NULL | sf {
            .id,
            .name,
            .slug
          }],
          influenced_by: [m IN collect(DISTINCT mentor) WHERE m IS NOT NULL | m.name]
        } AS researcher
        ORDER BY researcher.name
        """

        with self.driver.session(database=self.database) as session:
            rows = session.run(
                query,
                subfield=subfield or "",
                search=search or "",
            ).data()

        return [self._researcher_summary(row["researcher"]) for row in rows]

    def get_researcher(self, slug: str) -> ResearcherDetail | None:
        query = """
        MATCH (r:Researcher {slug: $slug})
        OPTIONAL MATCH (r)-[:WORKS_IN]->(s:Subfield)
        WITH r, collect(DISTINCT s {
          .id,
          .name,
          .slug
        }) AS subfields
        OPTIONAL MATCH (r)-[:AUTHORED]->(p:Paper)
        WITH r, subfields, collect(DISTINCT p {
          .id,
          .slug,
          .title,
          .year
        }) AS papers
        OPTIONAL MATCH (mentor:Researcher)-[:INFLUENCES]->(r)
        WITH r, subfields, papers, collect(DISTINCT mentor {
          .id,
          .slug,
          .name
        }) AS influenced_by
        OPTIONAL MATCH (r)-[:INFLUENCES]->(peer:Researcher)
        RETURN r {
          .id,
          .slug,
          .name,
          .description,
          .notability,
          .born,
          .nationality,
          subfields: subfields,
          papers: papers,
          influenced_by: influenced_by,
          influences: collect(DISTINCT peer {
            .id,
            .slug,
            .name
          })
        } AS researcher
        """

        with self.driver.session(database=self.database) as session:
            row = session.run(query, slug=slug).single()
            if row is None:
                return None
            influence_graph = self._get_influence_graph(session, slug)

        researcher = row["researcher"]
        return ResearcherDetail(
            id=researcher["id"],
            slug=researcher["slug"],
            name=researcher["name"],
            description=researcher.get("description"),
            born=researcher.get("born"),
            nationality=researcher.get("nationality"),
            notability=researcher.get("notability"),
            subfields=[
                SubfieldReference(**item)
                for item in researcher.get("subfields", [])
                if item and item.get("id")
            ],
            papers=[
                PaperReference(**item)
                for item in researcher.get("papers", [])
                if item and item.get("id")
            ],
            influenced_by=[
                {
                    "id": item["id"],
                    "slug": item["slug"],
                    "name": item["name"],
                }
                for item in researcher.get("influenced_by", [])
                if item and item.get("id")
            ],
            influences=[
                {
                    "id": item["id"],
                    "slug": item["slug"],
                    "name": item["name"],
                }
                for item in researcher.get("influences", [])
                if item and item.get("id")
            ],
            influence_graph=influence_graph,
        )

    def search(self, query_text: str) -> list[SearchResult]:
        query = """
        MATCH (n)
        WHERE n:Subfield OR n:Researcher OR n:Paper
        WITH n, head(labels(n)) AS node_type, coalesce(n.name, n.title) AS display
        WHERE
          toLower(display) CONTAINS toLower($query) OR
          toLower(coalesce(n.description, "")) CONTAINS toLower($query) OR
          toLower(coalesce(n.summary, "")) CONTAINS toLower($query) OR
          toLower(coalesce(n.notability, "")) CONTAINS toLower($query)
        OPTIONAL MATCH (n)-[:WORKS_IN|AUTHORED|SUBFIELD_OF|INFLUENCES]->(related)
        RETURN {
          id: n.id,
          slug: n.slug,
          label: display,
          type: node_type,
          description: coalesce(n.description, n.summary, n.notability),
          related: [name IN collect(DISTINCT coalesce(related.name, related.title)) WHERE name IS NOT NULL][0..3]
        } AS result
        ORDER BY result.type, result.label
        LIMIT 20
        """

        with self.driver.session(database=self.database) as session:
            rows = session.run(query, query=query_text).data()

        return [SearchResult(**row["result"]) for row in rows]

    def _get_influence_graph(self, session: Any, slug: str) -> InfluenceGraph:
        rows = session.run(
            """
            MATCH (center:Researcher {slug: $slug})
            OPTIONAL MATCH (mentor:Researcher)-[:INFLUENCES]->(center)
            OPTIONAL MATCH (center)-[:INFLUENCES]->(peer:Researcher)
            WITH [center] + collect(DISTINCT mentor) + collect(DISTINCT peer) AS people
            UNWIND people AS person
            WITH DISTINCT person, people
            OPTIONAL MATCH (person)-[rel:INFLUENCES]->(other:Researcher)
            WHERE other IN people
            RETURN
              collect(DISTINCT person {
                .id,
                .slug,
                label: person.name,
                description: person.description,
                type: "Researcher",
                metadata: properties(person)
              }) AS nodes,
              collect(DISTINCT CASE
                WHEN rel IS NULL OR other IS NULL THEN NULL
                ELSE {
                  id: person.id + "-" + type(rel) + "-" + other.id,
                  source: person.id,
                  target: other.id,
                  type: type(rel),
                  label: type(rel)
                }
              END) AS edges
            """,
            slug=slug,
        ).single()

        raw_nodes = rows["nodes"] if rows else []
        raw_edges = rows["edges"] if rows else []
        nodes = [
            GraphNode(
                id=item["id"],
                slug=item.get("slug"),
                label=item["label"],
                type="Researcher",
                description=item.get("description"),
                metadata=item.get("metadata", {}),
            )
            for item in raw_nodes
            if item and item.get("id")
        ]
        edges = [
            GraphEdge(
                id=item["id"],
                source=item["source"],
                target=item["target"],
                type=item["type"],
                label=item["label"].replace("_", " ").title(),
            )
            for item in raw_edges
            if item and item.get("id")
        ]
        return InfluenceGraph(nodes=nodes, edges=edges)

    def _researcher_summary(self, payload: dict[str, Any]) -> ResearcherSummary:
        return ResearcherSummary(
            id=payload["id"],
            slug=payload["slug"],
            name=payload["name"],
            description=payload.get("description"),
            notability=payload.get("notability"),
            paper_count=payload.get("paper_count", 0),
            subfields=[
                SubfieldReference(**item)
                for item in payload.get("subfields", [])
                if item and item.get("id")
            ],
            influenced_by=[
                item for item in payload.get("influenced_by", []) if item
            ],
        )

    def _build_tree_model(
        self, node: dict[str, Any]
    ) -> tuple[SubfieldTreeNode, set[str], set[str]]:
        built_children = [self._build_tree_model(child) for child in node["children"]]
        child_models = [item[0] for item in built_children]
        researcher_ids = {researcher.id for researcher in node["researchers"]}
        paper_ids = {paper.id for paper in node["papers"]}

        for _, child_researcher_ids, child_paper_ids in built_children:
            researcher_ids.update(child_researcher_ids)
            paper_ids.update(child_paper_ids)

        model = SubfieldTreeNode(
            id=node["id"],
            name=node["name"],
            slug=node["slug"],
            description=node.get("description"),
            researcher_count=len(researcher_ids),
            paper_count=len(paper_ids),
            researchers=node["researchers"],
            papers=node["papers"],
            children=child_models,
        )
        return model, researcher_ids, paper_ids

    @staticmethod
    def _unique_models(items: list[Any], key: str) -> list[Any]:
        seen: set[str] = set()
        unique_items: list[Any] = []
        for item in items:
            value = getattr(item, key)
            if value in seen:
                continue
            seen.add(value)
            unique_items.append(item)
        return unique_items
