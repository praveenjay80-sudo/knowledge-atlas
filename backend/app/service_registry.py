from __future__ import annotations

from fastapi import FastAPI

from app.core.config import get_settings
from app.services.bibliography_service import BibliographyService
from app.services.concept_service import ConceptService
from app.services.controlled_vocabulary_service import ControlledVocabularyService
from app.services.msc_service import MscCatalogService


settings = get_settings()


def initialize_services(app: FastAPI) -> None:
    if getattr(app.state, "catalog_service", None) is None:
        app.state.catalog_service = MscCatalogService()
    if getattr(app.state, "bibliography_service", None) is None:
        app.state.bibliography_service = BibliographyService(settings)
    if getattr(app.state, "concept_service", None) is None:
        app.state.concept_service = ConceptService(settings)
    if getattr(app.state, "vocabulary_service", None) is None:
        app.state.vocabulary_service = ControlledVocabularyService()
