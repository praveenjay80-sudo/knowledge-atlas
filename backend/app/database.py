from __future__ import annotations

from neo4j import Driver, GraphDatabase

from app.core.config import Settings


def create_driver(settings: Settings) -> Driver:
    return GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )

