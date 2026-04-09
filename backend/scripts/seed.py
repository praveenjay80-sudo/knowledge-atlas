from __future__ import annotations

from app.core.config import get_settings
from app.database import create_driver
from app.services.seed_data import seed_database


def main() -> None:
    settings = get_settings()
    driver = create_driver(settings)
    try:
        seed_database(driver, settings.neo4j_database)
        print("Atlas seed data loaded into Neo4j.")
    finally:
        driver.close()


if __name__ == "__main__":
    main()
