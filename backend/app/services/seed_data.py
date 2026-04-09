from __future__ import annotations

from neo4j import Driver


SEED_SUBFIELDS = [
    {
        "id": "subfield-mathematics",
        "slug": "mathematics",
        "name": "Mathematics",
        "description": "The broad mathematical landscape spanning pure and applied inquiry.",
    },
    {
        "id": "subfield-pde",
        "slug": "partial-differential-equations",
        "name": "Partial Differential Equations",
        "description": "The study of equations involving multivariable rates of change and their solutions.",
    },
    {
        "id": "subfield-navier-stokes",
        "slug": "navier-stokes",
        "name": "Navier-Stokes",
        "description": "Research on viscous fluid flow, regularity, turbulence, and well-posedness.",
    },
]

SEED_RESEARCHERS = [
    {
        "id": "researcher-terence-tao",
        "slug": "terence-tao",
        "name": "Terence Tao",
        "description": "Australian-American mathematician whose work spans harmonic analysis, PDE, and fluid dynamics.",
        "notability": "Known for broad contributions across analysis and mathematical problem solving.",
        "born": 1975,
        "nationality": "Australian-American",
    },
    {
        "id": "researcher-jean-leray",
        "slug": "jean-leray",
        "name": "Jean Leray",
        "description": "French mathematician whose 1934 work shaped the modern theory of weak solutions for Navier-Stokes.",
        "notability": "Introduced weak-solution ideas that remain central to fluid mechanics.",
        "born": 1906,
        "nationality": "French",
    },
]

SEED_PAPERS = [
    {
        "id": "paper-leray-1934",
        "slug": "leray-1934",
        "title": "Sur le mouvement d'un liquide visqueux emplissant l'espace",
        "year": 1934,
        "venue": "Acta Mathematica",
        "summary": "Foundational paper introducing weak solutions and existence results for viscous incompressible flow.",
    },
    {
        "id": "paper-tao-2016",
        "slug": "tao-2016",
        "title": "Finite time blowup for an averaged three-dimensional Navier-Stokes equation",
        "year": 2016,
        "venue": "Journal of the American Mathematical Society",
        "summary": "A modern contribution exploring blowup behavior in an averaged Navier-Stokes model.",
    },
]


def seed_database(driver: Driver, database: str) -> None:
    query = """
    UNWIND $subfields AS subfield
    MERGE (s:Subfield {id: subfield.id})
    SET s.slug = subfield.slug,
        s.name = subfield.name,
        s.description = subfield.description
    WITH count(*) AS _
    UNWIND $researchers AS researcher
    MERGE (r:Researcher {id: researcher.id})
    SET r.slug = researcher.slug,
        r.name = researcher.name,
        r.description = researcher.description,
        r.notability = researcher.notability,
        r.born = researcher.born,
        r.nationality = researcher.nationality
    WITH count(*) AS _
    UNWIND $papers AS paper
    MERGE (p:Paper {id: paper.id})
    SET p.slug = paper.slug,
        p.title = paper.title,
        p.year = paper.year,
        p.venue = paper.venue,
        p.summary = paper.summary
    WITH 1 AS _
    MATCH (mathematics:Subfield {id: "subfield-mathematics"})
    MATCH (pde:Subfield {id: "subfield-pde"})
    MATCH (navier:Subfield {id: "subfield-navier-stokes"})
    MERGE (pde)-[:SUBFIELD_OF]->(mathematics)
    MERGE (navier)-[:SUBFIELD_OF]->(pde)
    WITH 1 AS _
    MATCH (tao:Researcher {id: "researcher-terence-tao"})
    MATCH (leray:Researcher {id: "researcher-jean-leray"})
    MATCH (mathematics:Subfield {id: "subfield-mathematics"})
    MATCH (pde:Subfield {id: "subfield-pde"})
    MATCH (navier:Subfield {id: "subfield-navier-stokes"})
    MERGE (tao)-[:WORKS_IN]->(mathematics)
    MERGE (tao)-[:WORKS_IN]->(navier)
    MERGE (leray)-[:WORKS_IN]->(pde)
    MERGE (leray)-[:WORKS_IN]->(navier)
    MERGE (leray)-[:INFLUENCES]->(tao)
    WITH 1 AS _
    MATCH (leray:Researcher {id: "researcher-jean-leray"})
    MATCH (tao:Researcher {id: "researcher-terence-tao"})
    MATCH (lerayPaper:Paper {id: "paper-leray-1934"})
    MATCH (taoPaper:Paper {id: "paper-tao-2016"})
    MERGE (leray)-[:AUTHORED]->(lerayPaper)
    MERGE (tao)-[:AUTHORED]->(taoPaper)
    """

    with driver.session(database=database) as session:
        session.run(
            query,
            subfields=SEED_SUBFIELDS,
            researchers=SEED_RESEARCHERS,
            papers=SEED_PAPERS,
        ).consume()

